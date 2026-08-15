create table if not exists public.mirror_invite_codes (
  code text primary key,
  active boolean not null default true,
  max_uses integer not null default 500 check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mirror_invite_codes enable row level security;

create table if not exists public.mirror_invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.mirror_invite_codes(code) on update cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  redeemed_at timestamptz not null default now()
);
alter table public.mirror_invite_redemptions enable row level security;

insert into public.mirror_invite_codes (code, active, max_uses)
values ('JINGYU2026', true, 500), ('MIRROR2026', true, 500), ('NEICE2026', true, 500)
on conflict (code) do update set active = excluded.active, updated_at = now();

create or replace function public.mirror_redeem_invite(p_code text, p_user_id uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := upper(trim(p_code));
  v_updated integer;
begin
  update public.mirror_invite_codes
  set used_count = used_count + 1, updated_at = now()
  where code = v_code and active = true and used_count < max_uses and (expires_at is null or expires_at > now());
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then return false; end if;
  begin
    insert into public.mirror_invite_redemptions(code, user_id, email)
    values (v_code, p_user_id, lower(trim(p_email)));
  exception when unique_violation then
    update public.mirror_invite_codes set used_count = greatest(used_count - 1, 0), updated_at = now() where code = v_code;
    return false;
  end;
  return true;
end;
$$;
revoke all on function public.mirror_redeem_invite(text, uuid, text) from public, anon, authenticated;
grant execute on function public.mirror_redeem_invite(text, uuid, text) to service_role;

create or replace function public.mirror_content_moderation(content text)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare labels text[] := '{}';
begin
  if content ~* '(微信|VX|QQ|手机号|电话|转账|投资|贷款|裸聊|约炮|自杀|轻生)' then labels := array_append(labels, 'risk_keyword'); end if;
  if content ~ '\m1[3-9][0-9]{9}\M' then labels := array_append(labels, 'phone_number'); end if;
  if content ~* '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' then labels := array_append(labels, 'email'); end if;
  return jsonb_build_object('status', case when array_length(labels, 1) is null then 'approved' else 'pending' end, 'labels', labels, 'provider', 'postgres_rules');
end;
$$;
revoke execute on function public.mirror_set_message_defaults() from public, anon, authenticated;
revoke execute on function public.mirror_set_tree_post_defaults() from public, anon, authenticated;
