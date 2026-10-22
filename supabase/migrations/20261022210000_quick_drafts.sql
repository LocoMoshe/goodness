-- Quick drafts: log a deed from outside the app (iPhone Shortcut / Back Tap)
-- with a personal key, then finish it inside the app later.

create table if not exists public.deed_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null check (char_length(description) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists deed_drafts_user_idx on public.deed_drafts (user_id, created_at desc);

alter table public.deed_drafts enable row level security;
drop policy if exists "own drafts read" on public.deed_drafts;
create policy "own drafts read" on public.deed_drafts for select using (auth.uid() = user_id);
drop policy if exists "own drafts delete" on public.deed_drafts;
create policy "own drafts delete" on public.deed_drafts for delete using (auth.uid() = user_id);
revoke insert, update on public.deed_drafts from anon, authenticated;

-- One key per person; only the hash is stored. Nobody can read this table directly.
create table if not exists public.quick_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  key_hash text not null unique,
  created_at timestamptz not null default now()
);
alter table public.quick_keys enable row level security;
revoke all on public.quick_keys from anon, authenticated;

-- Make (or replace) my key. The plain key is returned once and never stored.
create or replace function public.create_quick_key()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.';
  end if;
  v_key := 'gt_' || encode(gen_random_bytes(18), 'hex');
  insert into quick_keys (user_id, key_hash)
  values (auth.uid(), encode(digest(v_key, 'sha256'), 'hex'))
  on conflict (user_id) do update set key_hash = excluded.key_hash, created_at = now();
  return v_key;
end;
$$;

create or replace function public.has_quick_key()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from quick_keys where user_id = auth.uid());
$$;

create or replace function public.remove_quick_key()
returns void
language sql
security definer
set search_path = public
as $$
  delete from quick_keys where user_id = auth.uid();
$$;

-- Called by the Shortcut (no sign-in, key only). Saves a draft, nothing else.
create or replace function public.quick_log(p_key text, p_text text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid;
  v_text text := btrim(coalesce(p_text, ''));
  v_count int;
begin
  if p_key is null or char_length(p_key) < 10 then
    raise exception 'Missing key.';
  end if;
  select user_id into v_user from quick_keys
  where key_hash = encode(digest(p_key, 'sha256'), 'hex');
  if v_user is null then
    raise exception 'That key is not valid. Make a new one in the app (Profile).';
  end if;
  if char_length(v_text) < 3 then
    raise exception 'Write a few words about what you did.';
  end if;
  v_text := left(v_text, 500);

  select count(*) into v_count from deed_drafts
  where user_id = v_user and created_at > now() - interval '24 hours';
  if v_count >= 20 then
    raise exception 'That is 20 quick notes today. Open the app to finish them first.';
  end if;

  insert into deed_drafts (user_id, description) values (v_user, v_text);
  return json_build_object('ok', true, 'waiting', (select count(*) from deed_drafts where user_id = v_user));
end;
$$;

revoke all on function public.create_quick_key() from public, anon;
revoke all on function public.has_quick_key() from public, anon;
revoke all on function public.remove_quick_key() from public, anon;
grant execute on function public.create_quick_key() to authenticated;
grant execute on function public.has_quick_key() to authenticated;
grant execute on function public.remove_quick_key() to authenticated;
grant execute on function public.quick_log(text, text) to anon, authenticated;
