import { utf8Decode } from '../security/utf8';
import { MAX_CLOUD_FILE } from './payload';
import { ConflictError, SessionError } from './sync-engine';

export type CloudRequest = (path: string, method?: string, body?: string | ArrayBuffer, binary?: boolean) => Promise<any>;
type Options = {
  url: string;
  publishableKey: string;
  userId: string;
  getSession(): Promise<{ userId: string; accessToken: string } | null>;
  fetchFn?: typeof fetch;
};

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const failure = () => new Error('CLOUD_REQUEST_FAILED');

/** Native-free transport: every operation stays bound to its original user's JWT. */
export function createCloudTransport({ url, publishableKey, userId, getSession, fetchFn = fetch }: Options) {
  let origin: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw failure();
    if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(publishableKey) || !USER_ID.test(userId)) throw failure();
    origin = parsed.origin;
  } catch { throw new Error('CLOUD_INVALID_CONFIGURATION'); }
  const lifetime = new AbortController();

  const target = (path: string): string => {
    if (typeof path !== 'string' || path.includes('\\') || path.includes('#') || !/^\/(?:rest|storage)\/v1\//.test(path)) throw failure();
    const pathname = path.split('?')[0];
    if (!/^\/(?:rest|storage)\/v1\/[a-zA-Z0-9_./-]+$/.test(pathname) || pathname.split('/').some((part) => part === '.' || part === '..')) throw failure();
    const parsed = new URL(path, origin);
    if (parsed.origin !== origin || !/^\/(?:rest|storage)\/v1\//.test(parsed.pathname)) throw failure();
    return parsed.toString();
  };

  const cancelled = (): Error => lifetime.signal.aborted ? new SessionError() : failure();
  const checkActive = (signal: AbortSignal) => { if (signal.aborted || lifetime.signal.aborted) throw cancelled(); };

  const bytes = async (response: Response, signal: AbortSignal): Promise<Uint8Array> => {
    checkActive(signal);
    const length = response.headers.get('content-length');
    if (length && /^\d+$/.test(length) && Number(length) > MAX_CLOUD_FILE) {
      void response.body?.cancel().catch(() => {});
      throw new Error('CLOUD_RESPONSE_TOO_LARGE');
    }
    // React Native implementations without response streams still get pre/post bounds.
    if (!response.body || typeof response.body.getReader !== 'function') {
      const buffer = await response.arrayBuffer();
      checkActive(signal);
      if (buffer.byteLength > MAX_CLOUD_FILE) throw new Error('CLOUD_RESPONSE_TOO_LARGE');
      return new Uint8Array(buffer);
    }
    const reader = response.body.getReader();
    const abort = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener('abort', abort, { once: true });
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        checkActive(signal);
        if (done) break;
        size += value.byteLength;
        if (size > MAX_CLOUD_FILE) { abort(); throw new Error('CLOUD_RESPONSE_TOO_LARGE'); }
        chunks.push(value);
      }
      const result = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
      return result;
    } finally {
      signal.removeEventListener('abort', abort);
      reader.releaseLock();
    }
  };

  return {
    async operation(): Promise<CloudRequest> {
      if (lifetime.signal.aborted) throw new SessionError();
      let session: Awaited<ReturnType<Options['getSession']>>;
      try { session = await getSession(); }
      catch (error) {
        if (lifetime.signal.aborted || error instanceof SessionError) throw new SessionError();
        throw failure();
      }
      if (lifetime.signal.aborted || session?.userId !== userId || typeof session.accessToken !== 'string' || !session.accessToken || /[\r\n]/.test(session.accessToken)) throw new SessionError();
      const jwt = session.accessToken;

      return async (path, method = 'GET', body, binary = false) => {
        if (lifetime.signal.aborted) throw new SessionError();
        const endpoint = target(path);
        if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(method)) throw failure();
        if (body instanceof ArrayBuffer && body.byteLength > MAX_CLOUD_FILE) throw new Error('CLOUD_REQUEST_TOO_LARGE');
        const controller = new AbortController();
        const abort = () => controller.abort();
        lifetime.signal.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(abort, 60_000);
        let rejectAbort: (() => void) | undefined;
        const aborted = new Promise<never>((_resolve, reject) => {
          rejectAbort = () => reject(cancelled());
          controller.signal.addEventListener('abort', rejectAbort, { once: true });
        });
        const execute = async () => {
          const response = await fetchFn(endpoint, {
            method, body, signal: controller.signal, redirect: 'error', cache: 'no-store', credentials: 'omit',
            headers: {
              apikey: publishableKey, Authorization: `Bearer ${jwt}`,
              'Content-Type': body instanceof ArrayBuffer ? 'application/octet-stream' : 'application/json',
              Accept: binary ? 'application/octet-stream' : 'application/json', 'x-upsert': 'false',
            },
          });
          checkActive(controller.signal);
          if (response.redirected || (response.status >= 300 && response.status < 400)) throw failure();
          if (response.url && new URL(response.url).origin !== origin) throw failure();
          if (response.status === 401 || response.status === 403) {
            void response.body?.cancel().catch(() => {});
            throw new SessionError();
          }
          const content = await bytes(response, controller.signal);
          checkActive(controller.signal);
          if (!response.ok) {
            let code: unknown;
            try { code = (JSON.parse(utf8Decode(content)) as { code?: unknown } | null)?.code; } catch { /* Error body is never shown or logged. */ }
            if (code === '40001') throw new ConflictError();
            if (code === '42501' || code === 'PGRST301') throw new SessionError();
            throw failure();
          }
          if (binary) return content;
          return content.length ? JSON.parse(utf8Decode(content)) as unknown : null;
        };
        try {
          return await Promise.race([execute(), aborted]);
        } catch (error) {
          if (error instanceof SessionError || error instanceof ConflictError) throw error;
          // Avoid propagating provider error bodies, request URLs, JWTs or API keys.
          throw failure();
        } finally {
          clearTimeout(timer);
          lifetime.signal.removeEventListener('abort', abort);
          if (rejectAbort) controller.signal.removeEventListener('abort', rejectAbort);
        }
      };
    },
    cancel(): void { lifetime.abort(); },
  };
}
