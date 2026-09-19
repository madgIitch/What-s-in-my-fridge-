create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.link_firebase_auth_identity(target_user_id uuid, firebase_uid text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare existing_target uuid;
begin
  if firebase_uid is null or btrim(firebase_uid) = '' then
    raise exception 'firebase_uid_required' using errcode = '22023';
  end if;

  select target_id into existing_target
  from public.legacy_id_map
  where source = 'FIREBASE' and entity_type = 'auth_user' and legacy_id = firebase_uid;

  if existing_target is not null and existing_target <> target_user_id then
    raise exception 'firebase_uid_already_linked' using errcode = '23505';
  end if;

  insert into public.legacy_id_map (user_id, source, entity_type, legacy_id, target_id)
  values (target_user_id, 'FIREBASE', 'auth_user', firebase_uid, target_user_id)
  on conflict (source, entity_type, legacy_id) do nothing;
end;
$$;

revoke all on function public.link_firebase_auth_identity(uuid, text) from public, anon, authenticated;
grant execute on function public.link_firebase_auth_identity(uuid, text) to service_role;
