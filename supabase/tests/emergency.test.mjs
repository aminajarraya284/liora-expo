/** Exécute les migrations réelles dans PostgreSQL WASM ; Auth/Storage sont simulés. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const OWNER = '11111111-1111-4111-8111-111111111111';
const GUEST = '22222222-2222-4222-8222-222222222222';
const THIRD = '33333333-3333-4333-8333-333333333333';
const OWNER_SESSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GUEST_SESSION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const THIRD_SESSION = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const KEY = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const HASH = 'a'.repeat(64);
const FIRST_FILE = `${OWNER}/${OWNER_SESSION}.bin`;
const SECOND_FILE = `${OWNER}/${GUEST_SESSION}.bin`;
const db = new PGlite();
const value = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const list = () => value('select public.liora_emergency_list()');
const create = (ids = ['mutuelle'], email = 'guest@example.invalid', id = KEY, hash = HASH) => value(
  'select public.liora_emergency_create($1,$2,$3,$4,$5)', [id, 'proche-1', email, ids, hash],
);
const request = (hash = HASH, reason = 'Hospitalisation, besoin de la mutuelle') => value('select public.liora_emergency_request($1,$2)', [hash, reason]);
const documents = (id) => value('select public.liora_emergency_documents($1)', [id]);
const decide = (id, decision) => value('select public.liora_emergency_decide($1,$2)', [id, decision]);
const files = async (operation = 'object.get_authenticated') => {
  await db.query("select set_config('storage.operation',$1,true)", [operation]);
  return db.query('select name from storage.objects order by name');
};

async function asUser(id = OWNER, session = OWNER_SESSION) {
  await db.exec('set local role authenticated');
  await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: id, session_id: session })]);
}
async function rejectsCode(operation, code = '42501') {
  await db.exec('savepoint rejected');
  let error;
  try { await operation(); } catch (caught) { error = caught; }
  await db.exec('rollback to savepoint rejected; release savepoint rejected');
  assert.ok(error, 'La requête aurait dû être refusée');
  assert.equal(error.code, code);
}
async function setupRequest() {
  await asUser();
  await create();
  await asUser(GUEST, GUEST_SESSION);
  return request();
}
async function setWindow(opens, expires) {
  await db.exec('reset role');
  await db.query('update private.liora_emergency_requests set opens_at=now()+$1::interval,expires_at=now()+$2::interval', [opens, expires]);
  await asUser(GUEST, GUEST_SESSION);
}

before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    grant usage on schema auth,storage to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    create function storage.allow_only_operation(operation text) returns boolean language sql stable as $$ select coalesce(current_setting('storage.operation',true),'')=operation $$;
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
  `);
  for (const migration of ['20261116195329_liora_cloud_trial.sql', '20261117211538_liora_emergency_keys.sql']) {
    await db.exec(await readFile(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'));
  }
});
beforeEach(async () => {
  await db.exec(`
    begin;
    insert into auth.users(id,email,email_confirmed_at) values
      ('${OWNER}','owner@example.invalid',now()),('${GUEST}','guest@example.invalid',now()),('${THIRD}','third@example.invalid',now());
    insert into auth.sessions(id,user_id) values ('${OWNER_SESSION}','${OWNER}'),('${GUEST_SESSION}','${GUEST}'),('${THIRD_SESSION}','${THIRD}');
    insert into storage.objects(bucket_id,name) values ('liora-files','${FIRST_FILE}'),('liora-files','${SECOND_FILE}');
  `);
  const payload = { v: 1, changeId: 'initial', data: {
    profile: { firstName: 'Marie', lastName: 'Exemple', email: 'private@example.invalid', phone: 'secret' },
    proches: [{ id: 'proche-1', name: 'Camille Exemple' }],
    docs: [
      { id: 'mutuelle', name: 'Mutuelle', kind: 'PDF', size: 120, date: '2026-11-17', uri: `cloud:${FIRST_FILE}` },
      { id: 'secret', name: 'Personnel', kind: 'PDF', size: 140, date: '2026-11-17', uri: `cloud:${SECOND_FILE}` },
    ],
    notes: [{ text: 'journal secret' }],
  } };
  await db.query('insert into public.liora_snapshots(user_id,payload,revision) values ($1,$2,1)', [OWNER, payload]);
});
afterEach(async () => { await db.exec('rollback'); });
after(async () => { await db.close(); });

test('la création exige session, proche, documents synchronisés et empreinte valide', async () => {
  await db.exec("set local role anon; set local request.jwt.claims='{}'");
  await rejectsCode(() => create());
  await asUser();
  await rejectsCode(() => create([], 'guest@example.invalid'), '22023');
  await rejectsCode(() => create(['missing']), '22023');
  await rejectsCode(() => create(['mutuelle', 'mutuelle']), '22023');
  await rejectsCode(() => create(['mutuelle'], 'owner@example.invalid'), '22023');
  await rejectsCode(() => create(['mutuelle'], 'guest@example.invalid', KEY, '123456'), '22023');
  const key = await create();
  assert.equal(key.procheName, 'Camille Exemple');
  assert.deepEqual(key.documentIds, ['mutuelle']);
  assert.ok(!('codeHash' in key));
  assert.deepEqual(await create(), key, 'Un nouvel essai après réponse perdue conserve la même clé');
  await asUser(THIRD, THIRD_SESSION);
  await rejectsCode(() => create(), '22023');
  assert.deepEqual((await list()).keys, []);
});

test('seul le destinataire confirmé peut utiliser le code, avec limitation persistante', async () => {
  await asUser();
  await create();
  await asUser(THIRD, THIRD_SESSION);
  assert.deepEqual(await request(), { error: 'INVALID_KEY' });
  await asUser(GUEST, GUEST_SESSION);
  await db.exec(`reset role; update auth.users set email_confirmed_at=null where id='${GUEST}'`);
  await asUser(GUEST, GUEST_SESSION);
  assert.deepEqual(await request(), { error: 'INVALID_KEY' });
  await db.exec(`reset role; update auth.users set email_confirmed_at=now() where id='${GUEST}'`);
  await asUser(GUEST, GUEST_SESSION);
  for (let attempt = 0; attempt < 4; attempt += 1) assert.deepEqual(await request('b'.repeat(64)), { error: 'INVALID_KEY' });
  assert.deepEqual(await request(), { error: 'RATE_LIMITED' });
  await db.exec(`reset role; update private.liora_emergency_attempts set window_at=now()-interval '61 seconds' where user_id='${GUEST}'`);
  await asUser(GUEST, GUEST_SESSION);
  assert.equal((await request()).status, 'waiting');
});

test('la demande est idempotente et apparaît immédiatement au propriétaire', async () => {
  const first = await setupRequest();
  const second = await request(HASH, 'Nouvelle justification');
  assert.equal(second.id, first.id);
  assert.equal(second.reason, first.reason);
  assert.equal(Date.parse(first.opensAt) - Date.parse(first.requestedAt), 48 * 3600000);
  assert.equal(Date.parse(first.expiresAt) - Date.parse(first.opensAt), 24 * 3600000);
  assert.equal(first.role, 'recipient');
  assert.equal(first.ownerName, 'Marie Exemple');
  await asUser();
  const owner = await list();
  assert.equal(owner.requests[0].id, first.id);
  assert.equal(owner.requests[0].role, 'owner');
  assert.ok(Number.isFinite(Date.parse(owner.serverNow)));
  await asUser(THIRD, THIRD_SESSION);
  assert.deepEqual((await list()).requests, []);
  await rejectsCode(() => documents(first.id));
  await rejectsCode(() => decide(first.id, 'approve'));
});

test('48 heures bloquent les documents, puis seuls les documents choisis deviennent lisibles pendant 24 heures', async () => {
  const req = await setupRequest();
  await rejectsCode(() => documents(req.id));
  assert.equal((await files()).rows.length, 0);
  await setWindow('1 second', '24 hours');
  await rejectsCode(() => documents(req.id));
  await setWindow('0 seconds', '24 hours');
  const access = await documents(req.id);
  assert.deepEqual(access.documents, [{ id: 'mutuelle', name: 'Mutuelle', kind: 'PDF', size: 120, date: '2026-11-17', path: FIRST_FILE }]);
  assert.ok(!('profile' in access));
  assert.deepEqual((await files()).rows, [{ name: FIRST_FILE }]);
  for (const operation of ['object.sign', 'object.sign_many', 'object.list', 'object.copy', '']) {
    assert.equal((await files(operation)).rows.length, 0, `L'opération ${operation} est refusée`);
  }
  assert.equal(await value('select count(*)::integer from public.liora_snapshots'), 0);
  await setWindow('-24 hours', '0 seconds');
  assert.equal((await list()).requests[0].status, 'expired');
  await rejectsCode(() => documents(req.id));
  assert.equal((await files()).rows.length, 0);
  assert.equal((await request()).id, req.id, 'Le code ne redémarre pas le délai après expiration');
});

test('approbation précoce, refus et révocation ne peuvent pas prolonger ou ressusciter l’accès', async () => {
  const req = await setupRequest();
  await asUser();
  await decide(req.id, 'approve');
  const active = (await list()).requests[0];
  assert.equal(active.status, 'active');
  assert.equal(Date.parse(active.expiresAt) - Date.parse(active.opensAt), 24 * 3600000);
  await decide(req.id, 'approve');
  assert.deepEqual((await list()).requests[0], active);
  await asUser(GUEST, GUEST_SESSION);
  assert.equal((await documents(req.id)).documents.length, 1);
  await asUser();
  await decide(req.id, 'deny');
  await rejectsCode(() => decide(req.id, 'approve'), '22023');
  await asUser(GUEST, GUEST_SESSION);
  assert.equal((await request()).status, 'denied');
  await rejectsCode(() => documents(req.id));
  await asUser();
  await value('select public.liora_emergency_revoke($1)', [KEY]);
  await value('select public.liora_emergency_revoke($1)', [KEY]);
  await asUser(GUEST, GUEST_SESSION);
  assert.deepEqual(await request(), { error: 'INVALID_KEY' });
  assert.equal((await files()).rows.length, 0);
});

test('les politiques globales permissives ne donnent aucun droit d’écriture ni accès à un autre document', async () => {
  const req = await setupRequest();
  await setWindow('0 seconds', '24 hours');
  await db.exec('reset role; create policy broad_policy on storage.objects for all to authenticated,anon using(true) with check(true)');
  await asUser(GUEST, GUEST_SESSION);
  assert.equal((await documents(req.id)).documents.length, 1);
  assert.deepEqual((await files()).rows, [{ name: FIRST_FILE }]);
  assert.equal(await value('with changed as(update storage.objects set name=name returning id) select count(*)::integer from changed'), 0);
  assert.equal(await value('with deleted as(delete from storage.objects returning id) select count(*)::integer from deleted'), 0);
  await rejectsCode(() => db.query('insert into storage.objects(bucket_id,name) values($1,$2)', ['liora-files', `${OWNER}/${THIRD_SESSION}.bin`]));
  for (const table of ['liora_emergency_keys', 'liora_emergency_requests', 'liora_emergency_attempts']) {
    await rejectsCode(() => db.query(`select * from private.${table}`));
    await rejectsCode(() => db.query(`delete from private.${table}`));
  }
  await db.exec("set local role anon; set local request.jwt.claims='{}'");
  assert.equal((await files()).rows.length, 0);
  await rejectsCode(() => list());
});

test('le retrait d’un proche ou d’un document coupe l’accès', async () => {
  const req = await setupRequest();
  await setWindow('0 seconds', '24 hours');
  await db.exec(`reset role; update public.liora_snapshots set payload=jsonb_set(payload,'{data,proches}','[]') where user_id='${OWNER}'`);
  await asUser(GUEST, GUEST_SESSION);
  assert.equal((await list()).requests[0].status, 'revoked');
  await rejectsCode(() => documents(req.id));
  assert.equal((await files()).rows.length, 0);
  await db.exec(`reset role; update public.liora_snapshots set payload=jsonb_set(jsonb_set(payload,'{data,proches}','[{"id":"proche-1","name":"Camille"}]'),'{data,docs}','[]') where user_id='${OWNER}'`);
  await asUser(GUEST, GUEST_SESSION);
  await rejectsCode(() => documents(req.id));
  await asUser();
  assert.ok((await list()).keys[0].revokedAt);
});

test('une session révoquée et un changement d’adresse du destinataire suppriment l’accès', async () => {
  const req = await setupRequest();
  await setWindow('0 seconds', '24 hours');
  await db.exec(`reset role; update auth.users set email='changed@example.invalid' where id='${GUEST}'`);
  await asUser(GUEST, GUEST_SESSION);
  await rejectsCode(() => documents(req.id));
  assert.equal((await files()).rows.length, 0);
  await db.exec(`reset role; update auth.users set email='guest@example.invalid' where id='${GUEST}'; delete from auth.sessions where id='${GUEST_SESSION}'`);
  await asUser(GUEST, GUEST_SESSION);
  await rejectsCode(() => list());
  await rejectsCode(() => documents(req.id));
  assert.equal((await files()).rows.length, 0);
});

test('suppression de compte et suppression en cours invalident les clés', async () => {
  const req = await setupRequest();
  await setWindow('0 seconds', '24 hours');
  await db.exec(`reset role; insert into public.liora_account_deletions(user_id) values('${OWNER}')`);
  await asUser(GUEST, GUEST_SESSION);
  await rejectsCode(() => documents(req.id));
  assert.equal((await files()).rows.length, 0);
  await db.exec(`reset role; delete from auth.users where id='${GUEST}'`);
  assert.equal(await value('select count(*)::integer from private.liora_emergency_keys'), 0);
  assert.equal(await value('select count(*)::integer from private.liora_emergency_requests'), 0);
  assert.equal(await value('select count(*)::integer from private.liora_emergency_attempts'), 0);
});
