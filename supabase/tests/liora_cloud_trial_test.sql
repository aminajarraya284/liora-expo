-- Exécuter uniquement dans un projet d'essai/local : toutes les écritures sont annulées.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id, email, email_confirmed_at)
values
  ('11111111-1111-4111-8111-111111111111', 'liora-a@example.invalid', now()),
  ('22222222-2222-4222-8222-222222222222', 'liora-b@example.invalid', now());
insert into auth.sessions(id, user_id, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', now(), now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', now(), now());

select has_table('public', 'liora_snapshots', 'La table des comptes existe');
select ok((select relrowsecurity from pg_class where oid = 'public.liora_snapshots'::regclass), 'RLS activée');
select ok(not has_table_privilege('authenticated', 'public.liora_snapshots', 'INSERT,UPDATE,DELETE'), 'Aucune écriture directe sur les snapshots');
select ok(not has_function_privilege('anon', 'public.liora_save_snapshot(bigint,jsonb)', 'EXECUTE'), 'RPC interdite à anon');
select ok(has_function_privilege('authenticated', 'public.liora_save_snapshot(bigint,jsonb)', 'EXECUTE'), 'RPC disponible aux utilisateurs authentifiés');
select ok(not has_table_privilege('authenticated', 'public.liora_account_deletions', 'INSERT'), 'Le marqueur de suppression est réservé au serveur');
select is((select public from storage.buckets where id = 'liora-files'), false, 'Bucket privé');
select is((select file_size_limit from storage.buckets where id = 'liora-files'), 20971520::bigint, 'Fichiers limités à 20 Mio');
select is((select allowed_mime_types from storage.buckets where id = 'liora-files'), array['application/octet-stream'], 'Types de fichiers bornés');

set local role anon;
set local request.jwt.claims = '{}';
select throws_ok('select * from public.liora_snapshots', '42501', null::text, 'Sans session : lecture interdite');
select throws_ok($q$select * from public.liora_save_snapshot(0, '{"v":1,"data":{},"changeId":"a1"}'::jsonb)$q$, '42501', null::text, 'Sans session : écriture interdite');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}';
select is((select revision from public.liora_save_snapshot(0, '{"v":1,"data":{"profile":{"firstName":"Test A"}},"changeId":"a1"}'::jsonb)), 1::bigint, 'A crée uniquement son snapshot');
select is((select count(*) from public.liora_snapshots), 1::bigint, 'A voit son snapshot');
select throws_ok($q$insert into public.liora_snapshots(user_id,payload,revision) values ('22222222-2222-4222-8222-222222222222','{}',1)$q$, '42501', null::text, 'INSERT direct interdit');
select throws_ok($q$update public.liora_snapshots set revision=999$q$, '42501', null::text, 'UPDATE direct interdit');
select throws_ok($q$delete from public.liora_snapshots$q$, '42501', null::text, 'DELETE direct interdit');
select throws_ok($q$select * from public.liora_save_snapshot(0, '{"v":1,"data":{},"changeId":"a2"}'::jsonb)$q$, '40001', null::text, 'La création concurrente ne remplace pas le snapshot existant');
select throws_ok($q$select * from public.liora_save_snapshot(2, '{"v":1,"data":{},"changeId":"a2"}'::jsonb)$q$, '40001', null::text, 'Révision obsolète refusée');
select is((select revision from public.liora_save_snapshot(1, '{"v":1,"data":{"profile":{"firstName":"Test A2"}},"changeId":"a2"}'::jsonb)), 2::bigint, 'Révision attendue incrémentée exactement une fois');
select throws_ok($q$select * from public.liora_save_snapshot(-1, '{"v":1,"data":{},"changeId":"a3"}'::jsonb)$q$, '22023', null::text, 'Révision négative refusée');
select throws_ok($q$select * from public.liora_save_snapshot(2, '{"v":1,"data":{}}'::jsonb)$q$, '22023', null::text, 'Identifiant de changement obligatoire');
select throws_ok($q$select * from public.liora_save_snapshot(2, '{"v":2,"data":{},"changeId":"a3"}'::jsonb)$q$, '22023', null::text, 'Version inconnue refusée');
select throws_ok($q$select * from public.liora_save_snapshot(2, jsonb_build_object('v',1,'data',jsonb_build_object('oversized',repeat('x',2097153)),'changeId','a3'))$q$, '22023', null::text, 'Snapshot de plus de 2 Mio refusé');

