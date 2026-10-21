-- Goodness app: full schema rebuilt from src/integrations/supabase/types.ts
-- and the queries in src/contexts/GoodnessContext.tsx (Oct 2026).

-- Enums
create type public.deed_category as enum ('Environmental','Social Good','Charitable','Educational','Personal Help');
create type public.impact_level as enum ('Low','Medium','High');
create type public.notification_type as enum ('badge','challenge','charity','streak','validation','token');
create type public.transaction_type as enum ('earned','spent','pending');
create type public.validation_status as enum ('Pending','Verified','Flagged');

-- Tables
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar text,
  bio text,
  is_public boolean not null default true,
  notifications_enabled boolean not null default true,
  trust_score integer not null default 70,
  created_at timestamptz not null default now()
);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  image text not null,
  required_deeds integer not null,
  created_at timestamptz not null default now()
);

create table public.charities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  image text not null,
  votes integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.deeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  description text not null,
  category public.deed_category not null,
  impact_level public.impact_level not null,
  date timestamptz not null default now(),
  image_url text,
  tokens_earned integer not null,
  tokens_released boolean not null default false,
  validation_status public.validation_status not null default 'Pending',
  validation_count integer not null default 0,
  trust_points_earned integer not null default 0,
  has_proof boolean not null default false,
  is_high_impact boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.validations (
  id uuid primary key default gen_random_uuid(),
  deed_id uuid not null references public.deeds(id) on delete cascade,
  validator_id uuid not null references public.profiles(id) on delete cascade,
  is_valid boolean not null,
  created_at timestamptz not null default now(),
  unique (deed_id, validator_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  type public.transaction_type not null,
  description text not null,
  date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type public.notification_type not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  progress numeric not null default 0,
  achieved boolean not null default false,
  achieved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

create table public.charity_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  charity_id uuid not null references public.charities(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, charity_id)
);

-- Create a profile automatically when someone signs up (name comes from sign-up form)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Called by the app when voting: supabase.rpc('increment_charity_votes', { charity_id })
create or replace function public.increment_charity_votes(charity_id uuid)
returns integer language sql security definer set search_path = public as $$
  update public.charities set votes = votes + 1 where id = charity_id returning votes;
$$;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.badges enable row level security;
alter table public.charities enable row level security;
alter table public.deeds enable row level security;
alter table public.validations enable row level security;
alter table public.transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.user_badges enable row level security;
alter table public.charity_votes enable row level security;

-- Reference data: readable by everyone signed in
create policy "badges readable" on public.badges for select to authenticated using (true);
create policy "charities readable" on public.charities for select to authenticated using (true);

-- Profiles: everyone can read (leaderboard), you edit your own.
-- NOTE: the app currently updates other users' trust_score from the browser when validating;
-- this permissive update policy keeps that working. Tighten later by moving that logic server-side.
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update" on public.profiles for update to authenticated using (true);

-- Deeds: readable by signed-in users (needed for validation), insert your own, updates allowed for validation flow
create policy "deeds readable" on public.deeds for select to authenticated using (true);
create policy "deeds insert own" on public.deeds for insert to authenticated with check (auth.uid() = user_id);
create policy "deeds update" on public.deeds for update to authenticated using (true);

create policy "validations readable" on public.validations for select to authenticated using (true);
create policy "validations insert own" on public.validations for insert to authenticated with check (auth.uid() = validator_id);

-- Transactions/notifications: you read your own; inserts allowed (validation credits other users)
create policy "transactions read own" on public.transactions for select to authenticated using (auth.uid() = user_id);
create policy "transactions insert" on public.transactions for insert to authenticated with check (true);
create policy "notifications read own" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "notifications insert" on public.notifications for insert to authenticated with check (true);
create policy "notifications update own" on public.notifications for update to authenticated using (auth.uid() = user_id);

create policy "user_badges read own" on public.user_badges for select to authenticated using (auth.uid() = user_id);
create policy "user_badges insert own" on public.user_badges for insert to authenticated with check (auth.uid() = user_id);
create policy "user_badges update own" on public.user_badges for update to authenticated using (auth.uid() = user_id);

create policy "charity_votes read own" on public.charity_votes for select to authenticated using (auth.uid() = user_id);
create policy "charity_votes insert own" on public.charity_votes for insert to authenticated with check (auth.uid() = user_id);

-- Starter data (same badges and charities the app shipped with)
insert into public.badges (name, description, image, required_deeds) values
  ('First Step', 'Log your first good deed', '✨', 1),
  ('Helping Hand', 'Complete 5 Personal Help deeds', '🤝', 5),
  ('Nature Guardian', 'Complete 10 Environmental deeds', '🌱', 10),
  ('Community Leader', 'Complete 15 Social Good deeds', '🏙️', 15),
  ('Knowledge Sharer', 'Complete 10 Educational deeds', '📚', 10),
  ('Generous Soul', 'Complete 20 Charitable deeds', '💖', 20);

insert into public.charities (name, description, image, votes) values
  ('Clean Water Initiative', 'Providing clean water to communities in need', '💧', 0),
  ('Education For All', 'Building schools and providing supplies to children', '🏫', 0),
  ('Reforestation Project', 'Planting trees and restoring forests worldwide', '🌳', 0);
