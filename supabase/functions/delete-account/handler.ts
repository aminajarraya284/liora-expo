type Identity = { id: string; email: string };
type VerifiedPassword = { id: string };
type ListedFile = { id: string | null; name: string };

/** Les clients administrateur ne sont créés que par l'Edge Function, jamais dans l'app. */
export type DeleteAccountDependencies = {
  authenticate(jwt: string): Promise<Identity | null>;
  verifyPassword(email: string, password: string): Promise<VerifiedPassword | null>;
  markDeleting(userId: string): Promise<void>;
  signOutGlobally(jwt: string): Promise<void>;
  listFiles(prefix: string): Promise<ListedFile[]>;
  removeFiles(paths: string[]): Promise<void>;
  deleteUser(userId: string): Promise<void>;
};

const FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.bin$/;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const respond = (status: number, body: unknown) => Response.json(body, {
  status,
  headers: { ...CORS, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

export function createDeleteAccountHandler(deps: DeleteAccountDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' });
    const authorization = request.headers.get('authorization') ?? '';
    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    if (!match) return respond(401, { error: 'unauthorized' });
    if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return respond(415, { error: 'invalid_request' });
    if (Number(request.headers.get('content-length') ?? 0) > 2048) return respond(413, { error: 'invalid_request' });

    try {
      const user = await deps.authenticate(match[1]);
      if (!user) return respond(401, { error: 'unauthorized' });
      // La taille réelle est bornée aussi pour les requêtes sans Content-Length.
      const reader = request.body?.getReader();
      if (!reader) return respond(400, { error: 'invalid_request' });
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 2048) { await reader.cancel(); return respond(413, { error: 'invalid_request' }); }
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      let body: unknown;
      try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return respond(400, { error: 'invalid_request' }); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return respond(400, { error: 'invalid_request' });
      const password = (body as { password?: unknown }).password;
      if (typeof password !== 'string' || password.length < 1 || password.length > 128 || Object.keys(body).some((key) => key !== 'password')) return respond(400, { error: 'invalid_request' });

      const verified = await deps.verifyPassword(user.email, password);
      if (!verified || verified.id !== user.id) return respond(403, { error: 'invalid_credentials' });
      // Le marqueur est conservé si le nettoyage échoue : aucune synchronisation ne recrée de fichiers.
      await deps.markDeleting(user.id);
      // Cette révocation globale inclut la session créée par la réauthentification.
      await deps.signOutGlobally(match[1]);

      for (let batch = 0; batch <= 20; batch += 1) {
        const files = await deps.listFiles(user.id);
        if (!files.length) {
          await deps.deleteUser(user.id);
          return respond(200, { ok: true });
        }
        if (batch === 20) return respond(503, { error: 'deletion_incomplete' });
        // Le bucket n'admet que uid/uuid.bin. On refuse toute forme inattendue plutôt que traverser.
        if (files.some((file) => !file.id || !FILE.test(file.name))) throw new Error('Unexpected storage entry');
        await deps.removeFiles(files.map((file) => `${user.id}/${file.name}`));
      }
      return respond(503, { error: 'deletion_incomplete' });
    } catch {
      // Aucun jeton, mot de passe, identifiant, nom de fichier ou contenu n'est journalisé.
      return respond(503, { error: 'deletion_unavailable' });
    }
  };
}