set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","session_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}';
select is((select count(*) from public.liora_snapshots), 0::bigint, 'B ne voit pas les informations de A');
select is((select revision from public.liora_save_snapshot(0, '{"v":1,"data":{},"changeId":"b1"}'::jsonb)), 1::bigint, 'B crée son propre snapshot');
select lives_ok($q$insert into storage.objects(bucket_id,name) values ('liora-files','22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.bin')$q$, 'B peut ajouter son fichier');
select throws_ok($q$insert into storage.objects(bucket_id,name) values ('liora-files','11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.bin')$q$, '42501', null::text, 'B ne peut pas écrire dans le dossier de A');
select throws_ok($q$insert into storage.objects(bucket_id,name) values ('liora-files','22222222-2222-4222-8222-222222222222/personal-name.pdf')$q$, '42501', null::text, 'Les chemins ne contiennent que des UUID opaques');
select is((select count(*) from storage.objects where bucket_id = 'liora-files'), 1::bigint, 'B ne lit que ses fichiers');
select is((with changed as (update storage.objects set name = '22222222-2222-4222-8222-222222222222/cccccccc-cccc-4ccc-8ccc-cccccccccccc.bin' where bucket_id = 'liora-files' returning id) select count(*) from changed), 0::bigint, 'Aucun remplacement de fichier existant');

set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}';
select is((select revision from public.liora_snapshots), 2::bigint, 'Le travail de B ne modifie pas A');
select is((select count(*) from storage.objects where bucket_id = 'liora-files'), 0::bigint, 'A ne lit pas le fichier de B');
select is((with deleted as (delete from storage.objects where bucket_id = 'liora-files' returning id) select count(*) from deleted), 0::bigint, 'A ne supprime pas le fichier de B');
select lives_ok($q$insert into storage.objects(bucket_id,name) values ('liora-files','11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.bin')$q$, 'A peut ajouter son fichier');
select is((with deleted as (delete from storage.objects where bucket_id = 'liora-files' returning id) select count(*) from deleted), 1::bigint, 'A peut supprimer son propre fichier');

set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok($q$select * from public.liora_save_snapshot(2, '{"v":1,"data":{},"changeId":"a3"}'::jsonb)$q$, '42501', null::text, 'Pas de session_id : accès refusé');
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}';
reset role;
delete from auth.sessions where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select is((select count(*) from public.liora_snapshots), 0::bigint, 'Un ancien JWT ne lit rien après révocation de la session');
select throws_ok($q$select * from public.liora_save_snapshot(2, '{"v":1,"data":{},"changeId":"a3"}'::jsonb)$q$, '42501', null::text, 'Un ancien JWT ne modifie rien après révocation');

reset role;
insert into public.liora_account_deletions(user_id) values ('22222222-2222-4222-8222-222222222222');
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","session_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}';
select is((select count(*) from public.liora_snapshots), 0::bigint, 'Une suppression commencée bloque la lecture');
select throws_ok($q$insert into storage.objects(bucket_id,name) values ('liora-files','22222222-2222-4222-8222-222222222222/cccccccc-cccc-4ccc-8ccc-cccccccccccc.bin')$q$, '42501', null::text, 'Une suppression commencée bloque les nouveaux fichiers');
reset role;
delete from auth.users where id = '11111111-1111-4111-8111-111111111111';
select is((select count(*) from public.liora_snapshots where user_id = '11111111-1111-4111-8111-111111111111'), 0::bigint, 'Supprimer le compte supprime son snapshot');

select * from finish();
rollback;
