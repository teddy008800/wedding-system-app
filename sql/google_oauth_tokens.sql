create table if not exists public.google_oauth_tokens (
  id text primary key,
  provider text not null,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.google_oauth_tokens enable row level security;

drop policy if exists "google_oauth_tokens no anon read" on public.google_oauth_tokens;
create policy "google_oauth_tokens no anon read"
on public.google_oauth_tokens
for select
to anon
using (false);
