import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MAX_CLOUD_FILE } from '../src/cloud/payload';
import { ConflictError, SessionError } from '../src/cloud/sync-engine';
import { createCloudTransport } from '../src/cloud/transport';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const KEY = 'sb_publishable_example1234567890';
const JWT = 'first-jwt-do-not-print';
const BASE = { url: 'https://project.supabase.co/', publishableKey: KEY, userId: USER, getSession: async () => ({ userId: USER, accessToken: JWT }) };
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((ok) => { resolve = ok; });
  return { promise, resolve };
}

describe('cloud : transport isolé par session', () => {
  test('l’opération capture le JWT et conserve le même compte pour tous ses appels', async () => {
    let session = { userId: USER, accessToken: JWT };
    const seen: string[] = [];
    const transport = createCloudTransport({
      ...BASE, getSession: async () => session,
      fetchFn: async (url, init) => {
        assert.equal(String(url).startsWith('https://project.supabase.co/'), true);
        const headers = new Headers(init?.headers);
        assert.equal(headers.get('apikey'), KEY);
        seen.push(headers.get('authorization')!);
        assert.equal(init?.redirect, 'error');
        assert.equal(init?.cache, 'no-store');
        assert.equal(init?.credentials, 'omit');
        return Response.json({ ok: true });
      },
    });
    const request = await transport.operation();
    session = { userId: OTHER, accessToken: 'another-jwt' };
    assert.deepEqual(await request('/rest/v1/liora_snapshots'), { ok: true });
    await request(`/storage/v1/object/liora-files/${USER}/example.bin`, 'POST', Uint8Array.of(1, 2).buffer);
    assert.deepEqual(seen, [`Bearer ${JWT}`, `Bearer ${JWT}`]);
    await assert.rejects(transport.operation(), SessionError);
  });

  test('un compte absent ou différent et une configuration dangereuse sont refusés avant le réseau', async () => {
    let calls = 0;
    for (const session of [null, { userId: OTHER, accessToken: JWT }, { userId: USER, accessToken: '' }, { userId: USER, accessToken: 'bad\r\ntoken' }]) {
      const transport = createCloudTransport({ ...BASE, getSession: async () => session, fetchFn: async () => { calls += 1; return Response.json({}); } });
      await assert.rejects(transport.operation(), SessionError);
    }
    assert.equal(calls, 0);
    for (const url of ['http://project.supabase.co', 'https://user:secret@project.supabase.co', 'https://project.supabase.co/path', 'https://project.supabase.co/?secret=x', 'invalid']) {
      assert.throws(() => createCloudTransport({ ...BASE, url }), /CLOUD_INVALID_CONFIGURATION/);
    }
    assert.throws(() => createCloudTransport({ ...BASE, publishableKey: 'sb_secret_forbidden1234567890' }), /CLOUD_INVALID_CONFIGURATION/);
    assert.throws(() => createCloudTransport({ ...BASE, userId: 'invalid' }), /CLOUD_INVALID_CONFIGURATION/);
  });

  test('les chemins absolus, les redirections et les traversées ne reçoivent jamais le JWT', async () => {
    let calls = 0;
    const transport = createCloudTransport({ ...BASE, fetchFn: async () => { calls += 1; return Response.json({}); } });
    const request = await transport.operation();
    for (const path of ['https://evil.example/rest/v1/data', '//evil.example/rest/v1/data', '/auth/v1/admin/users', '/rest/v1/../auth/v1/token', '/rest/v1/%2e%2e/auth/v1/token', '/rest/v1/x%2f..%2fsecret', '/rest/v1/data#fragment', '/rest/v1\\evil']) {
      await assert.rejects(request(path), /CLOUD_REQUEST_FAILED/);
    }
    assert.equal(calls, 0);
    const redirected = createCloudTransport({ ...BASE, fetchFn: async () => new Response(null, { status: 302, headers: { Location: 'https://evil.example' } }) });
    await assert.rejects((await redirected.operation())('/rest/v1/data'), /CLOUD_REQUEST_FAILED/);
  });

  test('révocation, refus RLS et conflits CAS sont traduits sans révéler le corps d’erreur', async () => {
    for (const status of [401, 403]) {
      const transport = createCloudTransport({ ...BASE, fetchFn: async () => new Response(`secret ${JWT}`, { status }) });
      await assert.rejects((await transport.operation())('/rest/v1/data'), SessionError);
    }
    for (const code of ['42501', 'PGRST301']) {
      const transport = createCloudTransport({ ...BASE, fetchFn: async () => Response.json({ code, message: `secret ${JWT}` }, { status: 400 }) });
      await assert.rejects((await transport.operation())('/rest/v1/data'), SessionError);
    }
    const conflict = createCloudTransport({ ...BASE, fetchFn: async () => Response.json({ code: '40001', message: `secret ${JWT}` }, { status: 409 }) });
    await assert.rejects((await conflict.operation())('/rest/v1/rpc/liora_save_snapshot', 'POST', '{}'), ConflictError);
    for (const response of [new Response(`secret ${JWT}`, { status: 500 }), Response.json({ message: `secret ${JWT}` }, { status: 400 }), new Response('invalid JSON', { status: 200 })]) {
      const transport = createCloudTransport({ ...BASE, fetchFn: async () => response });
      await assert.rejects((await transport.operation())('/rest/v1/data'), (error: Error) => error.message === 'CLOUD_REQUEST_FAILED');
    }
  });

  test('le téléchargement binaire et les réponses vides gardent leur format', async () => {
    const transport = createCloudTransport({ ...BASE, fetchFn: async (url) => String(url).includes('storage') ? new Response(Uint8Array.of(0, 1, 255)) : new Response(null, { status: 204 }) });
    const request = await transport.operation();
    assert.deepEqual(await request('/storage/v1/object/authenticated/liora-files/example.bin', 'GET', undefined, true), Uint8Array.of(0, 1, 255));
    assert.equal(await request('/rest/v1/data', 'DELETE'), null);
  });

  test('la taille annoncée et la taille réelle sont plafonnées avant de retourner des données', async () => {
    let cancelled = false;
    const announced = createCloudTransport({
      ...BASE, fetchFn: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'Content-Length': String(MAX_CLOUD_FILE + 1) } }),
    });
    await assert.rejects((await announced.operation())('/storage/v1/object/file', 'GET', undefined, true), /CLOUD_REQUEST_FAILED/);
    assert.equal(cancelled, true);
    const bytes = new Uint8Array(MAX_CLOUD_FILE + 1);
    const actual = createCloudTransport({ ...BASE, fetchFn: async () => new Response(bytes) });
    await assert.rejects((await actual.operation())('/storage/v1/object/file', 'GET', undefined, true), /CLOUD_REQUEST_FAILED/);
    const fallback = createCloudTransport({
      ...BASE,
      fetchFn: async () => ({ ok: true, status: 200, redirected: false, url: '', headers: new Headers(), body: null, arrayBuffer: async () => bytes.buffer }) as Response,
    });
    await assert.rejects((await fallback.operation())('/storage/v1/object/file', 'GET', undefined, true), /CLOUD_REQUEST_FAILED/);
  });

  test('annuler bloque aussi les anciennes opérations et leurs réponses tardives', async () => {
    const response = deferred<Response>();
    const started = deferred();
    let calls = 0;
    const transport = createCloudTransport({ ...BASE, fetchFn: async () => { calls += 1; started.resolve(); return response.promise; } });
    const request = await transport.operation();
    const pending = request('/rest/v1/data');
    const rejection = assert.rejects(pending, SessionError);
    await started.promise;
    transport.cancel();
    await rejection;
    response.resolve(Response.json({ secret: 'late' }));
    await tick();
    await assert.rejects(request('/rest/v1/data'), SessionError);
    await assert.rejects(transport.operation(), SessionError);
    assert.equal(calls, 1);
  });

  test('l’annulation pendant la lecture du corps interrompt aussi le lecteur', async () => {
    let cancelled = false;
    const started = deferred();
    const transport = createCloudTransport({
      ...BASE, fetchFn: async () => new Response(new ReadableStream({ pull() { started.resolve(); }, cancel() { cancelled = true; } })),
    });
    const request = await transport.operation();
    const pending = request('/storage/v1/object/file', 'GET', undefined, true);
    const rejection = assert.rejects(pending, SessionError);
    await started.promise;
    await tick();
    transport.cancel();
    await rejection;
    assert.equal(cancelled, true);
  });

  test('le délai de 60 secondes couvre la lecture du corps après les en-têtes', async (context) => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const started = deferred();
    const transport = createCloudTransport({
      ...BASE, fetchFn: async () => new Response(new ReadableStream({ pull() { started.resolve(); } })),
    });
    const request = await transport.operation();
    const pending = request('/storage/v1/object/file', 'GET', undefined, true);
    const rejection = assert.rejects(pending, /CLOUD_REQUEST_FAILED/);
    await started.promise;
    await Promise.resolve();
    context.mock.timers.tick(60_001);
    await rejection;
  });

  test('les erreurs de récupération de session ne transmettent aucune donnée sensible', async () => {
    const transport = createCloudTransport({ ...BASE, getSession: async () => { throw new Error(`network ${JWT} ${KEY}`); } });
    await assert.rejects(transport.operation(), (error: Error) => error.message === 'CLOUD_REQUEST_FAILED');
  });
});
