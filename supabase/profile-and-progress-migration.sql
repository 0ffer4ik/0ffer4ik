alter table public.profiles
    add column if not exists avatar_url text;

drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can update their own avatar" on public.profiles;
create policy "Users can update their own avatar"
    on public.profiles for update to authenticated
    using (id = (select auth.uid()))
    with check (id = (select auth.uid()));

grant select on public.profiles to anon, authenticated;
grant update (avatar_url) on public.profiles to authenticated;

create table if not exists public.sudoku_progress (
    user_id uuid primary key references auth.users (id) on delete cascade,
    state jsonb not null,
    updated_at timestamptz not null default now()
);

alter table public.sudoku_progress enable row level security;

drop policy if exists "Users can manage their own Sudoku progress" on public.sudoku_progress;
drop policy if exists "Users can read own Sudoku progress" on public.sudoku_progress;
drop policy if exists "Users can insert own Sudoku progress" on public.sudoku_progress;
drop policy if exists "Users can update own Sudoku progress" on public.sudoku_progress;
drop policy if exists "Users can delete own Sudoku progress" on public.sudoku_progress;
create policy "Users can read own Sudoku progress"
    on public.sudoku_progress for select to authenticated
    using (user_id = (select auth.uid()));
create policy "Users can insert own Sudoku progress"
    on public.sudoku_progress for insert to authenticated
    with check (user_id = (select auth.uid()));
create policy "Users can update own Sudoku progress"
    on public.sudoku_progress for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
create policy "Users can delete own Sudoku progress"
    on public.sudoku_progress for delete to authenticated
    using (user_id = (select auth.uid()));

revoke all on public.sudoku_progress from anon, authenticated;
grant select, insert, update, delete on public.sudoku_progress to authenticated;

create or replace function public.touch_sudoku_progress_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists touch_sudoku_progress_updated_at on public.sudoku_progress;
create trigger touch_sudoku_progress_updated_at
    before update on public.sudoku_progress
    for each row execute procedure public.touch_sudoku_progress_updated_at();
revoke all on function public.touch_sudoku_progress_updated_at() from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', true, 307200, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload own profile avatar" on storage.objects;
create policy "Users can upload own profile avatar"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

drop policy if exists "Users can read own profile avatar" on storage.objects;
create policy "Users can read own profile avatar"
    on storage.objects for select to authenticated
    using (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

drop policy if exists "Users can update own profile avatar" on storage.objects;
create policy "Users can update own profile avatar"
    on storage.objects for update to authenticated
    using (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    with check (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

drop policy if exists "Users can delete own profile avatar" on storage.objects;
create policy "Users can delete own profile avatar"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );
