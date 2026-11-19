-- Clé d'urgence d'essai. L'autorisation porte uniquement sur les documents cochés.
create table private.liora_emergency_keys (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  proche_id text not null,
  proche_name text not null,
  recipient_email text not null,
  recipient_id uuid references auth.users(id) on delete cascade,
  document_ids text[] not null,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (cardinality(document_ids) between 1 and 20)
);
create index liora_emergency_keys_owner on private.liora_emergency_keys(owner_id);
create table private.liora_emergency_requests (
  id uuid primary key default gen_random_uuid(),
  key_id uuid not null unique references private.liora_emergency_keys(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  requested_at timestamptz not null default now(),
  opens_at timestamptz not null default (now() + interval '48 hours'),
  expires_at timestamptz not null default (now() + interval '72 hours'),
  denied_at timestamptz,
  approved_at timestamptz,
  check (char_length(reason) between 1 and 500),
  check (expires_at > opens_at)
);
create index liora_emergency_requests_recipient on private.liora_emergency_requests(recipient_id);
create table private.liora_emergency_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_at timestamptz not null,
  attempts integer not null
);
alter table private.liora_emergency_keys enable row level security;
alter table private.liora_emergency_keys force row level security;
alter table private.liora_emergency_requests enable row level security;
alter table private.liora_emergency_requests force row level security;
alter table private.liora_emergency_attempts enable row level security;
alter table private.liora_emergency_attempts force row level security;
revoke all on private.liora_emergency_keys, private.liora_emergency_requests, private.liora_emergency_attempts from public, anon, authenticated;

-- Le retrait du proche ou d'un document annule aussi l'autorisation existante.
create function private.liora_emergency_key_valid(p_key private.liora_emergency_keys)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_key.revoked_at is null
    and exists (select 1 from auth.users u where u.id = p_key.owner_id)
    and not exists (select 1 from public.liora_account_deletions d where d.user_id = p_key.owner_id)
    and exists (
      select 1 from public.liora_snapshots s
      where s.user_id = p_key.owner_id
        and exists (select 1 from jsonb_array_elements(coalesce(s.payload->'data'->'proches', '[]'::jsonb)) p where p->>'id' = p_key.proche_id)
        and not exists (
          select 1 from unnest(p_key.document_ids) wanted(id)
          where not exists (
            select 1 from jsonb_array_elements(coalesce(s.payload->'data'->'docs', '[]'::jsonb)) d
            where d->>'id' = wanted.id
              and d->>'uri' ~ ('^cloud:' || p_key.owner_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.bin$')
          )
        )
    );
$$;

create function private.liora_emergency_status(p_key private.liora_emergency_keys, p_request private.liora_emergency_requests)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when not private.liora_emergency_key_valid(p_key) then 'revoked'
    when p_request.denied_at is not null then 'denied'
    when now() >= p_request.expires_at then 'expired'
    when now() >= p_request.opens_at then 'active'
    else 'waiting'
  end;
$$;

create function private.liora_emergency_key_json(p_key private.liora_emergency_keys)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id',p_key.id,'procheId',p_key.proche_id,'procheName',p_key.proche_name,
    'recipientEmail',p_key.recipient_email,'documentIds',p_key.document_ids,
    'createdAt',p_key.created_at,'revokedAt',p_key.revoked_at);
$$;

create function private.liora_emergency_request_json(p_key private.liora_emergency_keys, p_request private.liora_emergency_requests)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',p_request.id,'keyId',p_key.id,
    'ownerName',coalesce((select concat_ws(' ',s.payload->'data'->'profile'->>'firstName',s.payload->'data'->'profile'->>'lastName') from public.liora_snapshots s where s.user_id=p_key.owner_id),''),
    'procheName',p_key.proche_name,'reason',p_request.reason,'requestedAt',p_request.requested_at,
    'opensAt',p_request.opens_at,'expiresAt',p_request.expires_at,
    'status',private.liora_emergency_status(p_key,p_request),
    'role',case when auth.uid()=p_key.owner_id then 'owner' else 'recipient' end);
$$;

create function private.liora_emergency_create(p_id uuid,p_proche_id text,p_recipient_email text,p_document_ids text[],p_code_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(p_recipient_email));
  v_key private.liora_emergency_keys;
  v_snapshot jsonb;
  v_name text;
