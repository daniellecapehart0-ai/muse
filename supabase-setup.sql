-- =====================================================================
-- MUSE — Supabase setup (run once in a NEW, empty Supabase project)
-- Creates every table, the privacy rules (each person only ever sees
-- their own data), photo storage, and a "delete my account" function.
-- Safe to re-run: it skips anything that already exists.
-- =====================================================================

create extension if not exists pgcrypto;

-- Keeps updated_at current on every edit
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Profiles: one row per account (created automatically at sign-up)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default '' check (char_length(display_name) <= 40),
  theme         text not null default 'peach',
  appearance    text not null default 'system' check (appearance in ('system','light','dark')),
  welcomed      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Custom collections (Fragrance, Home, Books…)
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  icon        text not null default '',
  accent      text not null default '#E07070',
  item_label  text not null default 'item',
  cover_path  text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Gift profiles (people you shop for)
-- ---------------------------------------------------------------------
create table if not exists public.people (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 80),
  relationship    text not null default '',
  birthday        date,
  budget          numeric(10,2) check (budget is null or budget >= 0),
  clothing_size   text not null default '',
  shoe_size       text not null default '',
  ring_size       text not null default '',
  favorite_colors text not null default '',
  likes           text not null default '',
  dislikes        text not null default '',
  notes           text not null default '',
  accent          text not null default '#E07070',
  photo_path      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Holiday lists (archived automatically once their date has passed)
-- ---------------------------------------------------------------------
create table if not exists public.occasions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  date        date,
  icon        text not null default '',
  accent      text not null default '#C9504F',
  description text not null default '',
  cover_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Products: every wishlist item and gift idea
--   kind = clothing | makeup | custom (belongs to a collection) | gift (belongs to a person)
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind             text not null check (kind in ('clothing','makeup','custom','gift')),
  category_id      uuid references public.categories(id) on delete cascade,
  person_id        uuid references public.people(id) on delete cascade,
  occasion_id      uuid references public.occasions(id) on delete set null,  -- gifts tagged to a holiday list
  for_birthday     boolean not null default false,                           -- gifts tagged to the person's birthday
  name             text not null check (char_length(name) between 1 and 200),
  brand            text not null default '',
  store            text not null default '',
  url              text not null default '',
  price            numeric(10,2) check (price is null or price >= 0),
  size             text not null default '',
  color            text not null default '',
  product_type     text not null default '',
  shade_name       text not null default '',
  shade_number     text not null default '',
  notes            text not null default '',
  priority         text not null default 'medium' check (priority in ('high','medium','low')),
  status           text not null default 'want' check (status in ('want','ordered','purchased','given')),
  favorite         boolean not null default false,
  image_path       text,          -- uploaded photo in storage
  image_url        text not null default '',   -- or a pasted image link
  purchased_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint products_custom_needs_category check (kind <> 'custom' or category_id is not null),
  constraint products_gift_needs_person    check (kind <> 'gift' or person_id is not null),
  constraint products_given_only_for_gifts check (status <> 'given' or kind = 'gift')
);

-- Earlier prices, for "↓ $20 since you saved it"
create table if not exists public.price_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  price        numeric(10,2) not null check (price >= 0),
  recorded_at  timestamptz not null default now()
);

