-- Sprint 5: private receipt OCR, atomic quota/idempotency and exactly-once confirmation.
alter table public.receipt_drafts
  alter column raw_text set default '',
  alter column captured_at set default now(),
  alter column currency drop not null,
  alter column currency drop default,
  add column if not exists status text not null default 'pending' check (status in ('pending','processing','review','failed','confirmed')),
  add column if not exists image_path text,
  add column if not exists ocr_request_id uuid,
  add column if not exists image_hash text,
  add column if not exists ocr_locale text,
  add column if not exists parser_version text,
  add column if not exists ocr_result jsonb,
  add column if not exists original_lines jsonb not null default '[]'::jsonb,
  add column if not exists edited_lines jsonb not null default '[]'::jsonb,
  add column if not exists error_code text,
  add column if not exists quota_period date,
  add column if not exists quota_consumed boolean not null default false,
  add column if not exists confirmed_item_ids uuid[] not null default '{}',
  add column if not exists confirmed_at timestamptz;

create unique index if not exists receipt_drafts_request_unique on public.receipt_drafts(user_id, ocr_request_id) where ocr_request_id is not null;
create unique index if not exists receipt_drafts_image_unique on public.receipt_drafts(user_id, image_path) where image_path is not null;

create table public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro')),
  status text not null default 'active',
  updated_at timestamptz not null default now()
);
alter table public.user_entitlements enable row level security;
create policy user_entitlements_read_own on public.user_entitlements for select to authenticated using (user_id = auth.uid());

