-- Goodness: tamper-proof rules, anonymous peer verification, witness confirmation,
-- partner rewards and donations. All scoring happens here, never in the browser.

-- ---------- Clean out the old browser-trusting setup ----------
drop policy if exists "profiles readable" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
drop policy if exists "deeds readable" on public.deeds;
drop policy if exists "deeds insert own" on public.deeds;
drop policy if exists "deeds update" on public.deeds;
drop policy if exists "validations readable" on public.validations;
drop policy if exists "validations insert own" on public.validations;
drop policy if exists "transactions insert" on public.transactions;
drop policy if exists "notifications insert" on public.notifications;
drop table if exists public.user_badges;
drop table if exists public.charity_votes;
drop function if exists public.increment_charity_votes(uuid);

-- ---------- Columns ----------
alter table public.profiles alter column trust_score set default 60;
alter table public.profiles add column if not exists votes_cast integer not null default 0;
alter table public.profiles add column if not exists votes_agreed integer not null default 0;

alter table public.deeds add column if not exists witness_token uuid not null default gen_random_uuid();
alter table public.deeds add column if not exists witness_confirmed_at timestamptz;
alter table public.deeds add column if not exists approve_weight numeric not null default 0;
alter table public.deeds add column if not exists reject_weight numeric not null default 0;
alter table public.deeds add column if not exists resolved_at timestamptz;
create unique index if not exists deeds_witness_token_idx on public.deeds (witness_token);
create index if not exists deeds_pending_idx on public.deeds (validation_status, created_at);

alter table public.validations add column if not exists weight numeric not null default 1;

alter table public.badges add column if not exists category public.deed_category;
update public.badges set category = 'Personal Help' where name = 'Helping Hand';
update public.badges set category = 'Environmental' where name = 'Nature Guardian';
update public.badges set category = 'Social Good' where name = 'Community Leader';
update public.badges set category = 'Educational' where name = 'Knowledge Sharer';
update public.badges set category = 'Charitable' where name = 'Generous Soul';
insert into public.badges (name, description, image, required_deeds, category)
select v.* from (values
  ('Spark', '10 good deeds of any kind', '✨', 10, null::public.deed_category),
  ('Lightbringer', '50 good deeds of any kind', '🌟', 50, null::public.deed_category)
) as v(name, description, image, required_deeds, category)
where not exists (select 1 from public.badges b where b.name = v.name);

alter table public.charities add column if not exists tokens_donated integer not null default 0;

-- ---------- Rewards, redemptions, donations ----------
create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  partner text not null,
  title text not null,
  description text,
  cost integer not null check (cost > 0),
  stock integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_id uuid not null references public.rewards(id),
  cost integer not null,
  code text not null,
  status text not null default 'issued',
  created_at timestamptz not null default now()
);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  charity_id uuid not null references public.charities(id),
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);

-- Example rewards so the screen isn't empty. Replace with real partners.
insert into public.rewards (partner, title, description, cost)
select * from (values
  ('Sample partner café', 'Free coffee', 'Show the code at the counter', 50),
  ('Sample partner cinema', '2-for-1 movie ticket', 'Valid Monday to Thursday', 150),
  ('Sample partner bookshop', '10% off any book', 'One use per code', 80)
) as v(partner, title, description, cost)
where not exists (select 1 from public.rewards);

-- ---------- Security: read your own data, change nothing directly ----------
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
alter table public.donations enable row level security;

create policy "profiles read own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (name, bio, avatar, is_public, notifications_enabled) on public.profiles to authenticated;

create policy "deeds read own" on public.deeds for select to authenticated using (auth.uid() = user_id);
create policy "validations read own" on public.validations for select to authenticated using (auth.uid() = validator_id);
create policy "rewards readable" on public.rewards for select to authenticated using (active);
create policy "redemptions read own" on public.redemptions for select to authenticated using (auth.uid() = user_id);
create policy "donations read own" on public.donations for select to authenticated using (auth.uid() = user_id);