-- Your own items placed on a holiday list (by reference, never copied)
create table if not exists public.occasion_items (
  occasion_id  uuid not null references public.occasions(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  position     integer not null default 0,
  added_at     timestamptz not null default now(),
  primary key (occasion_id, product_id)
);

-- Which lists show as tabs on a gift profile ("This list is for")
create table if not exists public.person_lists (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id    uuid not null references public.people(id) on delete cascade,
  occasion_id  uuid references public.occasions(id) on delete cascade,  -- null = their birthday
  created_at   timestamptz not null default now()
);
create unique index if not exists person_lists_unique
  on public.person_lists (person_id, coalesce(occasion_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ---------------------------------------------------------------------
-- Future Closet
-- ---------------------------------------------------------------------
create table if not exists public.outfits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  tags        text[] not null default '{}',
  season      text not null default '',
  occasion    text not null default '',
  notes       text not null default '',
  favorite    boolean not null default false,
  cover_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.outfit_pieces (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  outfit_id   uuid not null references public.outfits(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  position    integer not null default 0,
  unique (outfit_id, product_id)
);

-- ---------------------------------------------------------------------
-- Future Makeup Routine
-- ---------------------------------------------------------------------
create table if not exists public.routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  occasion    text not null default '',
  duration    text not null default '',
  notes       text not null default '',
  favorite    boolean not null default false,
  cover_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.routine_steps (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_id        uuid not null references public.routines(id) on delete cascade,
  product_id        uuid references public.products(id) on delete set null,  -- linked wishlist product, if any
  position          integer not null default 0,
  standalone_name   text not null default '',
  standalone_brand  text not null default '',
  standalone_shade  text not null default '',
  instructions      text not null default '',
  notes             text not null default '',
  owned             boolean not null default false
);

-- ---------------------------------------------------------------------
-- Speed: indexes for the lookups the app makes
-- ---------------------------------------------------------------------
create index if not exists products_user_idx       on public.products (user_id, kind);
create index if not exists products_category_idx   on public.products (category_id);
create index if not exists products_person_idx     on public.products (person_id);
create index if not exists products_occasion_idx   on public.products (occasion_id);
create index if not exists price_history_prod_idx  on public.price_history (product_id, recorded_at);
create index if not exists occasion_items_prod_idx on public.occasion_items (product_id);
create index if not exists person_lists_person_idx on public.person_lists (person_id);
create index if not exists outfit_pieces_out_idx   on public.outfit_pieces (outfit_id, position);
create index if not exists outfit_pieces_prod_idx  on public.outfit_pieces (product_id);
create index if not exists routine_steps_rt_idx    on public.routine_steps (routine_id, position);
create index if not exists routine_steps_prod_idx  on public.routine_steps (product_id);
create index if not exists categories_user_idx     on public.categories (user_id, sort_order);
create index if not exists people_user_idx         on public.people (user_id);
create index if not exists occasions_user_idx      on public.occasions (user_id, date);
create index if not exists outfits_user_idx        on public.outfits (user_id);
create index if not exists routines_user_idx       on public.routines (user_id);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['profiles','categories','people','occasions','products','outfits','routines'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$I', t);
    execute format('create trigger touch_%1$s before update on public.%1$I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Privacy: Row Level Security — every person can only read and change
-- their own rows. Nobody, signed in or not, can see anyone else's data.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['categories','people','occasions','products','price_history','occasion_items','person_lists','outfits','outfit_pieces','routines','routine_steps'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Links between rows must point at the same person's data
-- (stops anyone attaching their rows to someone else's ids)
create or replace function public.same_owner_check()
returns trigger language plpgsql security definer set search_path = public as $$
declare bad boolean := false;
begin
  if tg_table_name = 'products' then
    bad := (new.category_id is not null and not exists (select 1 from categories where id = new.category_id and user_id = new.user_id))
        or (new.person_id   is not null and not exists (select 1 from people     where id = new.person_id   and user_id = new.user_id))
        or (new.occasion_id is not null and not exists (select 1 from occasions  where id = new.occasion_id and user_id = new.user_id));
  elsif tg_table_name = 'price_history' then
    bad := not exists (select 1 from products where id = new.product_id and user_id = new.user_id);
  elsif tg_table_name = 'occasion_items' then
    bad := not exists (select 1 from occasions where id = new.occasion_id and user_id = new.user_id)
        or not exists (select 1 from products  where id = new.product_id  and user_id = new.user_id);
  elsif tg_table_name = 'person_lists' then
    bad := not exists (select 1 from people where id = new.person_id and user_id = new.user_id)
        or (new.occasion_id is not null and not exists (select 1 from occasions where id = new.occasion_id and user_id = new.user_id));
  elsif tg_table_name = 'outfit_pieces' then
    bad := not exists (select 1 from outfits  where id = new.outfit_id  and user_id = new.user_id)
        or not exists (select 1 from products where id = new.product_id and user_id = new.user_id);
  elsif tg_table_name = 'routine_steps' then
    bad := not exists (select 1 from routines where id = new.routine_id and user_id = new.user_id)
        or (new.product_id is not null and not exists (select 1 from products where id = new.product_id and user_id = new.user_id));
  end if;
  if bad then raise exception 'MUSE: linked record does not belong to this account'; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['products','price_history','occasion_items','person_lists','outfit_pieces','routine_steps'] loop
    execute format('drop trigger if exists same_owner_%1$s on public.%1$I', t);
    execute format('create trigger same_owner_%1$s before insert or update on public.%1$I for each row execute function public.same_owner_check()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Photo storage: a private bucket. Each account gets its own folder
-- named after its user id, and can only touch files in that folder.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('muse-photos', 'muse-photos', false, 15728640,
        array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
on conflict (id) do nothing;

drop policy if exists "muse photos: read own"   on storage.objects;
drop policy if exists "muse photos: add own"    on storage.objects;
drop policy if exists "muse photos: change own" on storage.objects;
drop policy if exists "muse photos: delete own" on storage.objects;

create policy "muse photos: read own" on storage.objects for select to authenticated
  using (bucket_id = 'muse-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "muse photos: add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'muse-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "muse photos: change own" on storage.objects for update to authenticated
  using (bucket_id = 'muse-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "muse photos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'muse-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- "Delete my account": removes the login and, through the cascades
-- above, every row that belongs to it. (The app deletes the person's
-- photo folder first, then calls this.)
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Done. You should see: "Success. No rows returned"
