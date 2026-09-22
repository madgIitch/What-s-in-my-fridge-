-- Route the existing OCR, suggestion and import RPCs through the canonical
-- entitlement/usage ledger. Legacy counters remain as read-only projections
-- for older deployments and rollback compatibility.
create or replace function public.mirror_legacy_usage()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.feature='receipt_ocr' then
    insert into public.ocr_monthly_usage(user_id,period_start,consumed)
    values(new.user_id,new.period,new.used)
    on conflict(user_id,period_start) do update set consumed=greatest(public.ocr_monthly_usage.consumed,excluded.consumed);
  elsif new.feature='recipe_suggestions' then
    insert into public.recipe_monthly_usage(user_id,period_start,consumed)
    values(new.user_id,new.period,new.used)
    on conflict(user_id,period_start) do update set consumed=greatest(public.recipe_monthly_usage.consumed,excluded.consumed);
  elsif new.feature='recipe_import' then
    insert into public.recipe_import_usage(user_id,period_start,consumed)
    values(new.user_id,new.period,new.used)
    on conflict(user_id,period_start) do update set consumed=greatest(public.recipe_import_usage.consumed,excluded.consumed);
  end if;
  return new;
end $$;
create trigger usage_counters_mirror_legacy after insert or update of used on public.usage_counters
for each row execute function public.mirror_legacy_usage();

