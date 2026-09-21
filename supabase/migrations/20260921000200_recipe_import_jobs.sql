-- Sprint 7: durable, idempotent recipe import jobs and private temporary uploads.
create table public.recipe_import_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  consumed integer not null default 0 check (consumed >= 0),
  primary key(user_id, period_start)
);

create table public.recipe_import_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 128),
  state text not null default 'queued' check (state in ('queued','fetching','transcribing','extracting','validating','completed','failed','cancelled')),
  source_type text not null check (source_type in ('youtube','instagram','tiktok','blog','manual','file')),
  source_url text,
  manual_text text,
  upload_object text,
  provenance jsonb not null default '{}'::jsonb,
  result jsonb,
  error_code text,
  retryable boolean not null default false,
  attempts integer not null default 0 check (attempts >= 0),
  worker_id text,
  lease_expires_at timestamptz,
  enqueued_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,idempotency_key),
  check ((source_type='manual')=(manual_text is not null)),
  check ((source_type='file')=(upload_object is not null)),
  check (source_type in ('manual','file') or source_url is not null),
  check ((state='completed')=(result is not null)),
  check (result is null or (result->>'schemaVersion'='recipe-v1' and jsonb_typeof(result->'ingredients')='array' and jsonb_array_length(result->'ingredients')>0 and jsonb_typeof(result->'steps')='array' and jsonb_array_length(result->'steps')>0))
);
create index recipe_import_jobs_user_created_idx on public.recipe_import_jobs(user_id,created_at desc);
create index recipe_import_jobs_reconcile_idx on public.recipe_import_jobs(state,lease_expires_at) where state not in ('completed','cancelled');

alter table public.recipe_import_jobs enable row level security;
alter table public.recipe_import_usage enable row level security;
create policy recipe_import_jobs_read_own on public.recipe_import_jobs for select to authenticated using(user_id=auth.uid());
create policy recipe_import_usage_read_own on public.recipe_import_usage for select to authenticated using(user_id=auth.uid());

create or replace function public.create_recipe_import_job(p_idempotency_key text,p_source_type text,p_source_url text,p_manual_text text,p_upload_object text,p_provenance jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_existing public.recipe_import_jobs%rowtype; v_id uuid; v_period date:=date_trunc('month',now() at time zone 'UTC')::date; v_pro boolean; v_usage integer;
begin
 if v_uid is null then return jsonb_build_object('action','reject','code','AUTH_REQUIRED'); end if;
 if p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' or p_source_type not in ('youtube','instagram','tiktok','blog','manual','file') then return jsonb_build_object('action','reject','code','INVALID_REQUEST'); end if;
 if p_source_type='file' and coalesce(p_upload_object,'') not like 'recipe-imports/'||v_uid::text||'/%' then return jsonb_build_object('action','reject','code','INVALID_UPLOAD_OBJECT'); end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text||p_idempotency_key,0));
 select * into v_existing from public.recipe_import_jobs where user_id=v_uid and idempotency_key=p_idempotency_key;
 if found then return jsonb_build_object('action','existing','jobId',v_existing.id,'state',v_existing.state); end if;
 select exists(select 1 from public.user_entitlements where user_id=v_uid and plan='pro' and status='active') into v_pro;
 if not v_pro then
  insert into public.recipe_import_usage(user_id,period_start,consumed) values(v_uid,v_period,1)
  on conflict(user_id,period_start) do update set consumed=public.recipe_import_usage.consumed+1 returning consumed into v_usage;
  if v_usage>10 then update public.recipe_import_usage set consumed=consumed-1 where user_id=v_uid and period_start=v_period; return jsonb_build_object('action','reject','code','IMPORT_QUOTA_EXHAUSTED'); end if;
 end if;
 insert into public.recipe_import_jobs(user_id,idempotency_key,source_type,source_url,manual_text,upload_object,provenance)
 values(v_uid,p_idempotency_key,p_source_type,nullif(p_source_url,''),nullif(p_manual_text,''),nullif(p_upload_object,''),coalesce(p_provenance,'{}')) returning id into v_id;
 return jsonb_build_object('action','created','jobId',v_id,'state','queued');
exception when check_violation then return jsonb_build_object('action','reject','code','INVALID_REQUEST');
end $$;

