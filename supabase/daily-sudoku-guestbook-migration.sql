alter table public.sudoku_games
    add column if not exists mode text not null default 'ranked',
    add column if not exists challenge_date date;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.sudoku_games'::regclass
            and conname = 'sudoku_games_mode_check'
    ) then
        alter table public.sudoku_games
            add constraint sudoku_games_mode_check
            check (
                (mode = 'ranked' and challenge_date is null)
                or (mode = 'daily' and challenge_date is not null)
            );
    end if;
end;
$$;

create unique index if not exists sudoku_games_daily_user_idx
    on public.sudoku_games (user_id, challenge_date)
    where mode = 'daily';

create table if not exists public.sudoku_daily_results (
    user_id uuid not null references public.profiles (id) on delete cascade,
    challenge_date date not null,
    game_id uuid not null unique references public.sudoku_games (id) on delete cascade,
    elapsed_seconds integer not null check (elapsed_seconds > 0),
    created_at timestamptz not null default now(),
    primary key (user_id, challenge_date)
);

create table if not exists public.sudoku_daily_stats (
    user_id uuid primary key references public.profiles (id) on delete cascade,
    completed_days integer not null default 0 check (completed_days >= 0),
    current_streak integer not null default 0 check (current_streak >= 0),
    best_streak integer not null default 0 check (best_streak >= current_streak),
    last_challenge_date date,
    updated_at timestamptz not null default now()
);

create table if not exists public.sudoku_achievements (
    user_id uuid not null references public.profiles (id) on delete cascade,
    code text not null check (code in (
        'first_daily',
        'streak_3',
        'streak_7',
        'streak_30',
        'daily_10',
        'daily_50',
        'daily_100'
    )),
    unlocked_at timestamptz not null default now(),
    primary key (user_id, code)
);

create table if not exists public.sudoku_daily_progress (
    user_id uuid primary key references public.profiles (id) on delete cascade,
    state jsonb not null,
    updated_at timestamptz not null default now()
);

create table if not exists public.guestbook_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles (id) on delete cascade,
    parent_entry_id uuid references public.guestbook_entries (id) on delete set null,
    message text not null check (
        message = btrim(message)
        and char_length(message) between 1 and 500
    ),
    created_at timestamptz not null default now()
);

alter table public.guestbook_entries
    add column if not exists parent_entry_id uuid
    references public.guestbook_entries (id) on delete set null;

create index if not exists guestbook_entries_created_idx
    on public.guestbook_entries (created_at desc);
create index if not exists guestbook_entries_user_created_idx
    on public.guestbook_entries (user_id, created_at desc);
create index if not exists guestbook_entries_parent_created_idx
    on public.guestbook_entries (parent_entry_id, created_at);

alter table public.sudoku_daily_results enable row level security;
alter table public.sudoku_daily_stats enable row level security;
alter table public.sudoku_achievements enable row level security;
alter table public.sudoku_daily_progress enable row level security;
alter table public.guestbook_entries enable row level security;

drop policy if exists "Users can read own daily Sudoku results" on public.sudoku_daily_results;
create policy "Users can read own daily Sudoku results"
    on public.sudoku_daily_results for select to authenticated
    using (user_id = (select auth.uid()));

drop policy if exists "Users can read own daily Sudoku stats" on public.sudoku_daily_stats;
create policy "Users can read own daily Sudoku stats"
    on public.sudoku_daily_stats for select to authenticated
    using (user_id = (select auth.uid()));

drop policy if exists "Users can read own Sudoku achievements" on public.sudoku_achievements;
create policy "Users can read own Sudoku achievements"
    on public.sudoku_achievements for select to authenticated
    using (user_id = (select auth.uid()));

drop policy if exists "Users can read own daily Sudoku progress" on public.sudoku_daily_progress;
create policy "Users can read own daily Sudoku progress"
    on public.sudoku_daily_progress for select to authenticated
    using (user_id = (select auth.uid()));

drop policy if exists "Users can insert own daily Sudoku progress" on public.sudoku_daily_progress;
create policy "Users can insert own daily Sudoku progress"
    on public.sudoku_daily_progress for insert to authenticated
    with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own daily Sudoku progress" on public.sudoku_daily_progress;
create policy "Users can update own daily Sudoku progress"
    on public.sudoku_daily_progress for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete own daily Sudoku progress" on public.sudoku_daily_progress;
create policy "Users can delete own daily Sudoku progress"
    on public.sudoku_daily_progress for delete to authenticated
    using (user_id = (select auth.uid()));

drop policy if exists "Guestbook entries are publicly readable" on public.guestbook_entries;
create policy "Guestbook entries are publicly readable"
    on public.guestbook_entries for select to anon, authenticated using (true);

drop policy if exists "Signed-in users can add guestbook entries" on public.guestbook_entries;
create policy "Signed-in users can add guestbook entries"
    on public.guestbook_entries for insert to authenticated
    with check (
        user_id = (select auth.uid())
        and (
            parent_entry_id is null
            or exists (
                select 1
                from public.guestbook_entries parent
                where parent.id = guestbook_entries.parent_entry_id
                    and parent.parent_entry_id is null
            )
        )
    );

drop policy if exists "Users can delete own guestbook entries" on public.guestbook_entries;
create policy "Users can delete own guestbook entries"
    on public.guestbook_entries for delete to authenticated
    using (user_id = (select auth.uid()));

revoke all on public.sudoku_daily_results, public.sudoku_daily_stats,
    public.sudoku_achievements, public.sudoku_daily_progress,
    public.guestbook_entries from anon, authenticated;
