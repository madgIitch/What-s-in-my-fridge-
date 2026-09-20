create or replace function public.confirm_receipt_draft(p_draft_id uuid,p_lines jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v public.receipt_drafts%rowtype; l jsonb; ids jsonb:='[]'::jsonb; item_id uuid; q numeric; n text;
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