create table public.ocr_monthly_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  reserved integer not null default 0 check (reserved >= 0),
  consumed integer not null default 0 check (consumed >= 0),
  primary key (user_id, period_start)
);
alter table public.ocr_monthly_usage enable row level security;
create policy ocr_usage_read_own on public.ocr_monthly_usage for select to authenticated using (user_id = auth.uid());

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('receipt-images','receipt-images',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

create policy receipt_images_read_own on storage.objects for select to authenticated
  using (bucket_id='receipt-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy receipt_images_insert_own on storage.objects for insert to authenticated
  with check (bucket_id='receipt-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy receipt_images_delete_own on storage.objects for delete to authenticated
  using (bucket_id='receipt-images' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.reserve_receipt_ocr(p_draft_id uuid,p_request_id uuid,p_image_hash text,p_locale text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_draft public.receipt_drafts%rowtype; v_period date:=date_trunc('month',now() at time zone 'UTC')::date; v_pro boolean; v_usage public.ocr_monthly_usage%rowtype;
begin
  if v_uid is null then return jsonb_build_object('action','reject','code','AUTH_REQUIRED'); end if;
  select * into v_draft from public.receipt_drafts where user_id=v_uid and ocr_request_id=p_request_id for update;
  if found then
    if v_draft.id<>p_draft_id or v_draft.image_hash<>p_image_hash or v_draft.ocr_locale<>p_locale then return jsonb_build_object('action','reject','code','IDEMPOTENCY_MISMATCH'); end if;
    if v_draft.status in ('review','confirmed') then return jsonb_build_object('action','replay','draft',v_draft.ocr_result); end if;
    if v_draft.status='failed' then return jsonb_build_object('action','failed','code',v_draft.error_code); end if;
    return jsonb_build_object('action','reject','code','DRAFT_STATE_CONFLICT');
  end if;
  select exists(select 1 from public.user_entitlements where user_id=v_uid and plan='pro' and status='active') into v_pro;
  if not v_pro then
    insert into public.ocr_monthly_usage(user_id,period_start,reserved) values(v_uid,v_period,1)
    on conflict(user_id,period_start) do update set reserved=public.ocr_monthly_usage.reserved+1
    returning * into v_usage;
    if v_usage.reserved+v_usage.consumed>5 then update public.ocr_monthly_usage set reserved=reserved-1 where user_id=v_uid and period_start=v_period; return jsonb_build_object('action','reject','code','OCR_QUOTA_EXHAUSTED'); end if;
  end if;
  insert into public.receipt_drafts(id,user_id,status,ocr_request_id,image_hash,ocr_locale,quota_period,raw_text,captured_at)
  values(p_draft_id,v_uid,'processing',p_request_id,p_image_hash,p_locale,v_period,'',now());
  return jsonb_build_object('action','process');
exception when unique_violation then return jsonb_build_object('action','reject','code','DRAFT_STATE_CONFLICT');
end $$;

create or replace function public.attach_receipt_image(p_draft_id uuid,p_image_path text)
returns void language plpgsql security definer set search_path='' as $$ begin
 update public.receipt_drafts set image_path=p_image_path,updated_at=now() where id=p_draft_id and user_id=auth.uid() and status='processing' and split_part(p_image_path,'/',1)=auth.uid()::text and split_part(p_image_path,'/',2)=p_draft_id::text;
 if not found then raise exception 'OBJECT_FORBIDDEN'; end if;
end $$;

create or replace function public.mark_receipt_vision_invoked(p_draft_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v public.receipt_drafts%rowtype; v_pro boolean;
begin select * into v from public.receipt_drafts where id=p_draft_id and user_id=auth.uid() for update; if not found or v.status<>'processing' then raise exception 'DRAFT_STATE_CONFLICT'; end if;
 select exists(select 1 from public.user_entitlements where user_id=auth.uid() and plan='pro' and status='active') into v_pro;
 if not v_pro and not v.quota_consumed then update public.ocr_monthly_usage set reserved=reserved-1,consumed=consumed+1 where user_id=auth.uid() and period_start=v.quota_period; end if;
 update public.receipt_drafts set quota_consumed=true where id=p_draft_id;
end $$;

create or replace function public.release_receipt_ocr(p_draft_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v public.receipt_drafts%rowtype; v_pro boolean;
begin select * into v from public.receipt_drafts where id=p_draft_id and user_id=auth.uid() for update; if not found or v.quota_consumed then return; end if;
 select exists(select 1 from public.user_entitlements where user_id=auth.uid() and plan='pro' and status='active') into v_pro;
 if not v_pro then update public.ocr_monthly_usage set reserved=greatest(0,reserved-1) where user_id=auth.uid() and period_start=v.quota_period; end if;
 delete from public.receipt_drafts where id=p_draft_id and user_id=auth.uid();
end $$;

create or replace function public.complete_receipt_ocr(p_draft_id uuid,p_raw_text text,p_parser_version text,p_result jsonb)
returns void language plpgsql security definer set search_path='' as $$ begin
 update public.receipt_drafts set status='review',raw_text=p_raw_text,parser_version=p_parser_version,ocr_result=p_result,merchant=p_result->>'merchant',purchase_date=nullif(p_result->>'purchaseDate','')::date,currency=nullif(p_result->>'currency',''),total=nullif(p_result->>'total','')::numeric,lines=coalesce(p_result->'items','[]'),original_lines=coalesce(p_result->'items','[]'),edited_lines=coalesce(p_result->'items','[]'),unrecognized_lines=coalesce(p_result->'unrecognizedLines','[]'),error_code=null,updated_at=now() where id=p_draft_id and user_id=auth.uid() and status='processing';
 if not found then raise exception 'DRAFT_STATE_CONFLICT'; end if;
end $$;

create or replace function public.fail_receipt_ocr(p_draft_id uuid,p_error_code text)
returns void language plpgsql security definer set search_path='' as $$ begin update public.receipt_drafts set status='failed',error_code=p_error_code,updated_at=now() where id=p_draft_id and user_id=auth.uid() and status='processing'; end $$;

create or replace function public.confirm_receipt_draft(p_draft_id uuid,p_lines jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v public.receipt_drafts%rowtype; l jsonb; ids jsonb:='[]'; item_id uuid; q numeric; n text;
begin
 if v_uid is null then return jsonb_build_object('code','AUTH_REQUIRED'); end if;
 select * into v from public.receipt_drafts where id=p_draft_id and user_id=v_uid for update;
 if not found then return jsonb_build_object('code','DRAFT_NOT_FOUND'); end if;
 if v.confirmed_at is not null then return jsonb_build_object('itemIds',to_jsonb(v.confirmed_item_ids)); end if;
 if v.status<>'review' or jsonb_typeof(p_lines)<>'array' then return jsonb_build_object('code','DRAFT_STATE_CONFLICT'); end if;
 for l in select value from jsonb_array_elements(p_lines) loop
  if coalesce((l->>'accepted')::boolean,false) then
   n:=btrim(l->>'name'); q:=(l->>'quantity')::numeric;
   if n is null or n='' or q<=0 or (l->>'unitPrice')::numeric<0 or (l->>'totalPrice')::numeric<0 then raise exception 'INVALID_LINES'; end if;
   item_id=(substr(md5(p_draft_id::text||':'||(l->>'lineId')),1,8)||'-'||substr(md5(p_draft_id::text||':'||(l->>'lineId')),9,4)||'-4'||substr(md5(p_draft_id::text||':'||(l->>'lineId')),14,3)||'-a'||substr(md5(p_draft_id::text||':'||(l->>'lineId')),18,3)||'-'||substr(md5(p_draft_id::text||':'||(l->>'lineId')),21,12))::uuid;
   insert into public.inventory_items(id,user_id,name,expiry_date,quantity,unit,notes,added_at) values(item_id,v_uid,n,current_date,q,coalesce(nullif(btrim(l->>'unit'),''),'unit'),'Receipt '||p_draft_id::text,now()) on conflict(id) do nothing;
   ids=ids||jsonb_build_array(item_id::text);
  end if;
 end loop;
 update public.receipt_drafts set status='confirmed',confirmed=true,confirmed_at=now(),edited_lines=p_lines,confirmed_item_ids=array(select jsonb_array_elements_text(ids)::uuid),updated_at=now() where id=p_draft_id;
 return jsonb_build_object('itemIds',ids);
exception when invalid_text_representation or numeric_value_out_of_range or check_violation then raise exception 'INVALID_LINES';
end $$;

create or replace function public.prevent_confirmed_draft_edit()
returns trigger language plpgsql set search_path='' as $$ begin
 if old.confirmed_at is not null and current_user <> 'postgres' then raise exception 'DRAFT_STATE_CONFLICT'; end if;
 return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger receipt_draft_immutable_after_confirm before update or delete on public.receipt_drafts for each row execute function public.prevent_confirmed_draft_edit();

revoke all on function public.reserve_receipt_ocr(uuid,uuid,text,text),public.attach_receipt_image(uuid,text),public.mark_receipt_vision_invoked(uuid),public.release_receipt_ocr(uuid),public.complete_receipt_ocr(uuid,text,text,jsonb),public.fail_receipt_ocr(uuid,text),public.confirm_receipt_draft(uuid,jsonb) from public;
grant execute on function public.reserve_receipt_ocr(uuid,uuid,text,text),public.attach_receipt_image(uuid,text),public.mark_receipt_vision_invoked(uuid),public.release_receipt_ocr(uuid),public.complete_receipt_ocr(uuid,text,text,jsonb),public.fail_receipt_ocr(uuid,text),public.confirm_receipt_draft(uuid,jsonb) to authenticated;
