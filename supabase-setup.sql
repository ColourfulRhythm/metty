-- Run this in your Supabase SQL Editor (supabase.com → project → SQL Editor)

-- 1. TABLES

create table sessions (
  id text primary key,
  name text not null,
  creator_name text default '',
  creator_token text not null,
  created_at timestamptz default now()
);

create table session_photos (
  id serial primary key,
  session_id text references sessions(id) on delete cascade,
  photo_index int not null,
  storage_path text not null,
  url text not null
);

create table viewers (
  id text primary key,
  session_id text references sessions(id) on delete cascade,
  name text not null,
  joined_at timestamptz default now()
);

create table swipes (
  id serial primary key,
  viewer_id text references viewers(id) on delete cascade,
  session_id text references sessions(id) on delete cascade,
  photo_index int not null,
  liked boolean not null default false,
  created_at timestamptz default now()
);

create table chat_messages (
  id serial primary key,
  session_id text references sessions(id) on delete cascade,
  viewer_id text references viewers(id) on delete cascade,
  sender text not null check (sender in ('creator', 'viewer')),
  text text not null,
  created_at timestamptz default now()
);

-- 2. ROW LEVEL SECURITY (permissive for anon — no auth required)

alter table sessions enable row level security;
alter table session_photos enable row level security;
alter table viewers enable row level security;
alter table swipes enable row level security;
alter table chat_messages enable row level security;

create policy "Anyone can read sessions" on sessions for select using (true);
create policy "Anyone can create sessions" on sessions for insert with check (true);

create policy "Anyone can read photos" on session_photos for select using (true);
create policy "Anyone can insert photos" on session_photos for insert with check (true);

create policy "Anyone can read viewers" on viewers for select using (true);
create policy "Anyone can insert viewers" on viewers for insert with check (true);

create policy "Anyone can read swipes" on swipes for select using (true);
create policy "Anyone can insert swipes" on swipes for insert with check (true);

create policy "Anyone can read chat" on chat_messages for select using (true);
create policy "Anyone can insert chat" on chat_messages for insert with check (true);

-- 3. ENABLE REALTIME on tables that need live updates

alter publication supabase_realtime add table swipes;
alter publication supabase_realtime add table viewers;
alter publication supabase_realtime add table chat_messages;

-- 4. STORAGE: Create a public bucket called "photos"
-- Do this in the Supabase Dashboard → Storage → New Bucket
-- Name: photos
-- Public: YES
