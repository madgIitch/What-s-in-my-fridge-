-- Sprint 11: additive Web Push persistence and completion-triggered delivery ledger.
create extension if not exists pgcrypto with schema extensions;

alter table public.recipe_import_jobs add column completed_version bigint not null default 0 check (completed_version >= 0);
update public.recipe_import_jobs set completed_version = 1 where state = 'completed' and completed_version = 0;

create table public.push_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint_hash text not null unique check (endpoint_hash ~ '^[0-9a-f]{64}$'),
  endpoint text not null check (endpoint like 'https://%' and char_length(endpoint) <= 2048),
  p256dh text not null check (char_length(p256dh) between 1 and 256),
  auth text not null check (char_length(auth) between 1 and 128),
  expiration_time timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_active_idx on public.push_subscriptions(user_id) where revoked_at is null;

create table public.push_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  job_id uuid not null references public.recipe_import_jobs(id) on delete cascade,
  completed_version bigint not null check (completed_version > 0),
  event_key text not null check (event_key ~ '^recipe-job-completed:[0-9a-f-]{36}:[1-9][0-9]*$'),
  status text not null default 'pending' check (status in ('pending','sending','sent','terminal')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  error_code text check (error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(subscription_id,event_key)
);
create index push_deliveries_pending_idx on public.push_deliveries(next_attempt_at,created_at) where status = 'pending';

alter table public.push_subscriptions enable row level security;
alter table public.push_deliveries enable row level security;
create policy push_subscriptions_read_own on public.push_subscriptions for select to authenticated using (user_id = auth.uid());

create or replace function public.register_push_subscription(p_endpoint_hash text,p_endpoint text,p_p256dh text,p_auth text,p_expiration_time timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_endpoint_hash !~ '^[0-9a-f]{64}$' or p_endpoint not like 'https://%' or char_length(p_endpoint)>2048 or p_p256dh !~ '^[A-Za-z0-9_-]+$' or p_auth !~ '^[A-Za-z0-9_-]+$' then raise exception 'INVALID_SUBSCRIPTION'; end if;
  insert into public.push_subscriptions(user_id,endpoint_hash,endpoint,p256dh,auth,expiration_time)
  values(v_uid,p_endpoint_hash,p_endpoint,p_p256dh,p_auth,p_expiration_time)
  on conflict(endpoint_hash) do update set user_id=v_uid,endpoint=excluded.endpoint,p256dh=excluded.p256dh,auth=excluded.auth,expiration_time=excluded.expiration_time,revoked_at=null,updated_at=now()
  returning id into v_id;
  update public.push_deliveries d set status='terminal',error_code='OWNERSHIP_CHANGED',updated_at=now()
    from public.recipe_import_jobs j
    where d.subscription_id=v_id and d.job_id=j.id and j.user_id<>v_uid and d.status in ('pending','sending');
  return v_id;
end $$;

create or replace function public.revoke_push_subscription(p_endpoint_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  update public.push_subscriptions set revoked_at=coalesce(revoked_at,now()),updated_at=now() where endpoint_hash=p_endpoint_hash and user_id=auth.uid();
  return found;
end $$;

create or replace function public.recipe_job_completion_push()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.state='completed' and old.state is distinct from 'completed' then
    if new.result is null or new.result->>'schemaVersion'<>'recipe-v1' or coalesce(btrim(new.result->>'title'),'')='' or jsonb_typeof(new.result->'ingredients')<>'array' or jsonb_array_length(new.result->'ingredients')=0 or jsonb_typeof(new.result->'steps')<>'array' or jsonb_array_length(new.result->'steps')=0 then raise exception 'INVALID_RECIPE_RESULT'; end if;
    new.completed_version := old.completed_version + 1;
  end if;
  return new;
end $$;

create trigger recipe_job_completion_version before update on public.recipe_import_jobs for each row execute function public.recipe_job_completion_push();

create or replace function public.enqueue_recipe_job_push()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.state='completed' and old.state is distinct from 'completed' and new.completed_version>0 then
    insert into public.push_deliveries(subscription_id,job_id,completed_version,event_key)
    select s.id,new.id,new.completed_version,'recipe-job-completed:'||new.id::text||':'||new.completed_version::text
    from public.push_subscriptions s where s.user_id=new.user_id and s.revoked_at is null
    on conflict(subscription_id,event_key) do nothing;
  end if;
  return null;
end $$;
create trigger recipe_job_enqueue_push after update on public.recipe_import_jobs for each row execute function public.enqueue_recipe_job_push();

create or replace function public.claim_push_delivery()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_delivery public.push_deliveries%rowtype; v_job public.recipe_import_jobs%rowtype; v_sub public.push_subscriptions%rowtype;
begin
  if current_user not in ('postgres','service_role') then raise exception 'FORBIDDEN'; end if;
  -- A process may die after claiming a row. Reclaim a stale lease while preserving
  -- the attempt cap; terminalize exhausted leases below.
  update public.push_deliveries set status='terminal',error_code='PUSH_TIMEOUT',updated_at=now()
    where status='sending' and attempts>=3 and updated_at<now()-interval '2 minutes';
  select * into v_delivery from public.push_deliveries
    where (status='pending' and next_attempt_at<=now() or status='sending' and updated_at<now()-interval '2 minutes')
      and attempts<3
    order by next_attempt_at,created_at for update skip locked limit 1;
  if not found then return null; end if;
  select * into v_job from public.recipe_import_jobs where id=v_delivery.job_id;
  select * into v_sub from public.push_subscriptions where id=v_delivery.subscription_id;
  if v_job.state<>'completed' or v_job.completed_version<>v_delivery.completed_version or v_job.result->>'schemaVersion'<>'recipe-v1' or v_sub.revoked_at is not null or v_job.user_id is distinct from v_sub.user_id then
    update public.push_deliveries set status='terminal',error_code='CANONICAL_STATE_CHANGED',updated_at=now() where id=v_delivery.id;
    return null;
  end if;
  update public.push_deliveries set status='sending',attempts=attempts+1,updated_at=now() where id=v_delivery.id returning * into v_delivery;
  return jsonb_build_object('id',v_delivery.id,'subscription_id',v_sub.id,'event_key',v_delivery.event_key,'job_id',v_job.id,'completed_version',v_delivery.completed_version,'attempts',v_delivery.attempts,'endpoint',v_sub.endpoint,'p256dh',v_sub.p256dh,'auth',v_sub.auth);
end $$;

create or replace function public.finish_push_delivery(p_delivery_id uuid,p_status text,p_error_code text,p_next_attempt_at timestamptz,p_revoke_subscription boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_subscription uuid;
begin
  if current_user not in ('postgres','service_role') or p_status not in ('pending','sent','terminal') or (p_error_code is not null and p_error_code !~ '^[A-Z][A-Z0-9_]{2,63}$') then raise exception 'FORBIDDEN'; end if;
  update public.push_deliveries set status=p_status,error_code=p_error_code,next_attempt_at=coalesce(p_next_attempt_at,next_attempt_at),sent_at=case when p_status='sent' then now() else sent_at end,updated_at=now() where id=p_delivery_id and status='sending' returning subscription_id into v_subscription;
  if p_revoke_subscription and v_subscription is not null then update public.push_subscriptions set revoked_at=coalesce(revoked_at,now()),updated_at=now() where id=v_subscription; end if;
  return v_subscription is not null;
end $$;

revoke all on table public.push_subscriptions,public.push_deliveries from anon,authenticated;
grant select on table public.push_subscriptions to authenticated;
revoke all on function public.register_push_subscription(text,text,text,text,timestamptz),public.revoke_push_subscription(text),public.claim_push_delivery(),public.finish_push_delivery(uuid,text,text,timestamptz,boolean) from public;
grant execute on function public.register_push_subscription(text,text,text,text,timestamptz),public.revoke_push_subscription(text) to authenticated;
grant execute on function public.claim_push_delivery(),public.finish_push_delivery(uuid,text,text,timestamptz,boolean) to service_role;
