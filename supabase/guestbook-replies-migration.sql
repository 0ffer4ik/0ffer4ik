-- Apply to an existing project to enable one-level replies in the guestbook.
begin;

alter table public.guestbook_entries
    add column if not exists parent_entry_id uuid;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.guestbook_entries'::regclass
            and conname = 'guestbook_entries_parent_entry_id_fkey'
    ) then
        alter table public.guestbook_entries
            add constraint guestbook_entries_parent_entry_id_fkey
            foreign key (parent_entry_id)
            references public.guestbook_entries (id)
            on delete set null;
    end if;
end;
$$;

create index if not exists guestbook_entries_parent_created_idx
    on public.guestbook_entries (parent_entry_id, created_at);

drop policy if exists "Signed-in users can add guestbook entries"
    on public.guestbook_entries;
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

commit;
