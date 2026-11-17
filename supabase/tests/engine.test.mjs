/**
 * Vrai moteur PostgreSQL WASM, avec seulement les tables Auth/Storage simulées.
 * Ne remplace pas les tests pgTAP sur Supabase ni les tests des API hébergées.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const SA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const db = new PGlite();
const migration = new URL('../migrations/20261116195329_liora_cloud_trial.sql', import.meta.url);
const payload = (changeId = 'change-1') => ({ v: 1, data: { profile: { firstName: 'Fictitious' } }, changeId });
const save = (revision, body = payload()) => db.query('select * from public.liora_save_snapshot($1,$2::jsonb)', [revision, JSON.stringify(body)]);
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];

async function asUser(id, session) {
  await db.exec('set local role authenticated');
  await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: id, role: 'authenticated', session_id: session })]);
}

async function rejectsCode(operation, code) {
  await db.exec('savepoint expected_rejection');
  let error;
  try { await operation(); } catch (caught) { error = caught; }
  await db.exec('rollback to savepoint expected_rejection; release savepoint expected_rejection');
  assert.ok(error, 'La requête aurait dû être refusée');
  assert.equal(error.code, code);
}

before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id) on delete cascade, created_at timestamptz, updated_at timestamptz, not_after timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    grant usage on schema auth,storage to anon,authenticated,service_role;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid() primary key, bucket_id text references storage.buckets(id), name text, metadata jsonb, unique(bucket_id,name));
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
  `);
  await db.exec(await readFile(migration, 'utf8'));
});

beforeEach(async () => {
  await db.exec(`
    begin;
    insert into auth.users(id,email) values ('${A}','a@example.invalid'),('${B}','b@example.invalid');
    insert into auth.sessions(id,user_id) values ('${SA}','${A}'),('${SB}','${B}');
  `);
});
afterEach(async () => { await db.exec('rollback'); });
after(async () => { await db.close(); });

test('SQL : absence de session et accès directs refusés', async () => {
  await db.exec("set local role anon; set local request.jwt.claims='{}'");
  await rejectsCode(() => db.query('select * from public.liora_snapshots'), '42501');
  await rejectsCode(() => save(0), '42501');
  await asUser(A, SA);
  await rejectsCode(() => db.query('insert into public.liora_snapshots(user_id,payload,revision) values ($1,$2,1)', [A, payload()]), '42501');
  await rejectsCode(() => db.query('update public.liora_snapshots set revision=99'), '42501');
  await rejectsCode(() => db.query('delete from public.liora_snapshots'), '42501');
});

test('SQL : deux comptes séparés et réservation atomique de révision', async () => {
  await asUser(A, SA);
  assert.equal((await save(0)).rows[0].revision, 1);
  await rejectsCode(() => save(0), '40001');
  await rejectsCode(() => save(2), '40001');
  assert.equal((await save(1, payload('change-2'))).rows[0].revision, 2);
  await asUser(B, SB);
  assert.equal(await scalar('select count(*)::integer from public.liora_snapshots'), 0);
  assert.equal((await save(0)).rows[0].revision, 1);
  await asUser(A, SA);
  assert.equal(await scalar('select revision from public.liora_snapshots'), 2);
});

test('SQL : charge utile invalide et surcharge refusées', async () => {
  await asUser(A, SA);
  for (const invalid of [null, [], {}, { v: 2, data: {}, changeId: 'x' }, { v: 1, data: {}, changeId: '' }, { v: 1, data: {}, changeId: 'x'.repeat(129) }, { ...payload(), data: 'invalid' }]) {
    await rejectsCode(() => save(0, invalid), '22023');
  }
  await rejectsCode(() => save(-1), '22023');
  await rejectsCode(() => save(0, { ...payload(), data: { text: 'x'.repeat(2097153) } }), '22023');
});

test('SQL : bucket privé, fichiers immuables et isolation malgré une politique globale permissive', async () => {
  assert.equal(await scalar("select public from storage.buckets where id='liora-files'"), false);
  // Vérifie que la politique restrictive protège même un projet ayant déjà d'autres politiques.
  await db.exec('create policy broad_existing_policy on storage.objects for all to authenticated,anon using (true) with check (true)');
  await asUser(A, SA);
  await db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', ['liora-files', `${A}/${SA}.bin`]);
  await rejectsCode(() => db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', ['liora-files', `${B}/${SB}.bin`]), '42501');
  await rejectsCode(() => db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', ['liora-files', `${A}/personal.pdf`]), '42501');
  assert.equal(await scalar('with changed as (update storage.objects set name=name returning id) select count(*)::integer from changed'), 0);
  await asUser(B, SB);
  assert.equal(await scalar("select count(*)::integer from storage.objects where bucket_id='liora-files'"), 0);
  assert.equal(await scalar('with deleted as (delete from storage.objects returning id) select count(*)::integer from deleted'), 0);
  await db.exec("set local role anon; set local request.jwt.claims='{}'");
  assert.equal(await scalar("select count(*)::integer from storage.objects where bucket_id='liora-files'"), 0);
});

test('SQL : un JWT ancien ne suffit pas après révocation ou pendant une suppression', async () => {
  await asUser(A, SA);
  await save(0);
  await db.exec(`reset role; delete from auth.sessions where id='${SA}'`);
  await asUser(A, SA);
  assert.equal(await scalar('select count(*)::integer from public.liora_snapshots'), 0);
  await rejectsCode(() => save(1), '42501');
  await db.exec(`reset role; insert into public.liora_account_deletions(user_id) values ('${B}')`);
  await asUser(B, SB);
  await rejectsCode(() => save(0), '42501');
  await rejectsCode(() => db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', ['liora-files', `${B}/${SB}.bin`]), '42501');
});

test('SQL : une suppression du compte cascade vers ses données et marqueurs', async () => {
  await asUser(A, SA);
  await save(0);
  await db.exec(`reset role; insert into public.liora_account_deletions(user_id) values ('${A}'); delete from auth.users where id='${A}'`);
  assert.equal(await scalar('select count(*)::integer from public.liora_snapshots'), 0);
  assert.equal(await scalar('select count(*)::integer from public.liora_account_deletions'), 0);
});