begin
  if not private.liora_user_active() then raise exception using errcode='42501',message='Account session unavailable'; end if;
  if p_id is null or p_proche_id is null or char_length(p_proche_id) not between 1 and 128
    or v_email is null or char_length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_document_ids is null or cardinality(p_document_ids) not between 1 and 20
    or array_position(p_document_ids,null) is not null
    or cardinality(p_document_ids) <> (select count(distinct value) from unnest(p_document_ids) value)
    or exists (select 1 from unnest(p_document_ids) value where char_length(value) not between 1 and 128)
    or p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$'
    or exists (select 1 from auth.users u where u.id=v_uid and lower(u.email)=v_email)
  then raise exception using errcode='22023',message='Invalid emergency key'; end if;
  -- Sérialise les créations pour appliquer le plafond même avec plusieurs appareils.
  perform 1 from auth.users where id=v_uid for update;
  select * into v_key from private.liora_emergency_keys where id=p_id;
  if found then
    if v_key.owner_id=v_uid and v_key.proche_id=p_proche_id and v_key.recipient_email=v_email
      and v_key.document_ids=p_document_ids and v_key.code_hash=p_code_hash then
      return private.liora_emergency_key_json(v_key);
    end if;
    raise exception using errcode='22023',message='Invalid emergency key';
  end if;
  if (select count(*) from private.liora_emergency_keys where owner_id=v_uid and revoked_at is null)>=20 then
    raise exception using errcode='22023',message='Emergency key limit reached';
  end if;
  select payload->'data' into v_snapshot from public.liora_snapshots where user_id=v_uid for share;
  select p->>'name' into v_name from jsonb_array_elements(coalesce(v_snapshot->'proches','[]'::jsonb)) p where p->>'id'=p_proche_id;
  if v_name is null or char_length(v_name) not between 1 and 4000 then raise exception using errcode='22023',message='Synchronize the contact first'; end if;
  insert into private.liora_emergency_keys(id,owner_id,proche_id,proche_name,recipient_email,document_ids,code_hash)
    values(p_id,v_uid,p_proche_id,v_name,v_email,p_document_ids,p_code_hash) returning * into v_key;
  if not private.liora_emergency_key_valid(v_key) then raise exception using errcode='22023',message='Synchronize the selected documents first'; end if;
  return private.liora_emergency_key_json(v_key);
end;
$$;

create function private.liora_emergency_list()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_keys jsonb; v_requests jsonb;
begin
  if not private.liora_user_active() then raise exception using errcode='42501',message='Account session unavailable'; end if;
  select coalesce(jsonb_agg(item),'[]'::jsonb) into v_keys from (
    select private.liora_emergency_key_json(k) item from private.liora_emergency_keys k
    where k.owner_id=auth.uid() order by (k.revoked_at is null) desc,k.created_at desc,k.id limit 100
  ) selected;
  select coalesce(jsonb_agg(item),'[]'::jsonb) into v_requests from (
    select private.liora_emergency_request_json(k,r) item
    from private.liora_emergency_requests r join private.liora_emergency_keys k on k.id=r.key_id
    where k.owner_id=auth.uid() or (r.recipient_id=auth.uid() and exists (
      select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=k.recipient_email
    ))
    order by (private.liora_emergency_status(k,r)='waiting') desc,r.requested_at desc,r.id limit 100
  ) selected;
  return jsonb_build_object('keys',v_keys,'requests',v_requests,'serverNow',now());
end;
$$;

