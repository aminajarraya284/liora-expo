-- Les coordonnées du pilote restent dans un schéma privé, hors de la Data API.
create table private.liora_pilot_requests (
  email text primary key,
  requested_at timestamptz not null default now(),
  consent_version text not null default 'pilote-v1'
);
alter table private.liora_pilot_requests enable row level security;
revoke all on private.liora_pilot_requests from public, anon, authenticated;

create function public.liora_request_pilot(p_email text, p_consent boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  normalized text := lower(btrim(p_email));
begin
  if p_consent is not true or normalized is null or length(normalized) > 254
    or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'Invalid request';
  end if;
  -- Sérialise les inscriptions pour borner la collecte, même sous concurrence.
  perform pg_advisory_xact_lock(793120456);
  if (select count(*) from private.liora_pilot_requests) >= 1000
    or (select count(*) from private.liora_pilot_requests where requested_at > now() - interval '1 hour') >= 60 then
    raise exception using errcode = 'P0001', message = 'Try again later';
  end if;
  insert into private.liora_pilot_requests(email) values(normalized) on conflict do nothing;
end;
$$;
revoke all on function public.liora_request_pilot(text, boolean) from public;
grant execute on function public.liora_request_pilot(text, boolean) to anon, authenticated;