create or replace function public.reserve_receipt_ocr(p_draft_id uuid,p_request_id uuid,p_image_hash text,p_locale text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_draft public.receipt_drafts%rowtype;
begin
  if v_uid is null then return jsonb_build_object('action','reject','code','AUTH_REQUIRED'); end if;
  select * into v_draft from public.receipt_drafts where user_id=v_uid and ocr_request_id=p_request_id for update;
  if found then
    if v_draft.id<>p_draft_id or v_draft.image_hash<>p_image_hash or v_draft.ocr_locale<>p_locale then return jsonb_build_object('action','reject','code','IDEMPOTENCY_MISMATCH'); end if;
    if v_draft.status in ('review','confirmed') then return jsonb_build_object('action','replay','draft',v_draft.ocr_result); end if;
    if v_draft.status='failed' then return jsonb_build_object('action','failed','code',v_draft.error_code); end if;
    return jsonb_build_object('action','reject','code','DRAFT_STATE_CONFLICT');
  end if;
  insert into public.receipt_drafts(id,user_id,status,ocr_request_id,image_hash,ocr_locale,quota_period,raw_text,captured_at)
  values(p_draft_id,v_uid,'processing',p_request_id,p_image_hash,p_locale,date_trunc('month',clock_timestamp() at time zone 'UTC')::date,'',now());
  return jsonb_build_object('action','process');
exception when unique_violation then return jsonb_build_object('action','reject','code','DRAFT_STATE_CONFLICT');
end $$;

create or replace function public.invoke_receipt_vision(p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.receipt_drafts%rowtype; reservation jsonb;
begin
  select * into v from public.receipt_drafts where id=p_draft_id and user_id=auth.uid() for update;
  if not found or v.status<>'processing' or v.image_path is null then return jsonb_build_object('allowed',false,'code','DRAFT_STATE_CONFLICT'); end if;
  if v.quota_consumed then return jsonb_build_object('allowed',false,'code','DRAFT_STATE_CONFLICT'); end if;
  reservation:=public.consume_usage('receipt_ocr',v.ocr_request_id::text);
  if not coalesce((reservation->>'allowed')::boolean,false) then return reservation; end if;
  update public.receipt_drafts set quota_consumed=true where id=p_draft_id;
  return reservation;
end $$;

create or replace function public.mark_receipt_vision_invoked(p_draft_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  result:=public.invoke_receipt_vision(p_draft_id);
  if not coalesce((result->>'allowed')::boolean,false) then raise exception '%',coalesce(result->>'code','DRAFT_STATE_CONFLICT'); end if;
end $$;

create or replace function public.release_receipt_ocr(p_draft_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.receipt_drafts where id=p_draft_id and user_id=auth.uid() and status='processing' and not quota_consumed;
end $$;

revoke all on function public.invoke_receipt_vision(uuid),public.mirror_legacy_usage() from public, anon, authenticated, service_role;
grant execute on function public.invoke_receipt_vision(uuid) to authenticated;

create or replace function public.begin_recipe_suggestion(p_cache_key text,p_inventory_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_catalog public.catalog_versions%rowtype; v_cache public.recipe_suggestion_cache%rowtype; reservation jsonb;
begin
 if v_uid is null then return jsonb_build_object('action','reject','code','AUTH_REQUIRED'); end if;
 if p_cache_key !~ '^[a-f0-9]{64}$' or p_inventory_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('action','reject','code','INVENTORY_INVALID'); end if;
 select * into v_catalog from public.catalog_versions where active for share;
 if not found then return jsonb_build_object('action','reject','code','CATALOG_NOT_READY'); end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text||p_cache_key,0));
 select * into v_cache from public.recipe_suggestion_cache where user_id=v_uid and cache_key=p_cache_key and status='ready' and expires_at>now();
 if found then return jsonb_build_object('action','hit','result',v_cache.result,'expiresAt',v_cache.expires_at,'catalogVersion',v_catalog.id,'matcherVersion',v_catalog.matcher_version); end if;
 select * into v_cache from public.recipe_suggestion_cache where user_id=v_uid and cache_key=p_cache_key and status='processing' and expires_at>now();
 if found then return jsonb_build_object('action','reject','code','SUGGESTION_IN_PROGRESS'); end if;
 reservation:=public.consume_usage('recipe_suggestions',p_cache_key);
 if not coalesce((reservation->>'allowed')::boolean,false) then return jsonb_build_object('action','reject','code','SUGGESTION_QUOTA_EXHAUSTED'); end if;
 insert into public.recipe_suggestion_cache(user_id,cache_key,inventory_hash,catalog_version_id,matcher_version,status,expires_at)
 values(v_uid,p_cache_key,p_inventory_hash,v_catalog.id,v_catalog.matcher_version,'processing',now()+interval '60 minutes')
 on conflict(user_id,cache_key) do update set inventory_hash=excluded.inventory_hash,catalog_version_id=excluded.catalog_version_id,matcher_version=excluded.matcher_version,status='processing',result=null,created_at=now(),expires_at=excluded.expires_at;
 return jsonb_build_object('action','process','expiresAt',now()+interval '60 minutes','catalogVersion',v_catalog.id,'matcherVersion',v_catalog.matcher_version);
end $$;

create or replace function public.create_recipe_import_job(p_idempotency_key text,p_source_type text,p_source_url text,p_manual_text text,p_upload_object text,p_provenance jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_existing public.recipe_import_jobs%rowtype; v_id uuid; reservation jsonb;
begin
 if v_uid is null then return jsonb_build_object('action','reject','code','AUTH_REQUIRED'); end if;
 if p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' or p_source_type not in ('youtube','instagram','tiktok','blog','manual','file') then return jsonb_build_object('action','reject','code','INVALID_REQUEST'); end if;
 if p_source_type='file' and coalesce(p_upload_object,'') not like 'recipe-imports/'||v_uid::text||'/%' then return jsonb_build_object('action','reject','code','INVALID_UPLOAD_OBJECT'); end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text||p_idempotency_key,0));
 select * into v_existing from public.recipe_import_jobs where user_id=v_uid and idempotency_key=p_idempotency_key;
 if found then return jsonb_build_object('action','existing','jobId',v_existing.id,'state',v_existing.state); end if;
 reservation:=public.consume_usage('recipe_import',p_idempotency_key);
 if not coalesce((reservation->>'allowed')::boolean,false) then return jsonb_build_object('action','reject','code','IMPORT_QUOTA_EXHAUSTED'); end if;
 insert into public.recipe_import_jobs(user_id,idempotency_key,source_type,source_url,manual_text,upload_object,provenance)
 values(v_uid,p_idempotency_key,p_source_type,nullif(p_source_url,''),nullif(p_manual_text,''),nullif(p_upload_object,''),coalesce(p_provenance,'{}')) returning id into v_id;
 return jsonb_build_object('action','created','jobId',v_id,'state','queued');
exception when check_violation then return jsonb_build_object('action','reject','code','INVALID_REQUEST');
end $$;
