-- Guest media metadata table (files are stored in Google Drive, links saved here)
create table if not exists public.guest_memories (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  guest_name text not null default 'Guest',
  caption text null,
  media_type text not null check (media_type in ('image', 'video')),
  drive_file_id text not null,
  drive_view_url text not null,
  drive_direct_url text not null,
  mime_type text null,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.guest_memories
  alter column guest_name set default 'Guest';

create index if not exists idx_guest_memories_wedding_created
  on public.guest_memories (wedding_id, created_at desc);

alter table public.guest_memories enable row level security;

drop policy if exists "guest_memories read approved" on public.guest_memories;
create policy "guest_memories read approved"
on public.guest_memories
for select
to anon
using (status = 'approved');

drop policy if exists "guest_memories insert anon" on public.guest_memories;
create policy "guest_memories insert anon"
on public.guest_memories
for insert
to anon
with check (true);