create function private.liora_emergency_request(p_code_hash text,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_attempts integer;
  v_key private.liora_emergency_keys;
  v_request private.liora_emergency_requests;
begin
  if not private.liora_user_active() then raise exception using errcode='42501',message='Account session unavailable'; end if;
  -- Une erreur de code est retournée comme résultat pour conserver le compteur.
  insert into private.liora_emergency_attempts as t(user_id,window_at,attempts) values(v_uid,now(),1)
  on conflict(user_id) do update set
    window_at=case when t.window_at<=now()-interval '1 minute' then now() else t.window_at end,
    attempts=case when t.window_at<=now()-interval '1 minute' then 1 else least(t.attempts+1,1000000) end
  returning attempts into v_attempts;
  if v_attempts>5 then return jsonb_build_object('error','RATE_LIMITED'); end if;
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' or p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then
    return jsonb_build_object('error','INVALID_KEY');
  end if;
  select * into v_key from private.liora_emergency_keys where code_hash=p_code_hash for update;
  if not found or v_key.owner_id=v_uid or not private.liora_emergency_key_valid(v_key)
    or not exists(select 1 from auth.users u where u.id=v_uid and u.email_confirmed_at is not null and lower(u.email)=v_key.recipient_email)
    or (v_key.recipient_id is not null and v_key.recipient_id<>v_uid)
  then return jsonb_build_object('error','INVALID_KEY'); end if;
  select * into v_request from private.liora_emergency_requests where key_id=v_key.id;
  if found then return private.liora_emergency_request_json(v_key,v_request); end if;
  update private.liora_emergency_keys set recipient_id=v_uid where id=v_key.id;
  insert into private.liora_emergency_requests(key_id,recipient_id,reason) values(v_key.id,v_uid,btrim(p_reason)) returning * into v_request;
  return private.liora_emergency_request_json(v_key,v_request);
end;
$$;

create function private.liora_emergency_decide(p_request_id uuid,p_decision text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_key private.liora_emergency_keys; v_request private.liora_emergency_requests;
begin
  if not private.liora_user_active() then raise exception using errcode='42501',message='Account session unavailable'; end if;
  if p_decision is null or p_decision not in ('approve','deny') then raise exception using errcode='22023',message='Invalid decision'; end if;
  select k.* into v_key from private.liora_emergency_keys k join private.liora_emergency_requests r on r.key_id=k.id
    where r.id=p_request_id and k.owner_id=auth.uid() for update of k;
  if not found then raise exception using errcode='42501',message='Request unavailable'; end if;
  select * into v_request from private.liora_emergency_requests where id=p_request_id for update;
  if p_decision='deny' then
    update private.liora_emergency_requests set denied_at=coalesce(denied_at,now()) where id=p_request_id;
  elsif private.liora_emergency_status(v_key,v_request)='waiting' then
    update private.liora_emergency_requests set approved_at=now(),opens_at=now(),expires_at=now()+interval '24 hours' where id=p_request_id;
  elsif private.liora_emergency_status(v_key,v_request)<>'active' then
    raise exception using errcode='22023',message='Request no longer available';
  end if;
end;
$$;

create function private.liora_emergency_revoke(p_key_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.liora_user_active() then raise exception using errcode='42501',message='Account session unavailable'; end if;
  update private.liora_emergency_keys set revoked_at=coalesce(revoked_at,now()) where id=p_key_id and owner_id=auth.uid();
  if not found then raise exception using errcode='42501',message='Key unavailable'; end if;
end;
$$;

create function private.liora_emergency_documents(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_key private.liora_emergency_keys; v_request private.liora_emergency_requests; v_data jsonb; v_documents jsonb;
begin
  if not private.liora_user_active() then raise exception using errcode='42501',message='Account session unavailable'; end if;
  select * into v_request from private.liora_emergency_requests where id=p_request_id and recipient_id=auth.uid();
  if not found then raise exception using errcode='42501',message='Emergency access unavailable'; end if;
  select * into v_key from private.liora_emergency_keys where id=v_request.key_id;
  if not found or private.liora_emergency_status(v_key,v_request)<>'active'
    or not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=v_key.recipient_email)
  then raise exception using errcode='42501',message='Emergency access unavailable'; end if;
  select payload->'data' into v_data from public.liora_snapshots where user_id=v_key.owner_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',d->>'id','name',d->>'name','kind',d->>'kind',
    'size',d->'size','date',d->>'date','path',substring(d->>'uri' from 7))),'[]'::jsonb)
    into v_documents from jsonb_array_elements(v_data->'docs') d where d->>'id'=any(v_key.document_ids);
  return jsonb_build_object('ownerName',concat_ws(' ',v_data->'profile'->>'firstName',v_data->'profile'->>'lastName'),
    'expiresAt',v_request.expires_at,'documents',v_documents,'serverNow',now());
end;
$$;