grant select on public.sudoku_daily_results, public.sudoku_daily_stats,
    public.sudoku_achievements to authenticated;
grant select on public.guestbook_entries to anon, authenticated;
grant select, insert, update, delete on public.sudoku_daily_progress to authenticated;
grant insert, delete on public.guestbook_entries to authenticated;
grant all on public.sudoku_daily_results, public.sudoku_daily_stats,
    public.sudoku_achievements, public.sudoku_daily_progress,
    public.guestbook_entries to service_role;

create or replace function public.touch_sudoku_daily_progress_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists touch_sudoku_daily_progress_updated_at on public.sudoku_daily_progress;
create trigger touch_sudoku_daily_progress_updated_at
    before update on public.sudoku_daily_progress
    for each row execute procedure public.touch_sudoku_daily_progress_updated_at();
revoke all on function public.touch_sudoku_daily_progress_updated_at() from public, anon, authenticated;

create or replace function public.record_sudoku_daily_result(
    p_game_id uuid,
    p_user_id uuid,
    p_board integer[]
)
returns table (
    challenge_date date,
    elapsed_seconds integer,
    current_streak integer,
    best_streak integer,
    completed_days integer,
    achievement_codes text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_game public.sudoku_games%rowtype;
    v_stats public.sudoku_daily_stats%rowtype;
    v_result public.sudoku_daily_results%rowtype;
    v_today date := (now() at time zone 'utc')::date;
    v_now timestamptz := now();
    v_elapsed integer;
    v_streak integer;
    v_days integer;
    v_best integer;
    v_codes text[];
begin
    if p_board is null or array_length(p_board, 1) <> 81
        or exists (
            select 1
            from unnest(p_board) as valueset(digit)
            where valueset.digit is null or valueset.digit < 1 or valueset.digit > 9
        ) then
        raise exception 'Invalid completed Sudoku board';
    end if;

    select * into v_game
    from public.sudoku_games
    where id = p_game_id and user_id = p_user_id
    for update;

    if not found or v_game.mode <> 'daily' then
        raise exception 'Daily Sudoku game not found';
    end if;

    if v_game.challenge_date <> v_today then
        raise exception 'Daily Sudoku challenge has expired';
    end if;

    if v_game.completed_at is not null then
        select * into v_result
        from public.sudoku_daily_results
        where game_id = p_game_id and user_id = p_user_id;

        if not found then
            raise exception 'Daily Sudoku game is already completed';
        end if;

        select * into v_stats
        from public.sudoku_daily_stats
        where user_id = p_user_id;
        select coalesce(array_agg(code order by code), array[]::text[]) into v_codes
        from public.sudoku_achievements
        where user_id = p_user_id;

        return query select v_result.challenge_date, v_result.elapsed_seconds,
            v_stats.current_streak, v_stats.best_streak, v_stats.completed_days, v_codes;
        return;
    end if;

    if p_board <> v_game.solution then
        raise exception 'Sudoku solution does not match';
    end if;

    insert into public.sudoku_daily_stats (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select * into v_stats
    from public.sudoku_daily_stats
    where user_id = p_user_id
    for update;

    if v_stats.last_challenge_date = v_game.challenge_date then
        select * into v_result
        from public.sudoku_daily_results
        where user_id = p_user_id and sudoku_daily_results.challenge_date = v_game.challenge_date;

        if found then
            select coalesce(array_agg(code order by code), array[]::text[]) into v_codes
            from public.sudoku_achievements
            where user_id = p_user_id;
            return query select v_result.challenge_date, v_result.elapsed_seconds,
                v_stats.current_streak, v_stats.best_streak, v_stats.completed_days, v_codes;
            return;
        end if;
        raise exception 'Daily Sudoku result already exists';
    end if;

    v_streak := case
        when v_stats.last_challenge_date = v_game.challenge_date - 1
            then v_stats.current_streak + 1
        else 1
    end;
    v_days := v_stats.completed_days + 1;
    v_best := greatest(v_stats.best_streak, v_streak);
    v_elapsed := greatest(1, floor(extract(epoch from (v_now - v_game.created_at)))::integer);

    update public.sudoku_daily_stats
    set completed_days = v_days,
        current_streak = v_streak,
        best_streak = v_best,
        last_challenge_date = v_game.challenge_date,
        updated_at = v_now
    where user_id = p_user_id;

    insert into public.sudoku_daily_results (user_id, challenge_date, game_id, elapsed_seconds, created_at)
    values (p_user_id, v_game.challenge_date, p_game_id, v_elapsed, v_now);

    update public.sudoku_games
    set completed_at = v_now
    where id = p_game_id;

    insert into public.sudoku_achievements (user_id, code)
    select p_user_id, achievement.code
    from (values
        ('first_daily', v_days >= 1),
        ('streak_3', v_streak >= 3),
        ('streak_7', v_streak >= 7),
        ('streak_30', v_streak >= 30),
        ('daily_10', v_days >= 10),
        ('daily_50', v_days >= 50),
        ('daily_100', v_days >= 100)
    ) as achievement(code, achieved)
    where achievement.achieved
    on conflict (user_id, code) do nothing;

    select coalesce(array_agg(code order by code), array[]::text[]) into v_codes
    from public.sudoku_achievements
    where user_id = p_user_id;

    return query select v_game.challenge_date, v_elapsed, v_streak, v_best, v_days, v_codes;
end;
$$;

revoke all on function public.record_sudoku_daily_result(uuid, uuid, integer[]) from public, anon, authenticated;
grant execute on function public.record_sudoku_daily_result(uuid, uuid, integer[]) to service_role;

notify pgrst, 'reload schema';
