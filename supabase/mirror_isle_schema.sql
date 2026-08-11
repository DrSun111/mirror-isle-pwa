create extension if not exists pgcrypto;

create table if not exists public.mirror_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nickname text not null default '镜屿用户',
  city text not null default '未设定',
  goal text not null default '深度朋友',
  privacy text not null default 'friends' check (privacy in ('private', 'friends', 'public')),
  age_confirmed boolean not null default false,
  identity_status text not null default 'unsubmitted' check (
    identity_status in ('unsubmitted', 'pending_manual_review', 'verified', 'rejected')
  ),
  traits jsonb not null default '{"values":50,"lifestyle":50,"relationship":50,"communication":50,"growth":50,"boundary":50}',
  answers jsonb not null default '{}',
  confidence integer not null default 48,
  anchors text[] not null default array['深度探索者'],
  intro text not null default '刚刚来到镜屿，正在完成自己的心谱。',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.mirror_profiles add column if not exists email text;
create unique index if not exists mirror_profiles_email_unique_idx
on public.mirror_profiles (lower(email))
where email is not null and btrim(email) <> '';

create table if not exists public.mirror_tree_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author text not null default '镜屿用户',
  visibility text not null default 'friends' check (visibility in ('private', 'friends', 'public')),
  content text not null check (char_length(content) between 1 and 4000),
  images text[] not null default '{}',
  tags text[] not null default '{}',
  status text not null default 'approved' check (status in ('approved', 'pending', 'rejected')),
  moderation jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.mirror_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'blocked', 'archived')),
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  constraint mirror_conversations_distinct_users check (user_a <> user_b),
  constraint mirror_conversations_unique_pair unique (user_a, user_b)
);

create table if not exists public.mirror_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.mirror_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  status text not null default 'approved' check (status in ('approved', 'pending', 'rejected')),
  moderation jsonb not null default '{}',
  created_at timestamptz not null default now()
);

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'mirror_tree_posts'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%char_length(content)%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.mirror_tree_posts drop constraint %I', constraint_name);
  end if;

  alter table public.mirror_tree_posts
    add constraint mirror_tree_posts_content_length check (char_length(content) between 1 and 4000);
end $$;

create table if not exists public.mirror_friends (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mirror_friends_distinct_users check (requester_id <> addressee_id)
);

create index if not exists mirror_tree_posts_created_at_idx on public.mirror_tree_posts (created_at desc);
create index if not exists mirror_messages_conversation_created_idx on public.mirror_messages (conversation_id, created_at);
create index if not exists mirror_friends_requester_idx on public.mirror_friends (requester_id);
create index if not exists mirror_friends_addressee_idx on public.mirror_friends (addressee_id);
create unique index if not exists mirror_friends_unique_pair_idx
on public.mirror_friends (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);

create or replace function public.mirror_content_moderation(content text)
returns jsonb
language plpgsql
stable
as $$
declare
  labels text[] := '{}';
begin
  if content ~* '(微信|VX|QQ|手机号|电话|转账|投资|贷款|裸聊|约炮|自杀|轻生)' then
    labels := array_append(labels, 'risk_keyword');
  end if;

  if content ~ '\m1[3-9][0-9]{9}\M' then
    labels := array_append(labels, 'phone_number');
  end if;

  if content ~* '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' then
    labels := array_append(labels, 'email');
  end if;

  return jsonb_build_object(
    'status', case when array_length(labels, 1) is null then 'approved' else 'pending' end,
    'labels', labels,
    'provider', 'postgres_rules'
  );
end;
$$;

create or replace function public.mirror_set_tree_post_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  new.user_id := auth.uid();
  select nickname into new.author from public.mirror_profiles where id = auth.uid();
  new.author := coalesce(new.author, '镜屿用户');
  result := public.mirror_content_moderation(new.content);
  new.status := result->>'status';
  new.moderation := result;
  new.created_at := coalesce(new.created_at, now());
  return new;
end;
$$;

drop trigger if exists mirror_tree_posts_defaults on public.mirror_tree_posts;
create trigger mirror_tree_posts_defaults
before insert on public.mirror_tree_posts
for each row execute function public.mirror_set_tree_post_defaults();