-- Lecture Storage contrôlée à chaque téléchargement, sans URL publique persistante.
create function private.liora_emergency_file_allowed(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select storage.allow_only_operation('object.get_authenticated') and private.liora_user_active() and exists (
    select 1 from private.liora_emergency_keys k
    join private.liora_emergency_requests r on r.key_id=k.id
    join auth.users u on u.id=r.recipient_id
    join public.liora_snapshots s on s.user_id=k.owner_id
    where r.recipient_id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=k.recipient_email
      and private.liora_emergency_status(k,r)='active'
      and exists(select 1 from jsonb_array_elements(s.payload->'data'->'docs') d
        where d->>'id'=any(k.document_ids) and d->>'uri'='cloud:'||p_name)
  );
$$;

-- Un retrait reste définitif, même si une ancienne copie est restaurée ensuite.
create function private.liora_emergency_revoke_removed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update private.liora_emergency_keys k set revoked_at=now()
    where k.owner_id=old.user_id and k.revoked_at is null and not private.liora_emergency_key_valid(k);
  return null;
end;
$$;
create trigger liora_emergency_revoke_removed after update or delete on public.liora_snapshots
for each row execute function private.liora_emergency_revoke_removed();
revoke all on function private.liora_emergency_revoke_removed() from public,anon,authenticated;

drop policy liora_files_guard_read on storage.objects;
create policy liora_files_guard_read on storage.objects as restrictive for select to authenticated
using (bucket_id<>'liora-files' or (
  ((storage.foldername(name))[1]=(select auth.uid())::text and (select private.liora_user_active()))
  or private.liora_emergency_file_allowed(name)
));
create policy liora_files_emergency_read on storage.objects for select to authenticated
using (bucket_id='liora-files' and private.liora_emergency_file_allowed(name));

-- L'API expose exclusivement les opérations autorisées, jamais les empreintes des codes.
create function public.liora_emergency_create(p_id uuid,p_proche_id text,p_recipient_email text,p_document_ids text[],p_code_hash text)
returns jsonb language sql security invoker set search_path='' as $$ select private.liora_emergency_create(p_id,p_proche_id,p_recipient_email,p_document_ids,p_code_hash); $$;
create function public.liora_emergency_list()
returns jsonb language sql security invoker set search_path='' as $$ select private.liora_emergency_list(); $$;
create function public.liora_emergency_request(p_code_hash text,p_reason text)
returns jsonb language sql security invoker set search_path='' as $$ select private.liora_emergency_request(p_code_hash,p_reason); $$;
create function public.liora_emergency_decide(p_request_id uuid,p_decision text)
returns void language sql security invoker set search_path='' as $$ select private.liora_emergency_decide(p_request_id,p_decision); $$;
create function public.liora_emergency_revoke(p_key_id uuid)
returns void language sql security invoker set search_path='' as $$ select private.liora_emergency_revoke(p_key_id); $$;
create function public.liora_emergency_documents(p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.liora_emergency_documents(p_request_id); $$;

revoke all on function private.liora_emergency_key_valid(private.liora_emergency_keys),
  private.liora_emergency_status(private.liora_emergency_keys,private.liora_emergency_requests),
  private.liora_emergency_key_json(private.liora_emergency_keys),
  private.liora_emergency_request_json(private.liora_emergency_keys,private.liora_emergency_requests)
  from public,anon,authenticated;
revoke all on function private.liora_emergency_file_allowed(text) from public,anon;
grant execute on function private.liora_emergency_file_allowed(text) to authenticated;
revoke all on function private.liora_emergency_create(uuid,text,text,text[],text),public.liora_emergency_create(uuid,text,text,text[],text),
  private.liora_emergency_list(),public.liora_emergency_list(),
  private.liora_emergency_request(text,text),public.liora_emergency_request(text,text),
  private.liora_emergency_decide(uuid,text),public.liora_emergency_decide(uuid,text),
  private.liora_emergency_revoke(uuid),public.liora_emergency_revoke(uuid),
  private.liora_emergency_documents(uuid),public.liora_emergency_documents(uuid)
  from public,anon;
grant execute on function private.liora_emergency_create(uuid,text,text,text[],text),public.liora_emergency_create(uuid,text,text,text[],text),
  private.liora_emergency_list(),public.liora_emergency_list(),
  private.liora_emergency_request(text,text),public.liora_emergency_request(text,text),
  private.liora_emergency_decide(uuid,text),public.liora_emergency_decide(uuid,text),
  private.liora_emergency_revoke(uuid),public.liora_emergency_revoke(uuid),
  private.liora_emergency_documents(uuid),public.liora_emergency_documents(uuid)
  to authenticated;
