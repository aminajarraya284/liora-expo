-- Version d'essai : données fictives uniquement. Aucune clé de service dans l'application.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.liora_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null check (revision >= 1),
  updated_at timestamptz not null default now(),
  constraint liora_snapshot_payload check (
    jsonb_typeof(payload) = 'object'
    and payload ?& array['v', 'data', 'changeId']
    and payload -> 'v' = '1'::jsonb
    and jsonb_typeof(payload -> 'data') = 'object'
    and jsonb_typeof(payload -> 'changeId') = 'string'
    and char_length(payload ->> 'changeId') between 1 and 128
    and octet_length(convert_to(payload::text, 'UTF8')) <= 2097152
  )
);

-- Une suppression commencée bloque de nouvelles écritures pendant le nettoyage Storage.
create table public.liora_account_deletions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table public.liora_snapshots enable row level security;
alter table public.liora_snapshots force row level security;
alter table public.liora_account_deletions enable row level security;
alter table public.liora_account_deletions force row level security;
revoke all on public.liora_snapshots from public, anon, authenticated;
revoke all on public.liora_account_deletions from public, anon, authenticated;
grant select on public.liora_snapshots to authenticated;
grant select, insert, update, delete on public.liora_snapshots, public.liora_account_deletions to service_role;

-- Un JWT non expiré ne suffit pas après déconnexion globale ou suppression.
create function private.liora_user_active()
returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session text := auth.jwt() ->> 'session_id';
begin
  if v_uid is null or v_session is null
    or v_session !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true'
  then
    return false;
  end if;
  return exists (select 1 from auth.users u where u.id = v_uid)
    and exists (
      select 1 from auth.sessions s
      where s.id = v_session::uuid and s.user_id = v_uid
        and (s.not_after is null or s.not_after > now())
    )
    and not exists (select 1 from public.liora_account_deletions d where d.user_id = v_uid);
end;
$$;
revoke all on function private.liora_user_active() from public, anon;
grant execute on function private.liora_user_active() to authenticated;

create policy liora_snapshot_read_own on public.liora_snapshots
for select to authenticated
using (user_id = (select auth.uid()) and (select private.liora_user_active()));

-- La fonction privilégiée reste hors du schéma exposé et impose elle-même l'identité.
create function private.liora_save_snapshot(p_expected_revision bigint, p_payload jsonb)
returns table(revision bigint, updated_at timestamptz)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_revision bigint;
  v_updated_at timestamptz;
begin
  if not private.liora_user_active() then
    raise exception using errcode = '42501', message = 'Account session unavailable';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'Invalid expected revision';
  end if;
  if p_payload is null
    or jsonb_typeof(p_payload) is distinct from 'object'
    or p_payload -> 'v' is distinct from '1'::jsonb
    or jsonb_typeof(p_payload -> 'data') is distinct from 'object'
    or jsonb_typeof(p_payload -> 'changeId') is distinct from 'string'
    or char_length(p_payload ->> 'changeId') not between 1 and 128
    or octet_length(convert_to(p_payload::text, 'UTF8')) > 2097152
  then
    raise exception using errcode = '22023', message = 'Invalid snapshot payload';
  end if;

  if p_expected_revision = 0 then
    insert into public.liora_snapshots as snapshot(user_id, payload, revision, updated_at)
    values (v_uid, p_payload, 1, now())
    on conflict (user_id) do nothing
    returning snapshot.revision, snapshot.updated_at into v_revision, v_updated_at;
  else
    update public.liora_snapshots as snapshot
    set payload = p_payload, revision = snapshot.revision + 1, updated_at = now()
    where snapshot.user_id = v_uid and snapshot.revision = p_expected_revision
    returning snapshot.revision, snapshot.updated_at into v_revision, v_updated_at;
  end if;
  if not found then
    raise exception using errcode = '40001', message = 'Snapshot revision conflict';
  end if;
  return query select v_revision, v_updated_at;
end;
$$;
revoke all on function private.liora_save_snapshot(bigint, jsonb) from public, anon;
grant execute on function private.liora_save_snapshot(bigint, jsonb) to authenticated;

-- Seul ce wrapper SECURITY INVOKER est exposé par PostgREST.
create function public.liora_save_snapshot(p_expected_revision bigint, p_payload jsonb)
returns table(revision bigint, updated_at timestamptz)
language sql security invoker
set search_path = ''
as $$
  select * from private.liora_save_snapshot(p_expected_revision, p_payload);
$$;
revoke all on function public.liora_save_snapshot(bigint, jsonb) from public, anon;
grant execute on function public.liora_save_snapshot(bigint, jsonb) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('liora-files', 'liora-files', false, 20971520, array['application/octet-stream'])
on conflict (id) do update
set public = false, file_size_limit = 20971520, allowed_mime_types = array['application/octet-stream'];

create policy liora_files_read_own on storage.objects
for select to authenticated
using (
  bucket_id = 'liora-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.liora_user_active())
);
create policy liora_files_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'liora-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.bin$'
  and (select private.liora_user_active())
);
create policy liora_files_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'liora-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.liora_user_active())
);
-- Aucune politique UPDATE : les objets sont immuables (upsert=false).

-- Des politiques existantes sur d'autres buckets ne doivent pas ouvrir celui-ci.
create policy liora_files_guard_read on storage.objects
as restrictive for select to authenticated
using (
  bucket_id <> 'liora-files'
  or ((storage.foldername(name))[1] = (select auth.uid())::text and (select private.liora_user_active()))
);
create policy liora_files_guard_insert on storage.objects
as restrictive for insert to authenticated
with check (
  bucket_id <> 'liora-files'
  or (
    (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.bin$'
    and (select private.liora_user_active())
  )
);
create policy liora_files_guard_update on storage.objects
as restrictive for update to authenticated
using (bucket_id <> 'liora-files')
with check (bucket_id <> 'liora-files');
create policy liora_files_guard_delete on storage.objects
as restrictive for delete to authenticated
using (
  bucket_id <> 'liora-files'
  or ((storage.foldername(name))[1] = (select auth.uid())::text and (select private.liora_user_active()))
);
create policy liora_files_guard_anon on storage.objects
as restrictive for all to anon
using (bucket_id <> 'liora-files')
with check (bucket_id <> 'liora-files');
