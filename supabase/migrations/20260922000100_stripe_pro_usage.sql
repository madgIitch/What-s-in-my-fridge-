-- Sprint 10: additive Stripe ledger, canonical entitlement and atomic usage.
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'none' check (status in ('active','trialing','past_due','canceled','unpaid','incomplete','incomplete_expired','paused','none')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_event_created bigint,
  last_event_id text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_customer_id), unique (stripe_subscription_id),
  check ((last_event_created is null) = (last_event_id is null))
);
create table public.stripe_events (
  event_id text primary key, event_type text not null, event_created bigint not null,
  processing_status text not null check (processing_status in ('processed','ignored','stale')),
  result jsonb not null, processed_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.billing_overrides (
  user_id uuid primary key references auth.users(id) on delete cascade,
  value boolean, reason text not null check (btrim(reason) <> ''), actor text not null default 'billing-admin', updated_at timestamptz not null default now()
);
create table public.billing_override_audit (
  id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade,
  actor text not null, reason text not null, before_state jsonb not null, after_state jsonb not null, created_at timestamptz not null default now()
);
create table public.billing_anomalies (
  id bigint generated always as identity primary key, user_id uuid references auth.users(id) on delete set null,
  stripe_customer_id text, code text not null, detail jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade, feature text not null check(feature in ('recipe_suggestions','receipt_ocr','recipe_import')),
  period date not null, used integer not null default 0 check(used >= 0), updated_at timestamptz not null default now(), primary key(user_id,feature,period)
);
create table public.usage_ledger (
  user_id uuid not null references auth.users(id) on delete cascade, feature text not null,
  period date not null, idempotency_key text not null check(char_length(idempotency_key) between 1 and 200),
  allowed boolean not null, response jsonb not null, created_at timestamptz not null default now(), primary key(user_id,feature,period,idempotency_key)
);

alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;
alter table public.billing_overrides enable row level security;
alter table public.billing_override_audit enable row level security;
alter table public.billing_anomalies enable row level security;
alter table public.usage_counters enable row level security;
alter table public.usage_ledger enable row level security;
create policy subscriptions_read_own on public.subscriptions for select to authenticated using(user_id=auth.uid());
create policy usage_counters_read_own on public.usage_counters for select to authenticated using(user_id=auth.uid());

create or replace function public.billing_entitlement(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare s public.subscriptions%rowtype; o public.billing_overrides%rowtype; l public.user_entitlements%rowtype; v_status text; v_plan text; v_source text;
begin
 select * into s from public.subscriptions where user_id=p_user_id;
 select * into o from public.billing_overrides where user_id=p_user_id;
 v_status:=coalesce(s.status,'none');
 if o.user_id is not null and o.value is not null then v_plan:=case when o.value then 'pro' else 'free' end; v_source:='override';
 elsif s.user_id is not null then v_plan:=case when s.status in ('active','trialing') then 'pro' else 'free' end; v_source:='stripe';
 else select * into l from public.user_entitlements where user_id=p_user_id;
   if found then v_plan:=case when l.plan='pro' and l.status='active' then 'pro' else 'free' end; v_status:=case when l.status in ('active','trialing','past_due','canceled','unpaid','incomplete','incomplete_expired','paused') then l.status else 'none' end; v_source:='legacy';
   else v_plan:='free'; v_source:='default'; end if;
 end if;
 return jsonb_build_object('plan',v_plan,'status',v_status,'source',v_source,'currentPeriodEnd',s.current_period_end,'cancelAtPeriodEnd',coalesce(s.cancel_at_period_end,false));
end $$;

create or replace function public.process_stripe_event(p_event_id text,p_event_type text,p_event_created bigint,p_user_id uuid,p_customer_id text,p_subscription_id text,p_status text,p_period_end timestamptz,p_cancel_at_period_end boolean,p_result jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.stripe_events%rowtype; s public.subscriptions%rowtype; v_state text:='processed'; v_result jsonb:=p_result;
begin
 perform pg_advisory_xact_lock(hashtextextended('stripe-event:'||p_event_id,0));
 select * into e from public.stripe_events where event_id=p_event_id for update;
 if found then return e.result; end if;
 if p_status is null then
   v_state:=case when p_event_type='checkout.session.completed' and p_user_id is not null then 'processed' else 'ignored' end;
   insert into public.stripe_events(event_id,event_type,event_created,processing_status,result) values(p_event_id,p_event_type,p_event_created,v_state,p_result);
   return p_result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 select * into s from public.subscriptions where user_id=p_user_id for update;
 if s.user_id is not null and s.last_event_created is not null and
    (p_event_created < s.last_event_created or
     (p_event_created = s.last_event_created and p_event_id collate "C" <= s.last_event_id collate "C")) then
   v_state:='stale'; v_result:=jsonb_build_object('outcome','stale');
 else
   insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,status,current_period_end,cancel_at_period_end,last_event_created,last_event_id)
   values(p_user_id,p_customer_id,p_subscription_id,p_status,p_period_end,p_cancel_at_period_end,p_event_created,p_event_id)
   on conflict(user_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,status=excluded.status,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,last_event_created=excluded.last_event_created,last_event_id=excluded.last_event_id,updated_at=now(),version=public.subscriptions.version+1;
 end if;
 insert into public.stripe_events(event_id,event_type,event_created,processing_status,result) values(p_event_id,p_event_type,p_event_created,v_state,v_result);
 return v_result;
end $$;

create or replace function public.reconcile_subscription(p_user_id uuid,p_customer_id text,p_subscription_id text,p_status text,p_period_end timestamptz,p_cancel_at_period_end boolean,p_event_created bigint,p_event_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.subscriptions%rowtype; changed boolean:=false;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0)); select * into s from public.subscriptions where user_id=p_user_id for update;
 if s.last_event_created is not null and p_event_created is not null and p_event_created <= s.last_event_created then
   return jsonb_build_object('applied',false,'status',s.status,'eventCursor',jsonb_build_object('created',s.last_event_created,'id',s.last_event_id));
 end if;
 changed:=s.user_id is null or s.stripe_customer_id is distinct from p_customer_id or s.stripe_subscription_id is distinct from p_subscription_id or s.status is distinct from p_status or s.current_period_end is distinct from p_period_end or s.cancel_at_period_end is distinct from p_cancel_at_period_end;
 if changed then insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,status,current_period_end,cancel_at_period_end,last_event_created,last_event_id) values(p_user_id,p_customer_id,p_subscription_id,p_status,p_period_end,p_cancel_at_period_end,p_event_created,p_event_id) on conflict(user_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,status=excluded.status,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,last_event_created=excluded.last_event_created,last_event_id=excluded.last_event_id,updated_at=now(),version=public.subscriptions.version+1; end if;
 return jsonb_build_object('applied',changed,'status',case when changed then p_status else s.status end,'eventCursor',case when changed then jsonb_build_object('created',p_event_created,'id',p_event_id) when s.last_event_created is not null then jsonb_build_object('created',s.last_event_created,'id',s.last_event_id) else null end);
end $$;

create or replace function public.consume_usage(p_feature text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); per date:=date_trunc('month',clock_timestamp() at time zone 'UTC')::date; lim int; ent jsonb; led public.usage_ledger%rowtype; count_used int:=0; response jsonb;
begin
 if uid is null then raise exception 'UNAUTHENTICATED'; end if;
 lim:=case p_feature when 'recipe_suggestions' then 5 when 'receipt_ocr' then 5 when 'recipe_import' then 10 else null end;
 if lim is null or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then raise exception 'VALIDATION_ERROR'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||':'||p_feature||':'||per::text,0));
 select * into led from public.usage_ledger where user_id=uid and feature=p_feature and period=per and idempotency_key=p_idempotency_key;
 if found then return led.response||case when led.allowed then jsonb_build_object('duplicate',true) else '{}'::jsonb end; end if;
 ent:=public.billing_entitlement(uid);
 select used into count_used from public.usage_counters where user_id=uid and feature=p_feature and period=per;
 count_used:=coalesce(count_used,0);
 if ent->>'plan'='pro' then response:=jsonb_build_object('allowed',true,'feature',p_feature,'period',to_char(per,'YYYY-MM'),'used',count_used,'limit',lim,'remaining',greatest(0,lim-count_used),'duplicate',false);
 elsif count_used>=lim then response:=jsonb_build_object('allowed',false,'code','QUOTA_EXCEEDED');
 else count_used:=count_used+1; insert into public.usage_counters(user_id,feature,period,used) values(uid,p_feature,per,count_used) on conflict(user_id,feature,period) do update set used=excluded.used,updated_at=now(); response:=jsonb_build_object('allowed',true,'feature',p_feature,'period',to_char(per,'YYYY-MM'),'used',count_used,'limit',lim,'remaining',lim-count_used,'duplicate',false); end if;
 insert into public.usage_ledger(user_id,feature,period,idempotency_key,allowed,response) values(uid,p_feature,per,p_idempotency_key,coalesce((response->>'allowed')::boolean,false),response);
 return response;
