-- Second Brain Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Folders table (for organizing items)
create table public.folders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  parent_id uuid references public.folders(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Items table (links and notes)
create table public.items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text check (type in ('link', 'note', 'pdf')) not null default 'link',
  url text,
  title text not null,
  description text,
  thumbnail text,
  content text,
  folder_id uuid references public.folders(id) on delete set null,
  status text check (status in ('unread', 'read', 'archived')) not null default 'unread',
  content_type text check (content_type in ('video', 'article', 'tweet', 'link', 'note', 'pdf', 'spotify', 'substack')) not null default 'link',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tags table
create table public.tags (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text not null default '#3b82f6',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, name)
);

-- Item-Tags junction table (many-to-many)
create table public.item_tags (
  item_id uuid references public.items(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key (item_id, tag_id)
);

-- Highlights table (text highlights from web pages)
create table public.highlights (
  id uuid default uuid_generate_v4() primary key,
  item_id uuid references public.items(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  color text check (color in ('yellow', 'green', 'blue', 'pink', 'orange')) not null default 'yellow',
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for better performance
create index folders_user_id_idx on public.folders(user_id);
create index folders_parent_id_idx on public.folders(parent_id);
create index items_user_id_idx on public.items(user_id);
create index items_folder_id_idx on public.items(folder_id);
create index items_status_idx on public.items(status);
create index items_created_at_idx on public.items(created_at desc);
create index tags_user_id_idx on public.tags(user_id);
create index highlights_item_id_idx on public.highlights(item_id);
create index highlights_user_id_idx on public.highlights(user_id);

-- Full-text search index on items
create index items_search_idx on public.items
  using gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(content, '')));

-- Enable Row Level Security (RLS)
alter table public.folders enable row level security;
alter table public.items enable row level security;
alter table public.tags enable row level security;
alter table public.item_tags enable row level security;
alter table public.highlights enable row level security;

-- RLS Policies: Users can only access their own data

-- Folders policies
create policy "Users can view own folders" on public.folders
  for select using (auth.uid() = user_id);
create policy "Users can create own folders" on public.folders
  for insert with check (auth.uid() = user_id);
create policy "Users can update own folders" on public.folders
  for update using (auth.uid() = user_id);
create policy "Users can delete own folders" on public.folders
  for delete using (auth.uid() = user_id);

-- Items policies
create policy "Users can view own items" on public.items
  for select using (auth.uid() = user_id);
create policy "Users can create own items" on public.items
  for insert with check (auth.uid() = user_id);
create policy "Users can update own items" on public.items
  for update using (auth.uid() = user_id);
create policy "Users can delete own items" on public.items
  for delete using (auth.uid() = user_id);

-- Tags policies
create policy "Users can view own tags" on public.tags
  for select using (auth.uid() = user_id);
create policy "Users can create own tags" on public.tags
  for insert with check (auth.uid() = user_id);
create policy "Users can update own tags" on public.tags
  for update using (auth.uid() = user_id);
create policy "Users can delete own tags" on public.tags
  for delete using (auth.uid() = user_id);

-- Item_tags policies (check ownership via item)
create policy "Users can view own item_tags" on public.item_tags
  for select using (
    exists (select 1 from public.items where items.id = item_tags.item_id and items.user_id = auth.uid())
  );
create policy "Users can create own item_tags" on public.item_tags
  for insert with check (
    exists (select 1 from public.items where items.id = item_tags.item_id and items.user_id = auth.uid())
  );
create policy "Users can delete own item_tags" on public.item_tags
  for delete using (
    exists (select 1 from public.items where items.id = item_tags.item_id and items.user_id = auth.uid())
  );

-- Highlights policies
create policy "Users can view own highlights" on public.highlights
  for select using (auth.uid() = user_id);
create policy "Users can create own highlights" on public.highlights
  for insert with check (auth.uid() = user_id);
create policy "Users can update own highlights" on public.highlights
  for update using (auth.uid() = user_id);
create policy "Users can delete own highlights" on public.highlights
  for delete using (auth.uid() = user_id);

-- Function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger handle_folders_updated_at
  before update on public.folders
  for each row execute function public.handle_updated_at();

create trigger handle_items_updated_at
  before update on public.items
  for each row execute function public.handle_updated_at();

create trigger handle_highlights_updated_at
  before update on public.highlights
  for each row execute function public.handle_updated_at();
