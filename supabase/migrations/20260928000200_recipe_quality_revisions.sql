-- Additive history: the source job/result stays immutable after completion.
create table public.recipe_import_revisions (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null references public.recipe_import_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  result jsonb not null check (jsonb_typeof(result)='object'),
  created_at timestamptz not null default now(),
  unique(job_id,version)
);
create table public.recipe_import_reprocesses (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null references public.recipe_import_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  child_job_id uuid not null references public.recipe_import_jobs(id) on delete cascade,
  pipeline_version text not null,
  created_at timestamptz not null default now(),
  unique(job_id,pipeline_version), unique(child_job_id)
);
alter table public.recipe_import_revisions enable row level security;
alter table public.recipe_import_reprocesses enable row level security;
create policy recipe_revisions_read_own on public.recipe_import_revisions for select to authenticated using(user_id=auth.uid());
create policy recipe_reprocesses_read_own on public.recipe_import_reprocesses for select to authenticated using(user_id=auth.uid());
grant select on public.recipe_import_revisions,public.recipe_import_reprocesses to authenticated;
revoke insert,update,delete on public.recipe_import_revisions,public.recipe_import_reprocesses from authenticated,anon;

create function public.save_recipe_import_revision(p_job_id uuid,p_expected_version integer,p_result jsonb,p_restore boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job public.recipe_import_jobs%rowtype; v_version integer; v_result jsonb;
begin
  select * into v_job from public.recipe_import_jobs where id=p_job_id and user_id=auth.uid() for update;
  if not found then return jsonb_build_object('error','NOT_FOUND'); end if;
  if v_job.state<>'completed' then return jsonb_build_object('error','NOT_COMPLETED'); end if;
  select coalesce(max(version),0) into v_version from public.recipe_import_revisions where job_id=p_job_id;
  if p_expected_version is null or p_expected_version<>v_version then return jsonb_build_object('error','VERSION_CONFLICT'); end if;
  v_result:=case when p_restore then v_job.result else p_result end;
  if v_result is null or octet_length(v_result::text)>100000
    or coalesce(v_result->>'schemaVersion','')<>'recipe-v1'
    or jsonb_typeof(v_result->'title') is distinct from 'string'
    or coalesce(length(btrim(v_result->>'title')),0) not between 1 and 200
    or jsonb_typeof(v_result->'ingredients') is distinct from 'array'
    or jsonb_typeof(v_result->'steps') is distinct from 'array' then
    return jsonb_build_object('error','INVALID_RESULT');
  end if;
  if jsonb_array_length(v_result->'ingredients') not between 1 and 200 or jsonb_array_length(v_result->'steps') not between 1 and 100 then return jsonb_build_object('error','INVALID_RESULT'); end if;
  if exists(select 1 from jsonb_array_elements(v_result->'ingredients') i where jsonb_typeof(i) is distinct from 'object'
    or jsonb_typeof(i->'name') is distinct from 'string'
    or coalesce(length(btrim(i->>'name')),0) not between 1 and 200
    or (i ? 'amount' and (jsonb_typeof(i->'amount') is distinct from 'string' or length(i->>'amount')>100))
    or (i ? 'unit' and (jsonb_typeof(i->'unit') is distinct from 'string' or length(i->>'unit')>100)))
    or exists(select 1 from jsonb_array_elements(v_result->'steps') s where jsonb_typeof(s) is distinct from 'string' or length(btrim(s#>>'{}')) not between 1 and 2000) then return jsonb_build_object('error','INVALID_RESULT'); end if;
  if not p_restore then
    -- Source/provenance cannot be rewritten by a browser payload.
    v_result:=jsonb_build_object('schemaVersion','recipe-v1','title',v_result->>'title','ingredients',v_result->'ingredients','steps',v_result->'steps','source',v_job.result->'source','provenance',coalesce(v_job.result->'provenance','{}'::jsonb)||jsonb_build_object('quality',jsonb_build_object('version','recipe-quality-v1','status','ready','reviewedByUser',true)));
  end if;
  insert into public.recipe_import_revisions(job_id,user_id,version,result) values(p_job_id,auth.uid(),v_version+1,v_result);
  return jsonb_build_object('version',v_version+1);
end $$;

create function public.request_recipe_import_reprocess(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job public.recipe_import_jobs%rowtype; v_existing public.recipe_import_reprocesses%rowtype; v_child uuid; v_count integer;
begin
  -- Serializes both per-user rate limit and per-job/version idempotency.
  if auth.uid() is null then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended('recipe-reprocess:'||auth.uid()::text,0));
  select * into v_job from public.recipe_import_jobs where id=p_job_id and user_id=auth.uid() for update;
  if not found then return jsonb_build_object('error','NOT_FOUND'); end if;
  if v_job.state<>'completed' then return jsonb_build_object('error','NOT_COMPLETED'); end if;
  select * into v_existing from public.recipe_import_reprocesses where job_id=p_job_id and pipeline_version='recipe-quality-v1';
  if found then return jsonb_build_object('jobId',v_existing.child_job_id,'replay',true); end if;
  if v_job.source_type='file' then return jsonb_build_object('error','SOURCE_EXPIRED'); end if;
  select count(*) into v_count from public.recipe_import_reprocesses where user_id=auth.uid() and created_at>now()-interval '1 hour';
  if v_count>=3 then return jsonb_build_object('error','RATE_LIMITED'); end if;
  insert into public.recipe_import_jobs(user_id,idempotency_key,source_type,source_url,manual_text,provenance)
    values(auth.uid(),'reprocess:'||p_job_id::text||':recipe-quality-v1',v_job.source_type,v_job.source_url,v_job.manual_text,v_job.provenance||jsonb_build_object('qualityReprocess',true,'parentJobId',p_job_id)) returning id into v_child;
  insert into public.recipe_import_reprocesses(job_id,user_id,child_job_id,pipeline_version) values(p_job_id,auth.uid(),v_child,'recipe-quality-v1');
  -- No recipe_import_usage mutation: this is a revision, not a new import.
  return jsonb_build_object('jobId',v_child,'replay',false);
end $$;
revoke all on function public.save_recipe_import_revision(uuid,integer,jsonb,boolean),public.request_recipe_import_reprocess(uuid) from public,anon;
grant execute on function public.save_recipe_import_revision(uuid,integer,jsonb,boolean),public.request_recipe_import_reprocess(uuid) to authenticated;
