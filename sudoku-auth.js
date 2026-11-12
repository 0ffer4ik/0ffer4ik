(() => {
    const client = window.sudokuSupabase;
    const form = document.getElementById('auth-form');
    const usernameInput = document.getElementById('auth-username');
    const passwordInput = document.getElementById('auth-password');
    const credentialFields = form.querySelectorAll('.auth-credential');
    const status = document.getElementById('auth-status');
    const message = document.getElementById('auth-message');
    const signUpButton = document.getElementById('sign-up-button');
    const signOutButton = document.getElementById('sign-out-button');
    const leaderboardBody = document.getElementById('leaderboard-body');
    const leaderboardDifficulty = document.getElementById('leaderboard-difficulty');
    let session = null;
    let busy = false;

    function showMessage(text, isError = false) {
        message.textContent = text;
        message.classList.toggle('is-error', isError);
    }

    function setBusy(value) {
        busy = value;
        form.querySelectorAll('button, input').forEach(element => {
            element.disabled = value;
        });
        signOutButton.disabled = value;
    }

    function setAuthView(user) {
        const signedIn = Boolean(user);
        const username = user?.user_metadata?.username || 'игрок';
        status.textContent = signedIn ? `В сети: ${username}` : 'Войдите, чтобы сохранить рекорд';
        credentialFields.forEach(field => { field.hidden = signedIn; });
        form.querySelector('[data-auth-action="sign-in"]').hidden = signedIn;
        signUpButton.hidden = signedIn;
        signOutButton.hidden = !signedIn;
    }

    function formatTime(totalSeconds) {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function renderLeaderboard(rows) {
        leaderboardBody.replaceChildren();
        if (!rows.length) {
            const row = leaderboardBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 4;
            cell.textContent = 'Пока нет результатов. Станьте первым!';
            return;
        }

        rows.forEach((score, index) => {
            const row = leaderboardBody.insertRow();
            [String(index + 1), score.profiles?.username || 'Игрок', formatTime(score.best_seconds), String(score.completed_games)]
                .forEach(value => {
                    const cell = row.insertCell();
                    cell.textContent = value;
                });
        });
    }

    async function loadLeaderboard() {
        if (!client) return;
        leaderboardBody.innerHTML = '<tr><td colspan="4">Загружаем рейтинг…</td></tr>';
        const { data, error } = await client
            .from('sudoku_scores')
            .select('user_id, best_seconds, completed_games, profiles(username)')
            .eq('difficulty', leaderboardDifficulty.value)
            .order('best_seconds', { ascending: true })
            .limit(20);

        if (error) {
            leaderboardBody.innerHTML = '<tr><td colspan="4">Рейтинг пока недоступен. Проверьте настройку базы Supabase.</td></tr>';
            console.error('Could not load Sudoku leaderboard:', error);
            return;
        }
        renderLeaderboard(data || []);
    }

    async function signIn() {
        const username = usernameInput.value.trim();
        if (!/^[A-Za-z0-9_-]{3,20}$/.test(username)) {
            throw new Error('Никнейм: 3–20 латинских букв, цифр, дефисов или подчёркиваний.');
        }
        const { error } = await client.auth.signInWithPassword({
            email: authEmailForUsername(username),
            password: passwordInput.value,
        });
        if (error) throw error;
        showMessage('Вы вошли в аккаунт.');
    }

    async function signUp() {
        const username = usernameInput.value.trim();
        if (!/^[A-Za-z0-9_-]{3,20}$/.test(username)) {
            throw new Error('Никнейм: 3–20 латинских букв, цифр, дефисов или подчёркиваний.');
        }
        const { data, error } = await client.auth.signUp({
            email: authEmailForUsername(username),
            password: passwordInput.value,
            options: { data: { username } },
        });
        if (error) throw error;
        if (!data.session) {
            showMessage('Supabase всё ещё требует подтверждение email. Выключи Confirm email в настройках Auth и удали незавершённый аккаунт перед повторной регистрацией.', true);
            return;
        }
        showMessage('Аккаунт создан. Можно начинать рейтинговую игру!');
    }

    function authEmailForUsername(username) {
        return `${username.toLowerCase()}@accounts.0ffer4ik.invalid`;
    }

    if (!client) {
        status.textContent = 'Авторизация недоступна';
        showMessage('Не загрузился Supabase SDK. Проверьте подключение к интернету и перезагрузите страницу.', true);
        leaderboardBody.innerHTML = '<tr><td colspan="4">Не удалось подключиться к Supabase.</td></tr>';
        window.SudokuAuth = { isSignedIn: () => false };
        return;
    }

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
            await signIn();
        } catch (error) {
            showMessage(error.message || 'Не удалось войти.', true);
        } finally {
            setBusy(false);
        }
    });

    signUpButton.addEventListener('click', async () => {
        if (busy || !form.reportValidity()) return;
        setBusy(true);
        try {
            await signUp();
        } catch (error) {
            showMessage(error.message || 'Не удалось создать аккаунт.', true);
        } finally {
            setBusy(false);
        }
    });

    signOutButton.addEventListener('click', async () => {
        if (busy) return;
        setBusy(true);
        try {
            const { error } = await client.auth.signOut();
            if (error) throw error;
            showMessage('Вы вышли из аккаунта.');
        } catch (error) {
            showMessage(error.message || 'Не удалось выйти.', true);
        } finally {
            setBusy(false);
        }
    });

    leaderboardDifficulty.addEventListener('change', loadLeaderboard);
    client.auth.onAuthStateChange((_event, nextSession) => {
        session = nextSession;
        setAuthView(session?.user);
        loadLeaderboard();
    });

    window.SudokuAuth = {
        isSignedIn: () => Boolean(session?.access_token),
        async createRankedGame(difficulty) {
            if (!session?.access_token) throw new Error('Сначала войдите в аккаунт.');
            const { data, error } = await client.functions.invoke('sudoku-game', {
                body: { action: 'new_game', difficulty },
            });
            if (error) throw error;
            if (!data?.gameId || !Array.isArray(data.puzzle) || data.puzzle.length !== 81) {
                throw new Error('Сервер вернул некорректную головоломку.');
            }
            return { gameId: data.gameId, puzzle: data.puzzle };
        },
        async submitRankedGame(gameId, board) {
            const { data, error } = await client.functions.invoke('sudoku-game', {
                body: { action: 'submit', gameId, board },
            });
            if (error) throw error;
            await loadLeaderboard();
            return data;
        },
    };

    client.auth.getSession().then(({ data, error }) => {
        if (error) {
            showMessage('Не удалось восстановить сессию: ' + error.message, true);
            return;
        }
        session = data.session;
        setAuthView(session?.user);
        loadLeaderboard();
    });
})();
