import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDeleteAccountHandler, type DeleteAccountDependencies } from './handler.ts';

const UID = '11111111-1111-4111-8111-111111111111';
const FILE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.bin';
const req = (body: unknown = { password: 'FakePassword123' }, headers: Record<string, string> = {}) => new Request('https://example.invalid/delete-account', {
  method: 'POST', headers: { Authorization: 'Bearer fake-user-jwt', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});

function fixture(overrides: Partial<DeleteAccountDependencies> = {}) {
  const calls: string[] = [];
  let listed = false;
  const deps: DeleteAccountDependencies = {
    authenticate: async () => ({ id: UID, email: 'fake@example.invalid' }),
    verifyPassword: async () => ({ id: UID }),
    markDeleting: async (id) => { calls.push(`mark:${id}`); },
    signOutGlobally: async (jwt) => { calls.push(`logout:${jwt}`); },
    listFiles: async (prefix) => { calls.push(`list:${prefix}`); if (listed) return []; listed = true; return [{ id: 'file-id', name: FILE }]; },
    removeFiles: async (paths) => { calls.push(`remove:${paths.join(',')}`); },
    deleteUser: async (id) => { calls.push(`delete:${id}`); },
    ...overrides,
  };
  return { calls, handle: createDeleteAccountHandler(deps) };
}

test('suppression : identité validée, mot de passe revérifié, sessions révoquées avant suppression', async () => {
  const { handle, calls } = fixture();
  const response = await handle(req());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(calls, [`mark:${UID}`, 'logout:fake-user-jwt', `list:${UID}`, `remove:${UID}/${FILE}`, `list:${UID}`, `delete:${UID}`]);
});

test('sans utilisateur valide, aucun privilège administratif utilisé', async () => {
  const { handle, calls } = fixture({ authenticate: async () => null });
  assert.equal((await handle(req())).status, 401);
  assert.deepEqual(calls, []);
  assert.equal((await handle(req({}, { Authorization: '' }))).status, 401);
});

test('mot de passe incorrect ou identité différente : aucune suppression', async () => {
  for (const answer of [null, { id: 'another-user' }]) {
    const { handle, calls } = fixture({ verifyPassword: async () => answer });
    assert.equal((await handle(req())).status, 403);
    assert.deepEqual(calls, []);
  }
});

test('un user_id envoyé par le client et les corps trop grands sont refusés', async () => {
  const { handle, calls } = fixture();
  assert.equal((await handle(req({ password: 'FakePassword123', user_id: 'victim' }))).status, 400);
  assert.equal((await handle(req({ password: 'x'.repeat(3000) }))).status, 413);
  assert.deepEqual(calls, []);
});

test('une panne de révocation ou de Storage conserve le compte et masque les détails', async () => {
  for (const overrides of [
    { signOutGlobally: async () => { throw new Error('secret internal error'); } },
    { removeFiles: async () => { throw new Error('secret storage error'); } },
  ]) {
    const { handle, calls } = fixture(overrides);
    const response = await handle(req());
    assert.equal(response.status, 503);
    assert.equal((await response.text()).includes('secret'), false);
    assert.equal(calls.some((call) => call.startsWith('delete:')), false);
  }
});

test('un chemin de stockage inattendu ne peut pas traverser vers un autre utilisateur', async () => {
  const { handle, calls } = fixture({ listFiles: async () => [{ id: 'file', name: '../other-user/file.bin' }] });
  assert.equal((await handle(req())).status, 503);
  assert.equal(calls.some((call) => call.startsWith('remove:') || call.startsWith('delete:')), false);
});

test('un nettoyage qui ne se termine pas est signalé comme incomplet', async () => {
  const { handle, calls } = fixture({ listFiles: async () => [{ id: 'file', name: FILE }] });
  const response = await handle(req());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'deletion_incomplete' });
  assert.equal(calls.some((call) => call.startsWith('delete:')), false);
});
