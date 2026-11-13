(() => {
    const client = window.sudokuSupabase;
    const form = document.getElementById('guestbook-form');
    const messageInput = document.getElementById('guestbook-message');
    const replyContext = document.getElementById('guestbook-reply-context');
    const replyAuthor = document.getElementById('guestbook-reply-author');
    const cancelReplyButton = document.getElementById('guestbook-cancel-reply');
    const authNote = document.getElementById('guestbook-auth-note');
    const loginLink = document.getElementById('guestbook-login');
    const status = document.getElementById('guestbook-status');
    const list = document.getElementById('guestbook-list');
    const submitButton = form.querySelector('button[type="submit"]');
    let session = null;
    let loading = false;
    let repliesEnabled = false;
    let replyTarget = null;

    const replyIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 17 4 12l5-5"/><path d="M4 12h10a6 6 0 0 1 6 6v1"/></svg>';
    const deleteIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>';

    function setStatus(text, isError = false) {
        status.textContent = text;
        status.classList.toggle('is-error', isError);
    }

    function updateAuthView() {
        const signedIn = Boolean(session?.user);
        form.hidden = !signedIn;
        loginLink.hidden = signedIn;
        authNote.hidden = signedIn;
        if (!signedIn) clearReplyTarget();
        if (signedIn) {
            const username = session.user.user_metadata?.username || 'игрок';
            authNote.textContent = `Вы вошли как ${username}.`;
        }
    }

    function clearReplyTarget() {
        replyTarget = null;
        replyContext.hidden = true;
        replyAuthor.textContent = '';
        messageInput.placeholder = 'Напиши что-нибудь хорошее…';
        submitButton.textContent = 'Оставить запись';
    }

    function startReply(entry, username) {
        if (!repliesEnabled) {
            setStatus('Ответы включатся после запуска supabase/guestbook-replies-migration.sql.');
            return;
        }
        if (!session?.user) {
            loginLink.hidden = false;
            setStatus('Войдите через Sudoku, чтобы ответить на запись.');
            return;
        }

        replyTarget = { id: entry.id, username };
        replyAuthor.textContent = username;
        replyContext.hidden = false;
        messageInput.placeholder = `Ответ для ${username}…`;
        submitButton.textContent = 'Отправить ответ';
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageInput.focus();
    }

    function safeAvatarUrl(value) {
        if (typeof value !== 'string' || !window.SUDOKU_SUPABASE_URL) return null;
        try {
            const avatar = new URL(value);
            return avatar.origin === new URL(window.SUDOKU_SUPABASE_URL).origin ? avatar.href : null;
        } catch {
            return null;
        }
    }

    function formatDate(value) {
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? ''
            : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    }

    function createActionButton(label, className, icon, onClick) {
        const button = document.createElement('button');
        button.className = `guestbook-action ${className}`;
        button.type = 'button';
        button.title = label;
        button.setAttribute('aria-label', label);
        button.innerHTML = icon;
        button.addEventListener('click', onClick);
        return button;
    }

    function renderEntry(entry, isReply = false) {
        const profile = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
        const username = profile?.username || 'Игрок';
        const item = document.createElement('li');
        item.className = isReply ? 'guestbook-entry guestbook-entry-reply' : 'guestbook-entry';

        const header = document.createElement('div');
        header.className = 'guestbook-entry-header';
        const avatar = document.createElement('span');
        avatar.className = 'guestbook-avatar';
        avatar.textContent = username.slice(0, 1).toUpperCase() || '?';
        const avatarUrl = safeAvatarUrl(profile?.avatar_url);
        if (avatarUrl) {
            const image = document.createElement('img');
            image.src = avatarUrl;
            image.alt = '';
            image.onerror = () => {
                image.remove();
                avatar.textContent = username.slice(0, 1).toUpperCase() || '?';
            };
            avatar.replaceChildren(image);
        }

        const author = document.createElement('strong');
        author.className = 'guestbook-author';
        author.textContent = username;
        const date = document.createElement('time');
        date.className = 'guestbook-date';
        date.dateTime = entry.created_at;
        date.textContent = formatDate(entry.created_at);
        header.append(avatar, author, date);

        const message = document.createElement('p');
        message.className = 'guestbook-message';
        message.textContent = entry.message;
        item.append(header, message);

        const actions = document.createElement('div');
        actions.className = 'guestbook-actions';
        if (!isReply) {
            actions.appendChild(createActionButton(
                'Ответить',
                'guestbook-reply',
                replyIcon,
                () => startReply(entry, username)
            ));
        }
        if (session?.user?.id === entry.user_id) {
            actions.appendChild(createActionButton(
                'Удалить свою запись',
                'guestbook-delete',
                deleteIcon,
                event => deleteEntry(entry.id, event.currentTarget)
            ));
        }
        if (actions.childElementCount) item.appendChild(actions);

        return item;
    }

    function renderEntries(entries) {
        list.replaceChildren();
        const roots = [];
        const repliesByParent = new Map();
        entries.forEach(entry => {
            if (!entry.parent_entry_id) {
                roots.push(entry);
                return;
            }
            const replies = repliesByParent.get(entry.parent_entry_id) || [];
            replies.push(entry);
            repliesByParent.set(entry.parent_entry_id, replies);
        });

        if (!roots.length) {
            setStatus('Пока нет записей. Будь первым!');
            return;
        }

        roots.forEach(entry => {
            const item = renderEntry(entry);
            const replies = repliesByParent.get(entry.id) || [];
            if (replies.length) {
                const replyList = document.createElement('ol');
                replyList.className = 'guestbook-replies';
                replies
                    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                    .forEach(reply => replyList.appendChild(renderEntry(reply, true)));
                item.appendChild(replyList);
            }
            list.appendChild(item);
        });
        setStatus(`Записей: ${entries.length}`);
    }

    async function loadEntries() {
        if (!client || loading) return;
        loading = true;
        setStatus('Загружаем записи…');
        try {
            const columns = 'id, user_id, message, created_at, parent_entry_id, profiles(username, avatar_url)';
            const { data: roots, error } = await client
                .from('guestbook_entries')
                .select(columns)
                .is('parent_entry_id', null)
                .order('created_at', { ascending: false })
                .limit(40);
            if (error) {
                if (!String(error.message).includes('parent_entry_id')) throw error;
                repliesEnabled = false;
                const { data: legacyEntries, error: legacyError } = await client
                    .from('guestbook_entries')
                    .select('id, user_id, message, created_at, profiles(username, avatar_url)')
                    .order('created_at', { ascending: false })
                    .limit(40);
                if (legacyError) throw legacyError;
                renderEntries(legacyEntries || []);
                setStatus('Ответы включатся после запуска supabase/guestbook-replies-migration.sql.');
                return;
            }

            repliesEnabled = true;
            const entries = roots || [];
            if (entries.length) {
                const { data: replies, error: replyError } = await client
                    .from('guestbook_entries')
                    .select(columns)
                    .in('parent_entry_id', entries.map(entry => entry.id))
                    .order('created_at', { ascending: true })
                    .limit(100);
                if (replyError) throw replyError;
                entries.push(...(replies || []));
            }
            renderEntries(entries);
        } catch (error) {
            console.error('Could not load guestbook entries:', error);
            const migrationMissing = String(error.message).includes('parent_entry_id');
            setStatus(migrationMissing
                ? 'Для ответов запустите supabase/guestbook-replies-migration.sql.'
                : 'Не удалось загрузить записи. Проверьте настройку базы Supabase.', true);
        } finally {
            loading = false;
        }
    }

    async function deleteEntry(id, button) {
        if (!client || !session?.user || button.disabled) return;
        button.disabled = true;
        try {
            const { error } = await client.from('guestbook_entries').delete().eq('id', id);
            if (error) throw error;
            if (replyTarget?.id === id) clearReplyTarget();
            await loadEntries();
        } catch (error) {
            console.error('Could not delete guestbook entry:', error);
            setStatus('Не удалось удалить запись. Попробуйте ещё раз.', true);
            button.disabled = false;
        }
    }

    async function submitEntry(event) {
        event.preventDefault();
        if (!client || !session?.user) {
            setStatus('Чтобы оставить запись, войдите на странице Sudoku.', true);
            return;
        }
        const message = messageInput.value.trim();
        if (!message || message.length > 500) {
            setStatus('Сообщение должно содержать от 1 до 500 символов.', true);
            return;
        }

        const parentEntryId = replyTarget?.id || null;
        submitButton.disabled = true;
        try {
            const entry = {
                user_id: session.user.id,
                message,
            };
            if (repliesEnabled) entry.parent_entry_id = parentEntryId;
            const { error } = await client.from('guestbook_entries').insert(entry);
            if (error) throw error;
            messageInput.value = '';
            clearReplyTarget();
            await loadEntries();
            setStatus(parentEntryId ? 'Ответ добавлен.' : 'Запись добавлена.');
        } catch (error) {
            console.error('Could not add guestbook entry:', error);
            setStatus(error.code === '42501'
                ? 'Войдите на странице Sudoku, чтобы оставить запись.'
                : String(error.message).includes('parent_entry_id')
                    ? 'Для ответов запустите supabase/guestbook-replies-migration.sql.'
                    : 'Не удалось добавить запись. Проверьте соединение и настройки базы.', true);
        } finally {
            submitButton.disabled = false;
        }
    }

    if (!client) {
        form.hidden = true;
        loginLink.hidden = true;
        authNote.hidden = true;
        setStatus('Гостевая книга недоступна: не удалось подключить Supabase.', true);
        return;
    }

    form.addEventListener('submit', submitEntry);
    cancelReplyButton.addEventListener('click', clearReplyTarget);
    client.auth.onAuthStateChange((_event, nextSession) => {
        session = nextSession;
        updateAuthView();
        void loadEntries();
    });

    client.auth.getSession().then(({ data, error }) => {
        if (error) throw error;
        session = data.session;
        updateAuthView();
        return loadEntries();
    }).catch(error => {
        console.error('Could not initialize guestbook session:', error);
        session = null;
        updateAuthView();
        setStatus('Не удалось проверить вход. Обновите страницу и попробуйте ещё раз.', true);
    });
})();
