-- Customer profile fields and legal consent evidence are separate trust domains.

begin;

create table public.legal_document_versions (
  document_kind text primary key check (document_kind in ('terms','privacy')),
  current_version text not null check (btrim(current_version) <> ''),
  updated_at timestamptz not null default now()
);
insert into public.legal_document_versions(document_kind,current_version)
values ('terms','2026-07-29'),('privacy','2026-07-29')
on conflict(document_kind) do update
set current_version = excluded.current_version,
    updated_at = now();

alter table public.legal_document_versions enable row level security;
alter table public.legal_document_versions force row level security;
revoke all on public.legal_document_versions from public,anon,authenticated;
grant all on public.legal_document_versions to service_role;

alter function public.ensure_customer_account(text,text)
  rename to ensure_customer_account_validated;
revoke all on function public.ensure_customer_account_validated(text,text)
from public,anon,authenticated;

create function public.ensure_customer_account(
  p_terms_version text,
  p_privacy_version text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_terms text;
  v_privacy text;
begin
  select current_version into v_terms
  from public.legal_document_versions where document_kind = 'terms';
  select current_version into v_privacy
  from public.legal_document_versions where document_kind = 'privacy';
  if p_terms_version is distinct from v_terms
     or p_privacy_version is distinct from v_privacy then
    raise exception 'LEGAL_VERSION_INVALID';
  end if;
  return public.ensure_customer_account_validated(v_terms,v_privacy);
end;
$$;

create function public.accept_legal_terms(
  p_terms_version text,
  p_privacy_version text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terms text;
  v_privacy text;
begin
  if auth.uid() is null or public.current_account_type() <> 'customer' then
    raise exception 'CUSTOMER_ACCESS_REQUIRED';
  end if;
  select current_version into v_terms
  from public.legal_document_versions where document_kind = 'terms';
  select current_version into v_privacy
  from public.legal_document_versions where document_kind = 'privacy';
  if p_terms_version is distinct from v_terms
     or p_privacy_version is distinct from v_privacy then
    raise exception 'LEGAL_VERSION_INVALID';
  end if;
  update public.profiles
  set terms_version = v_terms,
      terms_accepted_at = now(),
      privacy_version = v_privacy,
      privacy_accepted_at = now()
  where id = auth.uid();
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  insert into public.audit_logs(
    actor_user_id,actor_type,action,target_type,target_id,after_state
  ) values (
    auth.uid(),'customer','profile.legal_terms_accepted','profile',auth.uid(),
    jsonb_build_object('termsVersion',v_terms,'privacyVersion',v_privacy)
  );
  return true;
end;
$$;

create function public.update_my_profile(
  p_first_name text,
  p_last_name text,
  p_phone text default null,
  p_job_title text default null,
  p_department text default null,
  p_locale text default 'en-IN',
  p_timezone text default 'Asia/Kolkata'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_before jsonb;
begin
  if auth.uid() is null or public.current_account_type() <> 'customer' then
    raise exception 'CUSTOMER_ACCESS_REQUIRED';
  end if;
  if char_length(btrim(coalesce(p_first_name,''))) not between 1 and 80
     or char_length(btrim(coalesce(p_last_name,''))) not between 1 and 80 then
    raise exception 'PROFILE_NAME_INVALID';
  end if;
  select to_jsonb(p) into v_before
  from public.profiles p where p.id = auth.uid() for update;
  if v_before is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  update public.profiles
  set first_name = btrim(p_first_name),
      last_name = btrim(p_last_name),
      phone = nullif(btrim(p_phone),''),
      job_title = nullif(btrim(p_job_title),''),
      department = nullif(btrim(p_department),''),
      locale = btrim(p_locale),
      timezone = btrim(p_timezone)
  where id = auth.uid();
  insert into public.audit_logs(
    actor_user_id,actor_type,action,target_type,target_id,before_state,after_state
  )
  select auth.uid(),'customer','profile.updated','profile',auth.uid(),v_before,
         to_jsonb(p) - array[
           'terms_accepted_at','terms_version','privacy_accepted_at',
           'privacy_version','onboarding_completed_at'
         ]
  from public.profiles p where p.id = auth.uid();
  return true;
end;
$$;

drop policy if exists profiles_own_update on public.profiles;
revoke update on public.profiles from authenticated;

revoke all on function public.ensure_customer_account(text,text),
  public.accept_legal_terms(text,text),
  public.update_my_profile(text,text,text,text,text,text,text)
from public,anon,authenticated;
grant execute on function public.ensure_customer_account(text,text),
  public.accept_legal_terms(text,text),
  public.update_my_profile(text,text,text,text,text,text,text)
to authenticated;
grant execute on function public.ensure_customer_account(text,text),
  public.accept_legal_terms(text,text),
  public.update_my_profile(text,text,text,text,text,text,text)
to service_role;

notify pgrst, 'reload schema';
commit;