end $$;

create or replace function public.set_billing_override(p_user_id uuid,p_value boolean,p_reason text,p_actor text default 'billing-admin')
returns jsonb language plpgsql security definer set search_path='' as $$
declare before_state jsonb; after_state jsonb;
begin
 if btrim(coalesce(p_reason,''))='' or p_actor<>'billing-admin' then raise exception 'VALIDATION_ERROR'; end if;
 before_state:=public.billing_entitlement(p_user_id)||jsonb_build_object('override',(select value from public.billing_overrides where user_id=p_user_id));
 if p_value is null then delete from public.billing_overrides where user_id=p_user_id; else insert into public.billing_overrides(user_id,value,reason,actor) values(p_user_id,p_value,p_reason,p_actor) on conflict(user_id) do update set value=excluded.value,reason=excluded.reason,actor=excluded.actor,updated_at=now(); end if;
 after_state:=public.billing_entitlement(p_user_id)||jsonb_build_object('override',p_value);
 insert into public.billing_override_audit(user_id,actor,reason,before_state,after_state) values(p_user_id,p_actor,p_reason,before_state,after_state);
 return jsonb_build_object('before',before_state,'after',after_state);
end $$;

revoke all on function public.billing_entitlement(uuid),public.process_stripe_event(text,text,bigint,uuid,text,text,text,timestamptz,boolean,jsonb),public.reconcile_subscription(uuid,text,text,text,timestamptz,boolean,bigint,text),public.consume_usage(text,text),public.set_billing_override(uuid,boolean,text,text) from public, anon, authenticated, service_role;
grant execute on function public.consume_usage(text,text) to authenticated;
grant execute on function public.billing_entitlement(uuid),public.process_stripe_event(text,text,bigint,uuid,text,text,text,timestamptz,boolean,jsonb),public.reconcile_subscription(uuid,text,text,text,timestamptz,boolean,bigint,text),public.set_billing_override(uuid,boolean,text,text) to service_role;

-- Conservative, idempotent backfill: never lowers existing counters.
insert into public.usage_counters(user_id,feature,period,used) select user_id,'receipt_ocr',period_start,consumed from public.ocr_monthly_usage on conflict(user_id,feature,period) do update set used=greatest(public.usage_counters.used,excluded.used);
insert into public.usage_counters(user_id,feature,period,used) select user_id,'recipe_suggestions',period_start,consumed from public.recipe_monthly_usage on conflict(user_id,feature,period) do update set used=greatest(public.usage_counters.used,excluded.used);
insert into public.usage_counters(user_id,feature,period,used) select user_id,'recipe_import',period_start,consumed from public.recipe_import_usage on conflict(user_id,feature,period) do update set used=greatest(public.usage_counters.used,excluded.used);
