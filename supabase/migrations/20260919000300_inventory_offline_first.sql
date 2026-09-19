-- Sprint 4: additive offline-first inventory contract.
alter table public.inventory_items
  alter column expiry_date type date using (expiry_date at time zone 'UTC')::date;

create table public.client_mutations (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_mutation_id uuid not null,
  operation text not null check (operation in ('create', 'update', 'delete')),
  item_id uuid not null,
  expected_version bigint,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null check (status in ('applied', 'conflict', 'rejected')),
  code text not null check (code in ('OK', 'SYNC_CONFLICT', 'AUTH_REQUIRED', 'FORBIDDEN', 'VALIDATION_ERROR')),
  result_item jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_mutation_id)
);

alter table public.client_mutations enable row level security;
create policy client_mutations_select_own on public.client_mutations
  for select to authenticated using (public.owns_row(user_id));

create index client_mutations_owner_created_idx
  on public.client_mutations(user_id, created_at, client_mutation_id);
create index inventory_items_sync_cursor_idx
  on public.inventory_items(user_id, updated_at, id);

-- Technical timestamps and versions are server-owned even for legacy direct updates.
create or replace function public.inventory_server_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := clock_timestamp();
  if old.deleted_at is not null then
    new.deleted_at := old.deleted_at;
  end if;
  return new;
end;
$$;

create trigger inventory_server_fields_before_update
before update on public.inventory_items
for each row execute function public.inventory_server_fields();

create or replace function public.apply_inventory_mutation(
  p_client_mutation_id uuid,
  p_operation text,
  p_item_id uuid,
  p_expected_version bigint default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.client_mutations%rowtype;
  v_item public.inventory_items%rowtype;
  v_status text := 'applied';
  v_code text := 'OK';
  v_result jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('client_mutation_id', p_client_mutation_id, 'status', 'rejected', 'code', 'AUTH_REQUIRED', 'item', null);
  end if;

  select * into v_existing
  from public.client_mutations
  where user_id = v_user_id and client_mutation_id = p_client_mutation_id;
  if found then
    return jsonb_build_object(
      'client_mutation_id', p_client_mutation_id,
      'status', 'duplicate',
      'code', v_existing.code,
      'item', v_existing.result_item
    );
  end if;

  if p_operation not in ('create', 'update', 'delete')
    or jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object'
    or (p_operation = 'create' and p_expected_version is not null)
    or (p_operation in ('update', 'delete') and coalesce(p_expected_version, 0) <= 0) then
    v_status := 'rejected'; v_code := 'VALIDATION_ERROR';
  elsif p_operation = 'create' then
    if nullif(btrim(p_payload->>'name'), '') is null
      or (p_payload->>'expiry_date') !~ '^\d{4}-\d{2}-\d{2}$'
      or coalesce((p_payload->>'quantity')::numeric, -1) < 0
      or nullif(btrim(p_payload->>'unit'), '') is null then
      v_status := 'rejected'; v_code := 'VALIDATION_ERROR';
    else
      insert into public.inventory_items (
        id, user_id, name, normalized_name, expiry_date, category,
        quantity, notes, unit, added_at, source
      ) values (
        p_item_id, v_user_id, btrim(p_payload->>'name'), nullif(p_payload->>'normalized_name', ''),
        (p_payload->>'expiry_date')::date, nullif(p_payload->>'category', ''),
        (p_payload->>'quantity')::numeric, nullif(p_payload->>'notes', ''),
        btrim(p_payload->>'unit'), coalesce((p_payload->>'added_at')::timestamptz, now()), 'APP'
      )
      returning * into v_item;
    end if;
  else
    select * into v_item from public.inventory_items
      where id = p_item_id and user_id = v_user_id for update;
    if not found then
      v_status := 'rejected'; v_code := 'FORBIDDEN';
    elsif v_item.version <> p_expected_version or v_item.deleted_at is not null then
      v_status := 'conflict'; v_code := 'SYNC_CONFLICT';
    elsif p_operation = 'delete' then
      update public.inventory_items set deleted_at = clock_timestamp()
        where id = p_item_id and user_id = v_user_id returning * into v_item;
    else
      update public.inventory_items set
        name = coalesce(nullif(btrim(p_payload->>'name'), ''), name),
        normalized_name = case when p_payload ? 'normalized_name' then nullif(p_payload->>'normalized_name', '') else normalized_name end,
        expiry_date = case when p_payload ? 'expiry_date' then (p_payload->>'expiry_date')::date else expiry_date end,
        category = case when p_payload ? 'category' then nullif(p_payload->>'category', '') else category end,
        quantity = case when p_payload ? 'quantity' then (p_payload->>'quantity')::numeric else quantity end,
        notes = case when p_payload ? 'notes' then nullif(p_payload->>'notes', '') else notes end,
        unit = coalesce(nullif(btrim(p_payload->>'unit'), ''), unit)
      where id = p_item_id and user_id = v_user_id returning * into v_item;
    end if;
  end if;

  v_result := case when v_item.id is null then null else to_jsonb(v_item) end;
  insert into public.client_mutations (
    user_id, client_mutation_id, operation, item_id, expected_version,
    payload, status, code, result_item
  ) values (
    v_user_id, p_client_mutation_id, p_operation, p_item_id, p_expected_version,
    coalesce(p_payload, '{}'::jsonb), v_status, v_code, v_result
  );

  return jsonb_build_object('client_mutation_id', p_client_mutation_id, 'status', v_status, 'code', v_code, 'item', v_result);
exception
  when unique_violation then
    select * into v_existing from public.client_mutations
      where user_id = v_user_id and client_mutation_id = p_client_mutation_id;
    return jsonb_build_object('client_mutation_id', p_client_mutation_id, 'status', 'duplicate', 'code', v_existing.code, 'item', v_existing.result_item);
  when invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range or check_violation then
    return jsonb_build_object('client_mutation_id', p_client_mutation_id, 'status', 'rejected', 'code', 'VALIDATION_ERROR', 'item', null);
end;
$$;

revoke all on function public.apply_inventory_mutation(uuid, text, uuid, bigint, jsonb) from public;
grant execute on function public.apply_inventory_mutation(uuid, text, uuid, bigint, jsonb) to authenticated;
grant select on public.client_mutations to authenticated;