revoke insert, update, delete on public.deeds, public.validations, public.transactions,
  public.badges, public.charities, public.rewards, public.redemptions, public.donations
  from anon, authenticated;
revoke insert, delete on public.notifications from anon, authenticated;
revoke update on public.notifications from anon, authenticated;
grant update (read) on public.notifications to authenticated;

-- Existing accounts (made before this change) keep a profile
insert into public.profiles (id, name)
select u.id, coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Proof photos
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', true)
on conflict (id) do nothing;
drop policy if exists "upload own proofs" on storage.objects;
create policy "upload own proofs" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Helpers ----------
create or replace function public.token_balance(p_user uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when type = 'earned' then amount when type = 'spent' then -amount else 0 end), 0)::int
  from public.transactions where user_id = p_user;
$$;

create or replace function public.adjust_trust(p_user uuid, p_delta integer)
returns void language sql security definer set search_path = public as $$
  update public.profiles set trust_score = greatest(0, least(100, trust_score + p_delta)) where id = p_user;
$$;

create or replace function public.push_notification(p_user uuid, p_title text, p_message text, p_type public.notification_type)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, message, type) values (p_user, p_title, p_message, p_type);
$$;

-- How much a verifier's vote counts: new or low-trust accounts count half, trusted ones more
create or replace function public.vote_weight(p_user uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when p.trust_score >= 85 then 1.5
    when p.created_at > now() - interval '3 days' or p.trust_score < 60 then 0.5
    else 1
  end
  from public.profiles p where p.id = p_user;
$$;

-- Settle a deed once enough weight is in: pay the author, score every verifier
create or replace function public.resolve_deed(p_deed uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.deeds;
  outcome boolean;
  bonus integer := 0;
  v record;
begin
  select * into d from public.deeds where id = p_deed for update;
  if d.validation_status <> 'Pending' then return; end if;

  if d.approve_weight >= 3 then
    outcome := true;
  elsif d.reject_weight >= 2 then
    outcome := false;
  else
    return;
  end if;

  if outcome then
    if d.witness_confirmed_at is not null then bonus := 5; end if;
    update public.deeds
      set validation_status = 'Verified', tokens_released = true, resolved_at = now(),
          tokens_earned = d.tokens_earned + bonus,
          trust_points_earned = case when d.impact_level = 'High' then 5 else 3 end
      where id = d.id;
    insert into public.transactions (user_id, amount, type, description)
      values (d.user_id, d.tokens_earned + bonus, 'earned', 'Verified: ' || left(d.description, 60));
    perform public.adjust_trust(d.user_id, case when d.impact_level = 'High' then 5 else 3 end);
    perform public.push_notification(d.user_id, 'Deed verified',
      'The community confirmed "' || left(d.description, 40) || '". +' || (d.tokens_earned + bonus) || ' points.', 'token');
  else
    update public.deeds set validation_status = 'Flagged', resolved_at = now() where id = d.id;
    perform public.adjust_trust(d.user_id, -10);
    perform public.push_notification(d.user_id, 'Deed not confirmed',
      'Verifiers could not confirm "' || left(d.description, 40) || '". Your trust score dropped by 10.', 'validation');
  end if;

  -- Verifiers who agreed with the outcome gain trust and a point; the rest lose trust
  for v in select validator_id, is_valid from public.validations where deed_id = d.id loop
    if v.is_valid = outcome then
      perform public.adjust_trust(v.validator_id, 2);
      update public.profiles set votes_agreed = votes_agreed + 1 where id = v.validator_id;
      insert into public.transactions (user_id, amount, type, description)
        values (v.validator_id, 1, 'earned', 'Accurate verification');
    else
      perform public.adjust_trust(v.validator_id, -3);
    end if;
  end loop;
end;
$$;

-- ---------- What the app calls ----------
create or replace function public.log_deed(
  p_description text, p_category public.deed_category, p_impact public.impact_level, p_image_url text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  descr text := btrim(coalesce(p_description, ''));
  today_start timestamptz := date_trunc('day', now());
  n_today integer;
  n_big_today integer;
  small_trust_today boolean;
  new_deed public.deeds;
begin
  if uid is null then raise exception 'Please sign in first'; end if;
  if length(descr) < 3 then raise exception 'Tell us a bit more about what you did'; end if;
  if length(descr) > 280 then raise exception 'Keep it under 280 characters'; end if;

  select count(*) into n_today from public.deeds where user_id = uid and created_at >= today_start;
  if n_today >= 5 then raise exception 'That''s 5 deeds today. Come back tomorrow!'; end if;

  if exists (select 1 from public.deeds where user_id = uid and lower(description) = lower(descr)
             and created_at > now() - interval '24 hours') then
    raise exception 'You already logged this one today';
  end if;

  if p_impact = 'Low' then
    select exists (select 1 from public.deeds where user_id = uid and impact_level = 'Low'
                   and trust_points_earned > 0 and created_at >= today_start) into small_trust_today;
    insert into public.deeds (user_id, description, category, impact_level, image_url, tokens_earned,
      tokens_released, validation_status, trust_points_earned, has_proof, is_high_impact, resolved_at)
    values (uid, descr, p_category, 'Low', p_image_url, 0, true, 'Verified',
      case when small_trust_today then 0 else 1 end, p_image_url is not null, false, now())
    returning * into new_deed;
    if not small_trust_today then perform public.adjust_trust(uid, 1); end if;
  else
    select count(*) into n_big_today from public.deeds
      where user_id = uid and impact_level <> 'Low' and created_at >= today_start;
    if n_big_today >= 3 then raise exception 'You can log 3 bigger deeds a day'; end if;
    if p_impact = 'High' and p_image_url is null then raise exception 'Big deeds need a photo as proof'; end if;
    insert into public.deeds (user_id, description, category, impact_level, image_url, tokens_earned,
      tokens_released, validation_status, has_proof, is_high_impact)
    values (uid, descr, p_category, p_impact, p_image_url, case when p_impact = 'High' then 25 else 15 end,
      false, 'Pending', p_image_url is not null, p_impact = 'High')
    returning * into new_deed;
    perform public.push_notification(uid, 'Sent for verification',
      'Three community members will check "' || left(descr, 40) || '".', 'validation');
  end if;

  return json_build_object('id', new_deed.id, 'status', new_deed.validation_status,
    'tokens', new_deed.tokens_earned, 'witness_token', new_deed.witness_token);
end;
$$;

create or replace function public.can_verify(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select trust_score >= 50 from public.profiles where id = p_user), false);
$$;

create or replace function public.get_verify_queue(p_limit integer default 5)
returns table (deed_id uuid, description text, category public.deed_category, impact public.impact_level,
  image_url text, witness_confirmed boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.id, d.description, d.category, d.impact_level, d.image_url,
         d.witness_confirmed_at is not null, d.created_at
  from public.deeds d
  where public.can_verify(auth.uid())
    and d.validation_status = 'Pending'
    and d.user_id <> auth.uid()
    and not exists (select 1 from public.validations v where v.deed_id = d.id and v.validator_id = auth.uid())
    and (select count(*) from public.validations v2 join public.deeds d2 on d2.id = v2.deed_id
         where v2.validator_id = auth.uid() and d2.user_id = d.user_id
           and v2.created_at > now() - interval '7 days') < 3
  order by (d.approve_weight + d.reject_weight) asc, random()
  limit least(greatest(p_limit, 1), 20);
$$;

create or replace function public.cast_vote(p_deed uuid, p_is_valid boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d public.deeds;
  w numeric;
begin
  if uid is null then raise exception 'Please sign in first'; end if;
  if not public.can_verify(uid) then raise exception 'Your trust score is too low to verify right now'; end if;
  select * into d from public.deeds where id = p_deed for update;
  if d.id is null or d.validation_status <> 'Pending' then raise exception 'This deed is no longer waiting for checks'; end if;
  if d.user_id = uid then raise exception 'You can''t verify your own deed'; end if;
  if exists (select 1 from public.validations where deed_id = p_deed and validator_id = uid) then
    raise exception 'You already checked this one';
  end if;

  w := public.vote_weight(uid);
  insert into public.validations (deed_id, validator_id, is_valid, weight) values (p_deed, uid, p_is_valid, w);
  update public.deeds set
    approve_weight = approve_weight + case when p_is_valid then w else 0 end,
    reject_weight = reject_weight + case when p_is_valid then 0 else w end,
    validation_count = validation_count + 1
  where id = p_deed;
  update public.profiles set votes_cast = votes_cast + 1 where id = uid;
  perform public.resolve_deed(p_deed);
  return 'ok';
end;
$$;

-- The person who was helped confirms (no account needed)
create or replace function public.get_witness_deed(p_token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('description', d.description, 'author', split_part(p.name, ' ', 1),
    'confirmed', d.witness_confirmed_at is not null, 'status', d.validation_status)
  from public.deeds d join public.profiles p on p.id = d.user_id
  where d.witness_token = p_token;
$$;

create or replace function public.confirm_witness(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare d public.deeds;
begin
  select * into d from public.deeds where witness_token = p_token for update;
  if d.id is null then raise exception 'This link is not valid'; end if;
  if auth.uid() = d.user_id then raise exception 'You can''t confirm your own deed'; end if;
  if d.witness_confirmed_at is null then
    update public.deeds set witness_confirmed_at = now(),
      approve_weight = approve_weight + case when validation_status = 'Pending' then 1 else 0 end
    where id = d.id;
    perform public.push_notification(d.user_id, 'Someone confirmed your deed',
      'The person you helped confirmed "' || left(d.description, 40) || '". +5 bonus points when verified.', 'validation');
    perform public.resolve_deed(d.id);
  end if;
  return public.get_witness_deed(p_token);
end;
$$;

create or replace function public.redeem_reward(p_reward uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r public.rewards;
  new_code text;
begin
  if uid is null then raise exception 'Please sign in first'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  select * into r from public.rewards where id = p_reward and active for update;
  if r.id is null then raise exception 'This reward is not available'; end if;
  if r.stock is not null and r.stock <= 0 then raise exception 'Sold out'; end if;
  if public.token_balance(uid) < r.cost then raise exception 'Not enough points yet'; end if;
  new_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
  insert into public.transactions (user_id, amount, type, description)
    values (uid, r.cost, 'spent', r.title || ' · ' || r.partner);
  insert into public.redemptions (user_id, reward_id, cost, code) values (uid, r.id, r.cost, new_code);
  if r.stock is not null then update public.rewards set stock = stock - 1 where id = r.id; end if;
  return json_build_object('code', new_code, 'title', r.title, 'partner', r.partner);
end;
$$;

create or replace function public.donate(p_charity uuid, p_amount integer)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c public.charities;
begin
  if uid is null then raise exception 'Please sign in first'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'Choose an amount'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  select * into c from public.charities where id = p_charity;
  if c.id is null then raise exception 'Charity not found'; end if;
  if public.token_balance(uid) < p_amount then raise exception 'Not enough points yet'; end if;
  insert into public.transactions (user_id, amount, type, description) values (uid, p_amount, 'spent', 'Donated to ' || c.name);
  insert into public.donations (user_id, charity_id, amount) values (uid, c.id, p_amount);
  update public.charities set tokens_donated = tokens_donated + p_amount where id = c.id;
  return 'ok';
end;
$$;

create or replace function public.get_my_stats()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p public.profiles;
  streak integer := 0;
  cur date := current_date;
  week_start date := date_trunc('week', current_date)::date;
  week json;
begin
  select * into p from public.profiles where id = uid;
  if p.id is null then return null; end if;

  if not exists (select 1 from public.deeds where user_id = uid and created_at::date = cur and validation_status <> 'Flagged') then
    cur := cur - 1;
  end if;
  while exists (select 1 from public.deeds where user_id = uid and created_at::date = cur and validation_status <> 'Flagged') loop
    streak := streak + 1;
    cur := cur - 1;
  end loop;

  select json_agg(exists (select 1 from public.deeds where user_id = uid and created_at::date = g::date
                          and validation_status <> 'Flagged') order by g)
    into week from generate_series(week_start, week_start + 6, interval '1 day') g;

  return json_build_object(
    'name', p.name, 'avatar', p.avatar, 'bio', p.bio,
    'is_public', p.is_public, 'notifications_enabled', p.notifications_enabled,
    'trust', p.trust_score,
    'points', public.token_balance(uid),
    'pending_points', (select coalesce(sum(tokens_earned), 0) from public.deeds where user_id = uid and validation_status = 'Pending'),
    'deeds_today', (select count(*) from public.deeds where user_id = uid and created_at >= date_trunc('day', now())),
    'deeds_this_week', (select count(*) from public.deeds where user_id = uid and created_at >= week_start and validation_status <> 'Flagged'),
    'total_deeds', (select count(*) from public.deeds where user_id = uid and validation_status = 'Verified'),
    'streak', streak,
    'week', week,
    'can_verify', public.can_verify(uid),
    'votes_cast', p.votes_cast,
    'votes_agreed', p.votes_agreed,
    'verify_queue_size', (select count(*) from public.get_verify_queue(20))
  );
end;
$$;

create or replace function public.get_my_badges()
returns table (id uuid, name text, description text, image text, required integer, done integer, achieved boolean)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, b.description, b.image, b.required_deeds,
    least(c.n, b.required_deeds)::int, c.n >= b.required_deeds
  from public.badges b
  cross join lateral (
    select count(*)::int as n from public.deeds d
    where d.user_id = auth.uid() and d.validation_status = 'Verified'
      and (b.category is null or d.category = b.category)
  ) c
  order by (c.n >= b.required_deeds) desc, b.required_deeds;
$$;

create or replace function public.get_leaderboard(p_period text default 'week')
returns table (rank integer, name text, avatar text, deeds integer, is_me boolean)
language sql stable security definer set search_path = public as $$
  with counts as (
    select p.id, p.name, p.avatar, count(d.id)::int as n
    from public.profiles p
    left join public.deeds d on d.user_id = p.id and d.validation_status = 'Verified'
      and d.created_at >= case p_period when 'week' then date_trunc('week', now())
                                         when 'month' then date_trunc('month', now())
                                         else '-infinity'::timestamptz end
    where p.is_public or p.id = auth.uid()
    group by p.id
  )
  select (row_number() over (order by n desc, name))::int, name, avatar, n, id = auth.uid()
  from counts where n > 0 or id = auth.uid()
  order by n desc, name
  limit 25;
$$;

create or replace function public.get_charities()
returns table (id uuid, name text, description text, image text, tokens_donated integer)
language sql stable security definer set search_path = public as $$
  select id, name, description, image, tokens_donated from public.charities order by tokens_donated desc, name;
$$;

-- ---------- Who may call what ----------
revoke execute on function public.resolve_deed(uuid) from public, anon, authenticated;
revoke execute on function public.adjust_trust(uuid, integer) from public, anon, authenticated;
revoke execute on function public.push_notification(uuid, text, text, public.notification_type) from public, anon, authenticated;
revoke execute on function public.token_balance(uuid) from public, anon, authenticated;
revoke execute on function public.vote_weight(uuid) from public, anon, authenticated;
revoke execute on function public.can_verify(uuid) from public, anon, authenticated;
revoke execute on function public.log_deed(text, public.deed_category, public.impact_level, text) from public, anon;
revoke execute on function public.get_verify_queue(integer) from public, anon;
revoke execute on function public.cast_vote(uuid, boolean) from public, anon;
revoke execute on function public.redeem_reward(uuid) from public, anon;
revoke execute on function public.donate(uuid, integer) from public, anon;
revoke execute on function public.get_my_stats() from public, anon;
revoke execute on function public.get_my_badges() from public, anon;
revoke execute on function public.get_leaderboard(text) from public, anon;
grant execute on function public.log_deed(text, public.deed_category, public.impact_level, text) to authenticated;
grant execute on function public.get_verify_queue(integer) to authenticated;
grant execute on function public.cast_vote(uuid, boolean) to authenticated;
grant execute on function public.redeem_reward(uuid) to authenticated;
grant execute on function public.donate(uuid, integer) to authenticated;
grant execute on function public.get_my_stats() to authenticated;
grant execute on function public.get_my_badges() to authenticated;
grant execute on function public.get_leaderboard(text) to authenticated;
grant execute on function public.get_charities() to anon, authenticated;
grant execute on function public.get_witness_deed(uuid) to anon, authenticated;
grant execute on function public.confirm_witness(uuid) to anon, authenticated;

-- ---------- Fix (found in testing): witness confirmation is a signal + bonus, never a vote ----------
-- Otherwise a verifier could also "confirm as witness" (double counting), or an author could
-- open their own link logged out to boost their deed.
create or replace function public.confirm_witness(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare d public.deeds;
begin
  select * into d from public.deeds where witness_token = p_token for update;
  if d.id is null then raise exception 'This link is not valid'; end if;
  if auth.uid() = d.user_id then raise exception 'You can''t confirm your own deed'; end if;
  if auth.uid() is not null and exists (select 1 from public.validations where deed_id = d.id and validator_id = auth.uid()) then
    raise exception 'You already verified this deed, so you can''t confirm it as well';
  end if;
  if d.witness_confirmed_at is null then
    update public.deeds set witness_confirmed_at = now() where id = d.id;
    perform public.push_notification(d.user_id, 'Someone confirmed your deed',
      'The person you helped confirmed "' || left(d.description, 40) || '". +5 bonus points when the community verifies it.', 'validation');
  end if;
  return public.get_witness_deed(p_token);
end;
$$;

-- Accuracy counts only votes on settled deeds
create or replace function public.get_my_stats()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p public.profiles;
  streak integer := 0;
  cur date := current_date;
  week_start date := date_trunc('week', current_date)::date;
  week json;
begin
  select * into p from public.profiles where id = uid;
  if p.id is null then return null; end if;

  if not exists (select 1 from public.deeds where user_id = uid and created_at::date = cur and validation_status <> 'Flagged') then
    cur := cur - 1;
  end if;
  while exists (select 1 from public.deeds where user_id = uid and created_at::date = cur and validation_status <> 'Flagged') loop
    streak := streak + 1;
    cur := cur - 1;
  end loop;

  select json_agg(exists (select 1 from public.deeds where user_id = uid and created_at::date = g::date
                          and validation_status <> 'Flagged') order by g)
    into week from generate_series(week_start, week_start + 6, interval '1 day') g;

  return json_build_object(
    'name', p.name, 'avatar', p.avatar, 'bio', p.bio,
    'is_public', p.is_public, 'notifications_enabled', p.notifications_enabled,
    'trust', p.trust_score,
    'points', public.token_balance(uid),
    'pending_points', (select coalesce(sum(tokens_earned), 0) from public.deeds where user_id = uid and validation_status = 'Pending'),
    'deeds_today', (select count(*) from public.deeds where user_id = uid and created_at >= date_trunc('day', now())),
    'deeds_this_week', (select count(*) from public.deeds where user_id = uid and created_at >= week_start and validation_status <> 'Flagged'),
    'total_deeds', (select count(*) from public.deeds where user_id = uid and validation_status = 'Verified'),
    'streak', streak,
    'week', week,
    'can_verify', public.can_verify(uid),
    'votes_cast', p.votes_cast,
    'votes_agreed', p.votes_agreed,
    'votes_settled', (select count(*) from public.validations v join public.deeds d on d.id = v.deed_id
                      where v.validator_id = uid and d.validation_status <> 'Pending'),
    'verify_queue_size', (select count(*) from public.get_verify_queue(20))
  );
end;
$$;
