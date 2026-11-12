(() => {
    const client = window.sudokuSupabase;
    const form = document.getElementById('guestbook-form');
    const messageInput = document.getElementById('guestbook-message');
    const authNote = document.getElementById('guestbook-auth-note');
    const loginLink = document.getElementById('guestbook-login');
    const status = document.getElementById('guestbook-status');
    const list = document.getElementById('guestbook-list');
    let session = null;
    let loading = false;

    function setStatus(text, isError = false) {
        status.textContent = text;
        status.classList.toggle('is-error', isError);
    }

    function updateAuthView() {
        const signedIn = Boolean(session?.user);
        form.hidden = !signedIn;
        loginLink.hidden = signedIn;
        authNote.hidden = signedIn;
        if (signedIn) {
            const username = session.user.user_metadata?.username || 'игрок';
            authNote.textContent = `Вы вошли как ${username}.`;
        }
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

    function renderEntries(entries) {
        list.replaceChildren();
        if (!entries.length) {
            setStatus('Пока нет записей. Будь первым!');
            return;
        }

        entries.forEach(entry => {
            const profile = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
            const username = profile?.username || 'Игрок';
            const item = document.createElement('li');
            item.className = 'guestbook-entry';

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

            if (session?.user?.id === entry.user_id) {
                const deleteButton = document.createElement('button');
                deleteButton.className = 'guestbook-delete';
                deleteButton.type = 'button';
                deleteButton.textContent = 'Удалить свою запись';
                deleteButton.addEventListener('click', () => deleteEntry(entry.id, deleteButton));
                item.appendChild(deleteButton);
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
            const { data, error } = await client
                .from('guestbook_entries')
                .select('id, user_id, message, created_at, profiles(username, avatar_url)')
                .order('created_at', { ascending: false })
                .limit(40);
            if (error) throw error;
            renderEntries(data || []);
        } catch (error) {
            console.error('Could not load guestbook entries:', error);
            setStatus('Не удалось загрузить записи. Проверьте настройку базы Supabase.', true);
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

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        try {
            const { error } = await client.from('guestbook_entries').insert({
                user_id: session.user.id,
                message,
            });
            if (error) throw error;
            messageInput.value = '';
            setStatus('Запись добавлена.');
            await loadEntries();
        } catch (error) {
            console.error('Could not add guestbook entry:', error);
            setStatus(error.code === '42501'
                ? 'Войдите на странице Sudoku, чтобы оставить запись.'
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
