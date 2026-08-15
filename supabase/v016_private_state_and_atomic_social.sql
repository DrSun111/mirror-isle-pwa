-- Mirror Isle v0.16
-- Applied to production Supabase project mvbjhesgjwcyzqavqoyv.
-- Purpose: move psychological/mood/wallet/sync state out of the broadly readable profile row,
-- make daily rewards and drifting atomic, and make private tree-hole content account-synced.

create table if not exists public.mirror_mood_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  mood text not null check (mood in ('sunny','breeze','cloudy','rain','wave')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, checkin_date)
);
alter table public.mirror_mood_checkins enable row level security;
create policy "users manage own mood checkins" on public.mirror_mood_checkins
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.mirror_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  bottle_credits integer not null default 0 check (bottle_credits >= 0),
  updated_at timestamptz not null default now()
);
alter table public.mirror_wallets enable row level security;
create policy "users manage own wallet" on public.mirror_wallets
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.mirror_bottle_picks (
  user_id uuid not null references auth.users(id) on delete cascade,
  bottle_id uuid not null references public.mirror_tree_posts(id) on delete cascade,
  picked_at timestamptz not null default now(),
  primary key (user_id, bottle_id)
);
alter table public.mirror_bottle_picks enable row level security;
create policy "users read own bottle picks" on public.mirror_bottle_picks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "users insert own bottle picks" on public.mirror_bottle_picks
  for insert to authenticated with check ((select auth.uid()) = user_id);

create table if not exists public.mirror_wellbeing_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  responses smallint[] not null,
  raw_score smallint not null check (raw_score between 0 and 25),
  percentage smallint not null check (percentage between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, checkin_date),
  constraint mirror_wellbeing_five_responses check (array_length(responses, 1) = 5)
);
alter table public.mirror_wellbeing_checkins enable row level security;
create policy "users manage own wellbeing" on public.mirror_wellbeing_checkins
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.mirror_assessment_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  instrument text not null default 'IPIP-derived-situational',
  version text not null default 'v016',
  scores jsonb not null default '{}'::jsonb,
  responses jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mirror_assessment_profiles enable row level security;
create policy "users manage own assessment profile" on public.mirror_assessment_profiles
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.mirror_user_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  drift_seen_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.mirror_user_sync_state enable row level security;
create policy "users manage own sync state" on public.mirror_user_sync_state
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index if not exists mirror_mood_checkins_user_date_idx on public.mirror_mood_checkins(user_id, checkin_date desc);
create index if not exists mirror_bottle_picks_user_time_idx on public.mirror_bottle_picks(user_id, picked_at desc);
create index if not exists mirror_wellbeing_user_date_idx on public.mirror_wellbeing_checkins(user_id, checkin_date desc);

-- Old clients may still attempt to persist login email/raw answers in mirror_profiles.
-- The trigger keeps only the intentionally public profile payload.
create or replace function public.mirror_sanitize_profile_private_fields()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.email := null;
  if new.answers is null then
    new.answers := '{}'::jsonb;
  elsif new.answers ? 'public_profile' then
    new.answers := jsonb_build_object('public_profile', new.answers -> 'public_profile');
  else
    new.answers := '{}'::jsonb;
  end if;
  return new;
end;
$$;

drop trigger if exists mirror_sanitize_profile_private_fields_trigger on public.mirror_profiles;
create trigger mirror_sanitize_profile_private_fields_trigger
before insert or update of email, answers on public.mirror_profiles
for each row execute function public.mirror_sanitize_profile_private_fields();

create or replace function public.mirror_record_mood(p_date date, p_mood text, p_note text default '')
returns table(points integer, bottle_credits integer, awarded boolean)
language plpgsql security invoker set search_path = public, auth, pg_temp as $$
declare v_uid uuid := auth.uid(); v_inserted boolean := false;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_mood not in ('sunny','breeze','cloudy','rain','wave') then raise exception 'invalid_mood'; end if;
  insert into public.mirror_mood_checkins(user_id, checkin_date, mood, note)
    values (v_uid, p_date, p_mood, left(coalesce(p_note,''),500))
    on conflict (user_id, checkin_date) do nothing;
  v_inserted := found;
  if not v_inserted then
    update public.mirror_mood_checkins set mood=p_mood, note=left(coalesce(p_note,''),500), updated_at=now()
    where user_id=v_uid and checkin_date=p_date;
  end if;
  insert into public.mirror_wallets(user_id, points) values (v_uid, case when v_inserted then 10 else 0 end)
  on conflict (user_id) do update set points=public.mirror_wallets.points + case when v_inserted then 10 else 0 end, updated_at=now();
  return query select w.points,w.bottle_credits,v_inserted from public.mirror_wallets w where w.user_id=v_uid;
