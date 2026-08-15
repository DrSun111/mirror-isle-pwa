-- Mirror Isle v0.15 production privacy and RLS hardening.
-- Auth owns login email; public profiles never persist it.
update public.mirror_profiles set email = null where email is not null;

create or replace function public.mirror_strip_profile_email()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.email := null;
  return new;
end;
$$;

drop trigger if exists mirror_strip_profile_email_trigger on public.mirror_profiles;
create trigger mirror_strip_profile_email_trigger
before insert or update of email on public.mirror_profiles
for each row execute function public.mirror_strip_profile_email();

revoke all on public.mirror_invite_codes from anon, authenticated;
revoke all on public.mirror_invite_redemptions from anon, authenticated;

drop policy if exists "tree posts visible to beta users" on public.mirror_tree_posts;
create policy "tree posts visible by privacy"
on public.mirror_tree_posts
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (status = 'approved' and visibility = 'public')
  or (
    status = 'approved'
    and visibility = 'friends'
    and exists (
      select 1
      from public.mirror_friends f
      where f.status = 'accepted'
        and (
          (f.requester_id = (select auth.uid()) and f.addressee_id = mirror_tree_posts.user_id)
          or (f.addressee_id = (select auth.uid()) and f.requester_id = mirror_tree_posts.user_id)
        )
    )
  )
);

drop policy if exists "profiles can be read by beta users" on public.mirror_profiles;
create policy "profiles can be read by beta users"
on public.mirror_profiles for select to authenticated
using (age_confirmed = true or id = (select auth.uid()));

drop policy if exists "users can insert own profile" on public.mirror_profiles;
create policy "users can insert own profile"
on public.mirror_profiles for insert to authenticated
with check (id = (select auth.uid()));

drop policy if exists "users can update own profile" on public.mirror_profiles;
create policy "users can update own profile"
on public.mirror_profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "users can create own tree posts" on public.mirror_tree_posts;
create policy "users can create own tree posts"
on public.mirror_tree_posts for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "members can read conversations" on public.mirror_conversations;
create policy "members can read conversations"
on public.mirror_conversations for select to authenticated
using ((select auth.uid()) = user_a or (select auth.uid()) = user_b);

drop policy if exists "members can create conversations" on public.mirror_conversations;
create policy "members can create conversations"
on public.mirror_conversations for insert to authenticated
with check ((select auth.uid()) = user_a or (select auth.uid()) = user_b);

drop policy if exists "members can update conversations" on public.mirror_conversations;
create policy "members can update conversations"
on public.mirror_conversations for update to authenticated
using ((select auth.uid()) = user_a or (select auth.uid()) = user_b)
with check ((select auth.uid()) = user_a or (select auth.uid()) = user_b);

drop policy if exists "members can read messages" on public.mirror_messages;
create policy "members can read messages"
on public.mirror_messages for select to authenticated
using (exists (
  select 1 from public.mirror_conversations c
  where c.id = mirror_messages.conversation_id
    and (c.user_a = (select auth.uid()) or c.user_b = (select auth.uid()))
));

drop policy if exists "members can send messages" on public.mirror_messages;
create policy "members can send messages"
on public.mirror_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.mirror_conversations c
    where c.id = mirror_messages.conversation_id
      and (c.user_a = (select auth.uid()) or c.user_b = (select auth.uid()))
  )
);

drop policy if exists "friend members can read friendships" on public.mirror_friends;
create policy "friend members can read friendships"
on public.mirror_friends for select to authenticated
using ((select auth.uid()) = requester_id or (select auth.uid()) = addressee_id);

drop policy if exists "users can create friendships" on public.mirror_friends;
create policy "users can create friendships"
on public.mirror_friends for insert to authenticated
with check ((select auth.uid()) = requester_id);

drop policy if exists "friend members can update friendships" on public.mirror_friends;
create policy "friend members can update friendships"
on public.mirror_friends for update to authenticated
using ((select auth.uid()) = requester_id or (select auth.uid()) = addressee_id)
with check ((select auth.uid()) = requester_id or (select auth.uid()) = addressee_id);

create index if not exists mirror_conversations_user_b_idx on public.mirror_conversations(user_b);
create index if not exists mirror_messages_sender_id_idx on public.mirror_messages(sender_id);
create index if not exists mirror_tree_posts_user_id_idx on public.mirror_tree_posts(user_id);
create index if not exists mirror_tree_posts_visibility_status_created_idx on public.mirror_tree_posts(visibility, status, created_at desc);
create index if not exists mirror_invite_redemptions_code_idx on public.mirror_invite_redemptions(code);
create index if not exists mirror_friends_addressee_status_idx on public.mirror_friends(addressee_id, status);
create index if not exists mirror_friends_requester_status_idx on public.mirror_friends(requester_id, status);
