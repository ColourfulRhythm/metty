-- Run this in Supabase SQL Editor after the original supabase-setup.sql
-- Adds: users table, user auth, storage tracking, 30MB limit support

-- 1. USERS TABLE (name + PIN auth)
create table if not exists users (
  id text primary key,
  name text not null unique,
  pin_salt text not null,
  pin_hash text not null,
  created_at timestamptz default now()
);

alter table users enable row level security;
create policy "Anyone can read users by name" on users for select using (true);
create policy "Anyone can insert users" on users for insert with check (true);

-- 2. SESSIONS: add user_id (optional for backward compatibility)
alter table sessions add column if not exists user_id text references users(id) on delete set null;

-- 3. SESSION_PHOTOS: add size_bytes for storage quota
alter table session_photos add column if not exists size_bytes bigint default 0;

-- 4. Function to compute user storage (bytes)
create or replace function user_storage_used(uid text)
returns bigint as $$
  select coalesce(sum(sp.size_bytes), 0)::bigint
  from session_photos sp
  join sessions s on s.id = sp.session_id
  where s.user_id = uid;
$$ language sql stable;