end;
$$;

create or replace function public.mirror_redeem_bottle_credit()
returns table(points integer, bottle_credits integer)
language plpgsql security invoker set search_path = public, auth, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  insert into public.mirror_wallets(user_id) values (v_uid) on conflict do nothing;
  update public.mirror_wallets set points=points-10,bottle_credits=bottle_credits+1,updated_at=now()
  where user_id=v_uid and points>=10;
  if not found then raise exception 'not_enough_points'; end if;
  return query select w.points,w.bottle_credits from public.mirror_wallets w where w.user_id=v_uid;
end;
$$;

create or replace function public.mirror_pick_drift_bottle()
returns table(id uuid, content text, author text, tags text[], created_at timestamptz, points integer, bottle_credits integer)
language plpgsql security invoker set search_path = public, auth, pg_temp as $$
declare v_uid uuid := auth.uid(); v_bottle public.mirror_tree_posts%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  insert into public.mirror_wallets(user_id) values (v_uid) on conflict do nothing;
  perform 1 from public.mirror_wallets where user_id=v_uid and bottle_credits>0 for update;
  if not found then raise exception 'no_bottle_credit'; end if;
  select p.* into v_bottle from public.mirror_tree_posts p
    where p.status='approved' and p.visibility='public' and p.user_id<>v_uid
      and coalesce(p.tags,'{}'::text[]) @> array['漂流瓶']::text[]
      and not (coalesce(p.tags,'{}'::text[]) @> array['漂流回信']::text[])
      and not exists (select 1 from public.mirror_bottle_picks bp where bp.user_id=v_uid and bp.bottle_id=p.id)
    order by random() limit 1;
  if v_bottle.id is null then return; end if;
  insert into public.mirror_bottle_picks(user_id,bottle_id) values (v_uid,v_bottle.id);
  update public.mirror_wallets set bottle_credits=bottle_credits-1,updated_at=now() where user_id=v_uid;
  return query select v_bottle.id,v_bottle.content,v_bottle.author,coalesce(v_bottle.tags,'{}'::text[]),v_bottle.created_at,w.points,w.bottle_credits
  from public.mirror_wallets w where w.user_id=v_uid;
end;
$$;

create or replace function public.mirror_save_wellbeing(p_date date, p_responses smallint[])
returns table(raw_score smallint, percentage smallint)
language plpgsql security invoker set search_path = public, auth, pg_temp as $$
declare v_uid uuid:=auth.uid(); v_raw integer; v_pct integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if array_length(p_responses,1)<>5 then raise exception 'five_responses_required'; end if;
  if exists(select 1 from unnest(p_responses) x where x<0 or x>5) then raise exception 'response_out_of_range'; end if;
  select coalesce(sum(x),0) into v_raw from unnest(p_responses) x; v_pct:=v_raw*4;
  insert into public.mirror_wellbeing_checkins(user_id,checkin_date,responses,raw_score,percentage)
  values(v_uid,p_date,p_responses,v_raw,v_pct)
  on conflict(user_id,checkin_date) do update set responses=excluded.responses,raw_score=excluded.raw_score,percentage=excluded.percentage,updated_at=now();
  return query select v_raw::smallint,v_pct::smallint;
end;
$$;

create or replace function public.mirror_save_assessment(p_scores jsonb, p_responses jsonb)
returns void language plpgsql security invoker set search_path = public, auth, pg_temp as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  insert into public.mirror_assessment_profiles(user_id,instrument,version,scores,responses,completed_at,updated_at)
  values(v_uid,'IPIP-Big-Five-derived-situational','v016',coalesce(p_scores,'{}'::jsonb),coalesce(p_responses,'{}'::jsonb),now(),now())
  on conflict(user_id) do update set instrument=excluded.instrument,version=excluded.version,scores=excluded.scores,responses=excluded.responses,completed_at=now(),updated_at=now();
end;
$$;

revoke execute on function public.mirror_record_mood(date,text,text) from anon;
revoke execute on function public.mirror_redeem_bottle_credit() from anon;
revoke execute on function public.mirror_pick_drift_bottle() from anon;
revoke execute on function public.mirror_save_wellbeing(date,smallint[]) from anon;
revoke execute on function public.mirror_save_assessment(jsonb,jsonb) from anon;
grant execute on function public.mirror_record_mood(date,text,text) to authenticated;
grant execute on function public.mirror_redeem_bottle_credit() to authenticated;
grant execute on function public.mirror_pick_drift_bottle() to authenticated;
grant execute on function public.mirror_save_wellbeing(date,smallint[]) to authenticated;
grant execute on function public.mirror_save_assessment(jsonb,jsonb) to authenticated;
