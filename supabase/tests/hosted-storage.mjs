import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

function setting(name) {
  const value = process.env[name];
  assert.ok(value, `Variable d’essai manquante : ${name}`);
  return value;
}

// This opt-in test uses only confirmed trial accounts and their own permissions.
test('Supabase hébergé : deux sessions du propriétaire et un autre compte', async (t) => {
  const url = setting('EXPO_PUBLIC_SUPABASE_URL');
  const key = setting('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  assert.ok(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url), 'URL du projet Supabase d’essai attendue');
  assert.ok(key.startsWith('sb_publishable_'), 'Clé publique attendue');
  const ownerEmail = setting('LIORA_TEST_OWNER_EMAIL');
  const ownerPassword = setting('LIORA_TEST_OWNER_PASSWORD');
  const otherEmail = setting('LIORA_TEST_OTHER_EMAIL');
  const otherPassword = setting('LIORA_TEST_OTHER_PASSWORD');
  assert.notEqual(ownerEmail.trim().toLowerCase(), otherEmail.trim().toLowerCase(), 'Deux comptes distincts sont nécessaires');

  const sessions = [];
  const files = [];
  t.after(async () => {
    const errors = [];
    for (const { session, path } of files) {
      try {
        const { data, error } = await session.bucket.remove([path]);
        if (error || !data?.length) errors.push('Vérifier le nettoyage du fichier fictif ' + path);
      } catch { errors.push('Vérifier le nettoyage du fichier fictif ' + path); }
    }
    for (const client of sessions) {
      try {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) errors.push('Fermeture de la session de test à vérifier');
      } catch { errors.push('Fermeture de la session de test à vérifier'); }
    }
    assert.equal(errors.length, 0, errors.join('\n'));
  });

  async function login(email, password) {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    assert.ok(!error && data.session && data.user, 'Connexion du compte fictif impossible');
    sessions.push(client);
    return { id: data.user.id, token: data.session.access_token, bucket: client.storage.from('liora-files') };
  }

  async function upload(session) {
    const path = `${session.id}/${randomUUID()}.bin`;
    const bytes = Buffer.from('Document fictif Liora ' + randomUUID());
    files.push({ session, path });
    const { error } = await session.bucket.upload(path, bytes, { contentType: 'application/octet-stream', upsert: false });
    assert.ok(!error, 'Échec de l’envoi du document fictif');
    return { path, bytes };
  }

  function download(session, path) {
    return fetch(new URL('/storage/v1/object/authenticated/liora-files/' + path, url), {
      headers: { apikey: key, Authorization: 'Bearer ' + session.token },
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30_000),
    });
  }

  const first = await login(ownerEmail, ownerPassword);
  const second = await login(ownerEmail, ownerPassword);
  const other = await login(otherEmail, otherPassword);
  assert.equal(first.id, second.id);
  assert.notEqual(first.id, other.id);
  const ownerDoc = await upload(first);
  const otherDoc = await upload(other);
  for (const [session, doc] of [[second, ownerDoc], [other, otherDoc]]) {
    const response = await download(session, doc.path);
    assert.equal(response.status, 200, 'Lecture du fichier du compte');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), doc.bytes);
  }
  for (const [session, doc] of [[other, ownerDoc], [second, otherDoc]]) {
    const response = await download(session, doc.path);
    const error = await response.json().catch(() => ({}));
    // Storage sometimes wraps its 403/404 in an HTTP 400. A generic failure is insufficient.
    assert.ok([403, 404].includes(response.status) ||
      (response.status === 400 && ['403', '404'].includes(String(error?.statusCode))),
    'Le stockage doit refuser ou masquer le document de l’autre compte');
  }
});