create or replace function public.mirror_set_message_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  new.sender_id := auth.uid();
  result := public.mirror_content_moderation(new.content);
  new.status := result->>'status';
  new.moderation := result;
  new.created_at := coalesce(new.created_at, now());

  update public.mirror_conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists mirror_messages_defaults on public.mirror_messages;
create trigger mirror_messages_defaults
before insert on public.mirror_messages
for each row execute function public.mirror_set_message_defaults();

alter table public.mirror_profiles enable row level security;
alter table public.mirror_tree_posts enable row level security;
alter table public.mirror_conversations enable row level security;
alter table public.mirror_messages enable row level security;
alter table public.mirror_friends enable row level security;

drop policy if exists "profiles can be read by beta users" on public.mirror_profiles;
create policy "profiles can be read by beta users"
on public.mirror_profiles
for select
to authenticated
using (age_confirmed = true or id = auth.uid());

drop policy if exists "users can insert own profile" on public.mirror_profiles;
create policy "users can insert own profile"
on public.mirror_profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "users can update own profile" on public.mirror_profiles;
create policy "users can update own profile"
on public.mirror_profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "tree posts visible to beta users" on public.mirror_tree_posts;
create policy "tree posts visible to beta users"
on public.mirror_tree_posts
for select
to authenticated
using (status = 'approved' or user_id = auth.uid());

drop policy if exists "users can create own tree posts" on public.mirror_tree_posts;
create policy "users can create own tree posts"
on public.mirror_tree_posts
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "members can read conversations" on public.mirror_conversations;
create policy "members can read conversations"
on public.mirror_conversations
for select
to authenticated
using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "members can create conversations" on public.mirror_conversations;
create policy "members can create conversations"
on public.mirror_conversations
for insert
to authenticated
with check (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "members can update conversations" on public.mirror_conversations;
create policy "members can update conversations"
on public.mirror_conversations
for update
to authenticated
using (auth.uid() = user_a or auth.uid() = user_b)
with check (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "members can read messages" on public.mirror_messages;
create policy "members can read messages"
on public.mirror_messages
for select
to authenticated
using (
  exists (
    select 1 from public.mirror_conversations c
    where c.id = conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);

drop policy if exists "members can send messages" on public.mirror_messages;
create policy "members can send messages"
on public.mirror_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.mirror_conversations c
    where c.id = conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);

drop policy if exists "friend members can read friendships" on public.mirror_friends;
create policy "friend members can read friendships"
on public.mirror_friends
for select
to authenticated
using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "users can create friendships" on public.mirror_friends;
create policy "users can create friendships"
on public.mirror_friends
for insert
to authenticated
with check (auth.uid() = requester_id);

drop policy if exists "friend members can update friendships" on public.mirror_friends;
create policy "friend members can update friendships"
on public.mirror_friends
for update
to authenticated
using (auth.uid() = requester_id or auth.uid() = addressee_id)
with check (auth.uid() = requester_id or auth.uid() = addressee_id);

create table if not exists public.mirror_app_releases (
  version text primary key,
  apk_url text not null,
  page_url text not null,
  notes text not null default '',
  mandatory boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.mirror_tree_posts add column if not exists images text[] not null default '{}';

create index if not exists mirror_app_releases_active_created_idx
on public.mirror_app_releases (is_active, created_at desc);

alter table public.mirror_app_releases enable row level security;

drop policy if exists "active releases are public" on public.mirror_app_releases;
create policy "active releases are public"
on public.mirror_app_releases
for select
to anon, authenticated
using (is_active = true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mirror-media',
  'mirror-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mirror-releases',
  'mirror-releases',
  true,
  52428800,
  array['application/vnd.android.package-archive', 'application/octet-stream']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "mirror public storage read" on storage.objects;
create policy "mirror public storage read"
on storage.objects
for select
to public
using (bucket_id in ('mirror-media', 'mirror-releases'));

drop policy if exists "mirror users upload own media" on storage.objects;
create policy "mirror users upload own media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'mirror-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "mirror users update own media" on storage.objects;
create policy "mirror users update own media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'mirror-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'mirror-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "mirror users delete own media" on storage.objects;
create policy "mirror users delete own media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'mirror-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
