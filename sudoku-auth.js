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
    const profileTrigger = document.getElementById('profile-trigger');
    const profileDialog = document.getElementById('profile-dialog');
    const profileClose = document.getElementById('profile-close');
    const profileTriggerAvatar = document.getElementById('profile-trigger-avatar');
    const profileTriggerLabel = document.getElementById('profile-trigger-label');
    const profileAvatar = document.getElementById('profile-avatar');
    const profileAvatarPlaceholder = document.getElementById('profile-avatar-placeholder');
    const profileUsername = document.getElementById('profile-username');
    const profileTools = document.getElementById('profile-tools');
    const profileStats = document.getElementById('profile-stats');
    const profileTotal = document.getElementById('profile-total');
    const profileRecords = document.getElementById('profile-records');
    const avatarFile = document.getElementById('avatar-file');
    let session = null;
    let busy = false;
    let profileLoadId = 0;
    let resolveSessionReady;
    const sessionReady = new Promise(resolve => { resolveSessionReady = resolve; });

    function showMessage(text, isError = false) {
        message.textContent = text;
        message.classList.toggle('is-error', isError);
    }

    function setBusy(value) {
        busy = value;
        form.querySelectorAll('button, input').forEach(element => {
            element.disabled = value;
        });
        avatarFile.disabled = value;
    }

    function setAuthView(user) {
        const signedIn = Boolean(user);
        const username = user?.user_metadata?.username || 'игрок';
        status.textContent = signedIn ? `В сети: ${username}` : 'Войдите, чтобы сохранить рекорд';
        profileUsername.textContent = signedIn ? username : 'Гость';
        profileTriggerLabel.textContent = signedIn ? username : 'Профиль';
        credentialFields.forEach(field => { field.hidden = signedIn; });
        form.querySelector('[data-auth-action="sign-in"]').hidden = signedIn;
        signUpButton.hidden = signedIn;
        signOutButton.hidden = !signedIn;
        profileTools.hidden = !signedIn;
        profileStats.hidden = !signedIn;
        renderAvatar(null, signedIn ? username : '?');
        profileTotal.textContent = signedIn ? 'Загружаем результаты…' : '';
        if (!signedIn) profileRecords.replaceChildren();
    }

    function renderAvatar(url, username = 'игрок') {
        profileAvatar.hidden = !url;
        profileAvatarPlaceholder.hidden = Boolean(url);
        profileAvatar.alt = `Аватар ${username}`;
        if (url) {
            profileAvatar.src = url;
            profileAvatar.onerror = () => {
                profileAvatar.hidden = true;
                profileAvatarPlaceholder.hidden = false;
            };
        } else {
            profileAvatar.removeAttribute('src');
            profileAvatarPlaceholder.textContent = username.slice(0, 1).toUpperCase() || '?';
        }

        profileTriggerAvatar.replaceChildren();
        if (url) {
            const image = document.createElement('img');
            image.src = url;
            image.alt = '';
            image.onerror = () => { image.remove(); profileTriggerAvatar.textContent = username.slice(0, 1).toUpperCase() || '?'; };
            profileTriggerAvatar.appendChild(image);
        } else {
            profileTriggerAvatar.textContent = username.slice(0, 1).toUpperCase() || '?';
        }
    }

    async function loadProfileData(user) {
        const requestId = ++profileLoadId;
        let profileResult;
        let scoresResult;
        try {
            [profileResult, scoresResult] = await Promise.all([
                client.from('profiles').select('username, avatar_url').eq('id', user.id).maybeSingle(),
                client.from('sudoku_scores').select('difficulty, best_seconds, completed_games').eq('user_id', user.id),
            ]);
        } catch (error) {
            if (requestId !== profileLoadId) return;
            console.error('Could not load Sudoku profile data:', error);
            showMessage('Не удалось загрузить данные профиля. Проверьте подключение.', true);
            profileTotal.textContent = 'Статистика пока недоступна.';
            profileRecords.replaceChildren();
            return;
        }
        if (requestId !== profileLoadId) return;
        const { data: profile, error: profileError } = profileResult;
        const { data: scores, error: scoresError } = scoresResult;
        if (profileError) {
            console.error('Could not load Sudoku profile:', profileError);
            showMessage('Не удалось загрузить профиль. Проверьте обновлённую схему Supabase.', true);
        } else if (profile) {
            profileUsername.textContent = profile.username;
            profileTriggerLabel.textContent = profile.username;
            renderAvatar(profile.avatar_url, profile.username);
        }

        if (scoresError) {
            console.error('Could not load Sudoku statistics:', scoresError);
            profileTotal.textContent = 'Статистика пока недоступна.';
            profileRecords.replaceChildren();
            return;
        }
        renderProfileStats(scores || []);
    }

    function renderProfileStats(scores) {
        const total = scores.reduce((sum, score) => sum + score.completed_games, 0);
        profileTotal.textContent = `Решено рейтинговых игр: ${total}`;
        profileRecords.replaceChildren();
        [
            ['easy', 'Легко'],
            ['medium', 'Средне'],
            ['hard', 'Сложно'],
        ].forEach(([difficulty, label]) => {
            const score = scores.find(item => item.difficulty === difficulty);
            const card = document.createElement('div');
            card.className = 'profile-record';
            const title = document.createElement('span');
            title.textContent = label;
            const record = document.createElement('strong');
            record.textContent = score ? formatTime(score.best_seconds) : '—';
            const count = document.createElement('span');
            count.textContent = `${score?.completed_games || 0} игр`;
            card.append(title, record, count);
            profileRecords.appendChild(card);
        });
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

    async function compressAvatar(file) {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();

        for (const quality of [0.84, 0.72, 0.6, 0.48]) {
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
            if (!blob || blob.type !== 'image/webp') {
                throw new Error('Браузер не смог обработать изображение. Попробуйте PNG или JPEG.');
            }
            if (blob.size <= 300 * 1024) return blob;
        }
        throw new Error('Не удалось сжать аватар до 300 КБ. Выберите другое изображение.');
    }

    async function uploadAvatar(file) {
        if (!session?.user) throw new Error('Войдите в аккаунт, чтобы загрузить аватар.');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            throw new Error('Поддерживаются только изображения PNG, JPEG и WebP.');
        }
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('Исходное изображение должно быть не больше 5 МБ.');
        }

        const blob = await compressAvatar(file);
        const path = `${session.user.id}/avatar.webp`;
        const { error: uploadError } = await client.storage
            .from('profile-avatars')
            .upload(path, blob, { contentType: 'image/webp', upsert: true, cacheControl: '3600' });
        if (uploadError) throw uploadError;

        const { data } = client.storage.from('profile-avatars').getPublicUrl(path);
        const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
        const { data: updatedProfile, error: profileError } = await client
            .from('profiles')
            .update({ avatar_url: avatarUrl })
            .eq('id', session.user.id)
            .select('id')
            .maybeSingle();
        if (profileError) throw profileError;
        if (!updatedProfile) throw new Error('Профиль не найден. Повторно войдите в аккаунт.');
        renderAvatar(avatarUrl, profileUsername.textContent);
        showMessage('Аватар обновлён.');
    }

    if (!client) {
        status.textContent = 'Авторизация недоступна';
        showMessage('Не загрузился Supabase SDK. Проверьте подключение к интернету и перезагрузите страницу.', true);
        leaderboardBody.innerHTML = '<tr><td colspan="4">Не удалось подключиться к Supabase.</td></tr>';
        window.SudokuAuth = { isSignedIn: () => false };
        return;
    }

    profileTrigger.addEventListener('click', () => profileDialog.showModal());
    profileClose.addEventListener('click', () => profileDialog.close());
    profileDialog.addEventListener('click', event => {
        if (event.target === profileDialog) profileDialog.close();
    });

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

    avatarFile.addEventListener('change', async () => {
        const file = avatarFile.files[0];
        if (!file) return;
        setBusy(true);
        try {
            await uploadAvatar(file);
        } catch (error) {
            console.error('Could not upload profile avatar:', error);
            showMessage(error.message || 'Не удалось загрузить аватар.', true);
        } finally {
            setBusy(false);
            avatarFile.value = '';
        }
    });

    leaderboardDifficulty.addEventListener('change', loadLeaderboard);
    client.auth.onAuthStateChange((_event, nextSession) => {
        session = nextSession;
        setAuthView(session?.user);
        resolveSessionReady();
        if (session?.user) void loadProfileData(session.user);
        else profileLoadId++;
        loadLeaderboard();
    });

    window.SudokuAuth = {
        isSignedIn: () => Boolean(session?.access_token),
        getUserId: () => session?.user?.id || null,
        async waitForSession() {
            await sessionReady;
        },
        async loadProgress() {
            await sessionReady;
            if (!session?.access_token) return null;
            const { data, error } = await client
                .from('sudoku_progress')
                .select('state, updated_at')
                .eq('user_id', session.user.id)
                .maybeSingle();
            if (error) throw error;
            return data?.state ? { ...data.state, savedAt: Date.parse(data.updated_at) } : null;
        },
        async saveProgress(progress) {
            if (!session?.access_token) return false;
            const { error } = await client
                .from('sudoku_progress')
                .upsert({ user_id: session.user.id, state: progress }, { onConflict: 'user_id' });
            if (error) throw error;
            return true;
        },
        async clearProgress() {
            if (!session?.access_token) return;
            const { error } = await client
                .from('sudoku_progress')
                .delete()
                .eq('user_id', session.user.id);
            if (error) throw error;
        },
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
            if (session?.user) await loadProfileData(session.user);
            return data;
        },
    };

    client.auth.getSession().then(({ data, error }) => {
        if (error) {
            showMessage('Не удалось восстановить сессию: ' + error.message, true);
            resolveSessionReady();
            return;
        }
        session = data.session;
        setAuthView(session?.user);
        resolveSessionReady();
        if (session?.user) void loadProfileData(session.user);
        loadLeaderboard();
    });
})();