create or replace function public.mark_recipe_job_enqueue_failed(p_job_id uuid) returns void language sql security definer set search_path='' as $$
 update public.recipe_import_jobs set error_code='QUEUE_UNAVAILABLE',retryable=true,updated_at=now() where id=p_job_id and user_id=auth.uid() and state='queued';
$$;

create or replace function public.claim_recipe_import_job(p_job_id uuid,p_worker_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job public.recipe_import_jobs%rowtype;
begin
 if current_user not in ('postgres','service_role') then raise exception 'FORBIDDEN'; end if;
 select * into v_job from public.recipe_import_jobs where id=p_job_id for update;
 if not found then return jsonb_build_object('action','missing'); end if;
 if v_job.state in ('completed','cancelled') then return jsonb_build_object('action','terminal','state',v_job.state); end if;
 if v_job.lease_expires_at>now() then return jsonb_build_object('action','busy'); end if;
 update public.recipe_import_jobs set state='fetching',attempts=attempts+1,worker_id=left(p_worker_id,100),lease_expires_at=now()+interval '10 minutes',error_code=null,retryable=false,updated_at=now() where id=p_job_id;
 return jsonb_build_object('action','claimed','job',jsonb_build_object('id',v_job.id,'sourceType',v_job.source_type,'sourceUrl',v_job.source_url,'manualText',v_job.manual_text,'uploadObject',v_job.upload_object,'provenance',v_job.provenance,'attempts',v_job.attempts+1));
end $$;

create or replace function public.set_recipe_import_stage(p_job_id uuid,p_worker_id text,p_stage text)
returns boolean language plpgsql security definer set search_path='' as $$ begin
 if current_user not in ('postgres','service_role') or p_stage not in ('fetching','transcribing','extracting','validating') then raise exception 'FORBIDDEN'; end if;
 update public.recipe_import_jobs set state=p_stage,lease_expires_at=now()+interval '10 minutes',updated_at=now() where id=p_job_id and worker_id=p_worker_id and state not in ('completed','cancelled'); return found;
end $$;

create or replace function public.complete_recipe_import_job(p_job_id uuid,p_worker_id text,p_result jsonb,p_provenance jsonb)
returns boolean language plpgsql security definer set search_path='' as $$ begin
 if current_user not in ('postgres','service_role') then raise exception 'FORBIDDEN'; end if;
 if p_result->>'schemaVersion'<>'recipe-v1' or coalesce(btrim(p_result->>'title'),'')='' or jsonb_typeof(p_result->'ingredients')<>'array' or jsonb_array_length(p_result->'ingredients')=0 or jsonb_typeof(p_result->'steps')<>'array' or jsonb_array_length(p_result->'steps')=0 then raise exception 'INVALID_RECIPE_RESULT'; end if;
 update public.recipe_import_jobs set state='completed',result=p_result,provenance=p_provenance,error_code=null,retryable=false,completed_at=now(),lease_expires_at=null,updated_at=now() where id=p_job_id and worker_id=p_worker_id and state not in ('completed','cancelled'); return found;
end $$;

create or replace function public.fail_recipe_import_job(p_job_id uuid,p_worker_id text,p_error_code text,p_retryable boolean)
returns boolean language plpgsql security definer set search_path='' as $$ begin
 if current_user not in ('postgres','service_role') or p_error_code !~ '^[A-Z][A-Z0-9_]{2,63}$' then raise exception 'FORBIDDEN'; end if;
 update public.recipe_import_jobs set state='failed',error_code=p_error_code,retryable=p_retryable,lease_expires_at=null,updated_at=now() where id=p_job_id and worker_id=p_worker_id and state not in ('completed','cancelled'); return found;
end $$;

revoke all on function public.create_recipe_import_job(text,text,text,text,text,jsonb),public.mark_recipe_job_enqueue_failed(uuid),public.claim_recipe_import_job(uuid,text),public.set_recipe_import_stage(uuid,text,text),public.complete_recipe_import_job(uuid,text,jsonb,jsonb),public.fail_recipe_import_job(uuid,text,text,boolean) from public;
grant execute on function public.create_recipe_import_job(text,text,text,text,text,jsonb),public.mark_recipe_job_enqueue_failed(uuid) to authenticated;
grant execute on function public.claim_recipe_import_job(uuid,text),public.set_recipe_import_stage(uuid,text,text),public.complete_recipe_import_job(uuid,text,jsonb,jsonb),public.fail_recipe_import_job(uuid,text,text,boolean) to service_role;
