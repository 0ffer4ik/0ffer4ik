create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    username text not null unique check (char_length(username) between 3 and 20),
    created_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx
    on public.profiles (lower(username));

create table if not exists public.sudoku_games (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
    puzzle integer[] not null,
    solution integer[] not null,
    created_at timestamptz not null default now(),
    completed_at timestamptz,
    check (array_length(puzzle, 1) = 81),
    check (array_length(solution, 1) = 81)
);

create table if not exists public.sudoku_scores (
    user_id uuid not null references public.profiles (id) on delete cascade,
    difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
    best_seconds integer not null check (best_seconds > 0),
    completed_games integer not null default 1 check (completed_games > 0),
    updated_at timestamptz not null default now(),
    primary key (user_id, difficulty)
);

create index if not exists sudoku_scores_leaderboard_idx
    on public.sudoku_scores (difficulty, best_seconds);
create index if not exists sudoku_games_owner_created_idx
    on public.sudoku_games (user_id, created_at);

alter table public.profiles enable row level security;
alter table public.sudoku_games enable row level security;
alter table public.sudoku_scores enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
    on public.profiles for select to anon, authenticated using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Scores are publicly readable" on public.sudoku_scores;
create policy "Scores are publicly readable"
    on public.sudoku_scores for select to anon, authenticated using (true);

revoke all on public.sudoku_games from anon, authenticated;
revoke all on public.profiles, public.sudoku_scores from anon, authenticated;
grant select on public.profiles, public.sudoku_scores to anon, authenticated;
grant all on public.sudoku_games, public.sudoku_scores to service_role;
grant select, insert on public.profiles to service_role;

create or replace function public.create_sudoku_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    requested_username text;
begin
    requested_username := new.raw_user_meta_data ->> 'username';
    if requested_username is null or char_length(requested_username) not between 3 and 20 then
        requested_username := 'player_' || substr(new.id::text, 1, 8);
    end if;

    insert into public.profiles (id, username)
    values (new.id, requested_username)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
    after insert on auth.users
    for each row execute procedure public.create_sudoku_profile();
revoke all on function public.create_sudoku_profile() from public, anon, authenticated;

create or replace function public.record_sudoku_score(
    p_game_id uuid,
    p_user_id uuid,
    p_board integer[]
)
returns table (elapsed_seconds integer, best_seconds integer, completed_games integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
    game_row public.sudoku_games%rowtype;
    elapsed integer;
begin
    select * into game_row
    from public.sudoku_games
    where id = p_game_id and user_id = p_user_id and completed_at is null
    for update;

    if not found then
        raise exception 'Game not found or already submitted';
    end if;
    if coalesce(array_length(p_board, 1), 0) <> 81 or p_board is distinct from game_row.solution then
        raise exception 'Board does not match the solution';
    end if;

    elapsed := greatest(1, floor(extract(epoch from (now() - game_row.created_at)))::integer);
    update public.sudoku_games set completed_at = now() where id = p_game_id;

    insert into public.sudoku_scores as existing (user_id, difficulty, best_seconds, completed_games, updated_at)
    values (p_user_id, game_row.difficulty, elapsed, 1, now())
    on conflict (user_id, difficulty) do update
    set best_seconds = least(existing.best_seconds, excluded.best_seconds),
        completed_games = existing.completed_games + 1,
        updated_at = now();

    return query
    select elapsed, score.best_seconds, score.completed_games
    from public.sudoku_scores as score
    where score.user_id = p_user_id and score.difficulty = game_row.difficulty;
end;
$$;

revoke all on function public.record_sudoku_score(uuid, uuid, integer[]) from public, anon, authenticated;
grant execute on function public.record_sudoku_score(uuid, uuid, integer[]) to service_role;
