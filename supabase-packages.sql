-- =====================================================================
-- MUSE update: Packages + delivery reminders
-- Run once in the Supabase SQL Editor (after supabase-setup.sql).
-- Safe to re-run. If asked about RLS, choose "Run and enable RLS".
-- =====================================================================

-- Packages you're waiting on
create table if not exists public.packages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,  -- the wishlist item it's for, if any
  name            text not null check (char_length(name) between 1 and 200),
  store           text not null default '',
  carrier         text not null default '',
  tracking_number text not null default '',
  expected_date   date not null,
  remind          text not null default 'before' check (remind in ('before','dayof','both','off')),
  message         text not null default '' check (char_length(message) <= 180),
  timezone        text not null default 'America/Los_Angeles',          -- whose "tomorrow" the reminder follows
  delivered       boolean not null default false,
  delivered_at    timestamptz,
  notes           text not null default '',
  reminded_before_at timestamptz,   -- set when the day-before reminder went out
  reminded_dayof_at  timestamptz,   -- set when the morning-of reminder went out
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists packages_user_idx on public.packages (user_id, expected_date);
create index if not exists packages_due_idx  on public.packages (expected_date) where delivered = false and remind <> 'off';

-- Devices that agreed to get MUSE notifications
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  device      text not null default '',
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- updated_at
drop trigger if exists touch_packages on public.packages;
create trigger touch_packages before update on public.packages for each row execute function public.touch_updated_at();

-- Changing the date or the reminder choice means the reminder should go out again
create or replace function public.package_reset_reminders()
returns trigger language plpgsql as $$
begin
  if new.expected_date is distinct from old.expected_date or new.remind is distinct from old.remind then
    new.reminded_before_at := null;
    new.reminded_dayof_at := null;
  end if;
  return new;
end $$;
drop trigger if exists reset_package_reminders on public.packages;
create trigger reset_package_reminders before update on public.packages
  for each row execute function public.package_reset_reminders();

-- Privacy: each account only reads and changes its own rows
alter table public.packages enable row level security;
alter table public.push_subscriptions enable row level security;
drop policy if exists "own rows" on public.packages;
create policy "own rows" on public.packages for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own rows" on public.push_subscriptions;
create policy "own rows" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- A package can only point at a wishlist item from the same account
create or replace function public.package_owner_check()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is not null and not exists (select 1 from products where id = new.product_id and user_id = new.user_id) then
    raise exception 'MUSE: linked record does not belong to this account';
  end if;
  return new;
end $$;
drop trigger if exists same_owner_packages on public.packages;
create trigger same_owner_packages before insert or update on public.packages
  for each row execute function public.package_owner_check();

-- Done. You should see: "Success. No rows returned"
