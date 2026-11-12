let solution = [];         
let selectedCell = null;
let timerInterval;
let seconds = 0;
let isGameOver = false;
let currentGameId = null;
let rankedGame = false;
let dailyGame = false;
let dailyChallengeDate = null;
let assistedGame = false;
let gameRequestId = 0;
let currentDifficulty = 'easy';
const PROGRESS_KEY = 'sudoku-progress-v1';
const saveNote = document.getElementById('save-note');
const DAILY_ACHIEVEMENTS = [
    { code: 'first_daily', label: 'Первое задание' },
    { code: 'streak_3', label: '3 дня подряд' },
    { code: 'streak_7', label: 'Неделя подряд' },
    { code: 'streak_30', label: 'Месяц подряд' },
    { code: 'daily_10', label: '10 заданий' },
    { code: 'daily_50', label: '50 заданий' },
    { code: 'daily_100', label: '100 заданий' },
];
let cloudSaveTimeout = null;
let cloudSyncQueue = Promise.resolve();
let cloudSavedAt = 0;
let cloudSyncError = false;

const allCells = () => document.querySelectorAll('.sudoku-cell');
const isEditable = cell => !cell.classList.contains('fixed') && !cell.classList.contains('hinted');
const progressStorageKey = (mode = dailyGame ? 'daily' : 'normal') => {
    const userId = window.SudokuAuth?.getUserId?.();
    if (mode === 'daily') return `${PROGRESS_KEY}:daily:${userId || 'guest'}`;
    return userId ? `${PROGRESS_KEY}:${userId}` : PROGRESS_KEY;
};


function getBoard() {
    return [...allCells()].map(c => (c.innerText === '' ? 0 : parseInt(c.innerText)));
}

async function startGame(difficulty, savedProgress = null) {
    const requestId = ++gameRequestId;
    if (cloudSaveTimeout !== null) {
        const previousMode = dailyGame ? 'daily' : 'normal';
        clearTimeout(cloudSaveTimeout);
        cloudSaveTimeout = null;
        const pendingProgress = readSavedProgress(previousMode);
        if (pendingProgress) persistCloudProgress(previousMode, pendingProgress);
    }
    clearInterval(timerInterval);
    seconds = savedProgress ? savedProgress.seconds : 0;
    isGameOver = false;
    currentDifficulty = difficulty;
    currentGameId = savedProgress?.gameId || null;
    const savedMode = savedProgress?.mode || (savedProgress?.ranked ? 'ranked' : 'local');
    dailyGame = savedMode === 'daily';
    dailyChallengeDate = dailyGame ? savedProgress.challengeDate : null;
    rankedGame = savedMode === 'ranked' && Boolean(savedProgress?.ranked && currentGameId);
    assistedGame = Boolean(savedProgress?.assisted);
    document.getElementById('timer').innerText = '00:00';
    document.getElementById('message').innerText = '';

    const board = document.getElementById('sudoku-board');
    board.innerHTML = '';
    selectedCell = null;

    let data;
    let startNotice = '';
    const auth = window.SudokuAuth;
    if (savedProgress) {
        data = { puzzle: savedProgress.puzzle, solution: savedProgress.solution || Sudoku.solve(savedProgress.puzzle) };
        if (!data.solution) {
            clearSavedProgress();
            throw new Error('Сохранённая игра повреждена. Начните новую игру.');
        }
    } else if (auth?.isSignedIn()) {
        document.getElementById('message').innerText = 'Создаём рейтинговую игру…';
        try {
            const ranked = await auth.createRankedGame(difficulty);
            if (requestId !== gameRequestId) return;
            data = { puzzle: ranked.puzzle, solution: Sudoku.solve(ranked.puzzle) };
            if (!data.solution) throw new Error('Сервер прислал нерешаемую головоломку.');
            currentGameId = ranked.gameId;
            rankedGame = true;
        } catch (error) {
            if (requestId !== gameRequestId) return;
            console.error('Could not start ranked Sudoku:', error);
            startNotice = 'Рейтинговая игра недоступна: ' + (error.message || 'ошибка сервера') + ' Запущена локальная игра.';
            data = Sudoku.generate(difficulty);
        }
    } else {
        data = Sudoku.generate(difficulty);
    }

    if (requestId !== gameRequestId) return;
    document.getElementById('message').innerText = startNotice;
    solution = data.solution;

    for (let i = 0; i < 81; i++) {
        const cell = document.createElement('div');
        cell.classList.add('sudoku-cell');
        cell.dataset.index = i;

        cell.addEventListener('click', function () {
            if (isGameOver) return;
            selectCell(this);
        });

        if (data.puzzle[i] !== 0) {
            cell.innerText = data.puzzle[i];
            cell.classList.add('fixed');
        }

        const row = Math.floor(i / 9);
        const col = i % 9;
        if ((col + 1) % 3 === 0 && col !== 8) cell.classList.add('border-right');
        if ((row + 1) % 3 === 0 && row !== 8) cell.classList.add('border-bottom');

        board.appendChild(cell);
    }

    if (savedProgress) {
        const hinted = new Set(savedProgress.hinted || []);
        allCells().forEach((cell, index) => {
            if (cell.classList.contains('fixed') || !savedProgress.board[index]) return;
            cell.innerText = savedProgress.board[index];
            if (hinted.has(index)) cell.classList.add('hinted');
            else checkCell(cell);
        });
    }

    timerInterval = setInterval(() => {
        updateTimer();
        saveProgress();
    }, 1000);
    displayTimer();
    updateStats();
    saveProgress();
}

function selectCell(cell) {
    selectedCell = cell;
    const cells = [...allCells()];
    cells.forEach(c => c.classList.remove('highlight', 'crosshair', 'same-num'));
    if (!cell) return;

    const index = parseInt(cell.dataset.index);
    const board = getBoard();
    const val = board[index];
    const peers = new Set(Sudoku.PEERS[index]); 

    cells.forEach((c, i) => {
        if (peers.has(i)) c.classList.add('crosshair');
        if (val && i !== index && board[i] === val) c.classList.add('same-num');
    });
    cell.classList.add('highlight');
}

function inputNumber(num) {
    if (!selectedCell || isGameOver || !isEditable(selectedCell)) return;

    if (num === 0) {
        selectedCell.innerText = '';
        selectedCell.classList.remove('correct', 'wrong');
    } else {
        selectedCell.innerText = num;
        checkCell(selectedCell);
    }
    updateStats();
    saveProgress();
    selectCell(selectedCell);
    finishIfSolved();
}

function checkCell(cell) {
    cell.classList.remove('correct', 'wrong');
    if (cell.innerText === '') return;
    const index = parseInt(cell.dataset.index);
    cell.classList.add(parseInt(cell.innerText) === solution[index] ? 'correct' : 'wrong');
}

function updateStats() {
    let remain = 0, correct = 0, wrong = 0;
    allCells().forEach(cell => {
        if (cell.classList.contains('fixed')) return;
        if (cell.innerText === '') remain++;
        else if (cell.classList.contains('correct') || cell.classList.contains('hinted')) correct++;
        else wrong++;
    });
    document.getElementById('stat-remain').innerText = remain;
    document.getElementById('stat-correct').innerText = correct;
    document.getElementById('stat-wrong').innerText = wrong;

    const left = Sudoku.remaining(getBoard());
    document.querySelectorAll('#numpad button[data-n]').forEach(b => {
        const n = parseInt(b.dataset.n);
        b.querySelector('small').innerText = Math.max(left[n], 0);
        b.style.visibility = left[n] <= 0 ? 'hidden' : 'visible';
    });
}

function updateTimer() {
    seconds++;
    displayTimer();
}

function displayTimer() {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    document.getElementById('timer').innerText = `${mins}:${secs}`;
}

function finishIfSolved() {
    if (!Sudoku.isSolved(getBoard(), solution)) return;
    const messageEl = document.getElementById('message');
    messageEl.innerText = `🎉 Победа! Время: ${document.getElementById('timer').innerText}`;
    messageEl.style.color = '#ff6577';
    isGameOver = true;
    clearInterval(timerInterval);
    clearSavedProgress();
    clearCloudProgress();
    saveNote.textContent = 'Игра завершена — сохранение прогресса очищено.';
    saveNote.classList.remove('is-saved');

    if (dailyGame && currentGameId) {
        messageEl.innerText += ' Проверяем ежедневный результат…';
        window.SudokuAuth.submitDailyGame(currentGameId, getBoard())
            .then(async result => {
                await refreshDailyStats();
                messageEl.innerText = `🎉 Задание принято! Серия: ${result.current_streak} дн. Всего решено: ${result.completed_days}.`;
            })
            .catch(error => {
                console.error('Could not submit daily Sudoku result:', error);
                messageEl.innerText = 'Победа! Не удалось сохранить ежедневный результат: ' + (error.message || 'ошибка сервера');
            });
    } else if (rankedGame && currentGameId && !assistedGame) {
        messageEl.innerText += ' Сохраняем результат…';
        window.SudokuAuth.submitRankedGame(currentGameId, getBoard())
            .then(result => {
                messageEl.innerText = `🎉 Рекорд принят! Время сервера: ${formatElapsed(result.elapsed_seconds)}. Лучшее: ${formatElapsed(result.best_seconds)}.`;
            })
            .catch(error => {
                console.error('Could not submit Sudoku result:', error);
                messageEl.innerText = 'Победа! Не удалось сохранить результат: ' + (error.message || 'ошибка сервера');
            });
    } else if (rankedGame && assistedGame) {
        messageEl.innerText += ' Игра с подсказкой не попадает в рейтинг.';
    }
}

async function startDailyChallenge() {
    const auth = window.SudokuAuth;
    await auth?.waitForSession?.();
    if (!auth?.isSignedIn()) {
        document.getElementById('daily-note').textContent = 'Войдите в профиль, чтобы начать ежедневное задание.';
        document.getElementById('profile-trigger').click();
        return;
    }

    const button = document.getElementById('daily-start-button');
    button.disabled = true;
    document.getElementById('daily-note').textContent = 'Загружаем задание дня…';
    let failureMessage = null;
    try {
        const challenge = await auth.createDailyGame();
        if (challenge.completed) {
            document.getElementById('message').textContent = 'Ежедневное задание уже решено. Новое появится после смены дня UTC.';
            await refreshDailyStats();
            return;
        }

        const savedDaily = await loadDailyGameProgress(challenge.gameId, challenge.challengeDate);
        if (savedDaily) {
            await startGame(savedDaily.difficulty, savedDaily);
        } else {
            const answer = Sudoku.solve(challenge.puzzle);
            if (!answer) throw new Error('Сервер прислал нерешаемую головоломку.');
            await startGame('medium', {
                version: 1,
                difficulty: 'medium',
                puzzle: challenge.puzzle,
                solution: answer,
                board: challenge.puzzle.slice(),
                seconds: 0,
                assisted: false,
                gameId: challenge.gameId,
                ranked: false,
                hinted: [],
                savedAt: Date.now(),
                mode: 'daily',
                challengeDate: challenge.challengeDate,
            });
        }
        dailyChallengeDate = challenge.challengeDate;
        document.getElementById('daily-date').textContent = formatChallengeDate(challenge.challengeDate);
        document.getElementById('daily-note').textContent = 'Одна общая головоломка для всех. Результат проверяется сервером.';
        document.getElementById('message').textContent = 'Ежедневное задание загружено. Удачи!';
    } catch (error) {
        console.error('Could not start daily Sudoku:', error);
        failureMessage = error?.message || 'Ежедневное задание недоступно.';
        document.getElementById('daily-note').textContent = `Не удалось загрузить задание: ${failureMessage}`;
        document.getElementById('message').textContent = failureMessage;
    } finally {
        button.disabled = false;
        await refreshDailyStats();
        if (failureMessage) {
            document.getElementById('daily-note').textContent =
                `Ошибка загрузки: ${failureMessage}. Проверьте SQL-миграцию и публикацию функции sudoku-game.`;
        }
    }
}

async function loadDailyGameProgress(gameId, challengeDate) {
    const candidates = [readSavedProgress('daily')].filter(Boolean);
    try {
        const cloudProgress = await window.SudokuAuth.loadDailyProgress();
        if (cloudProgress) {
            const candidate = { ...cloudProgress, version: 1, mode: 'daily' };
            if (isValidProgress(candidate, 'daily')) candidates.push(candidate);
            else console.error('Ignoring invalid cloud daily Sudoku progress.');
        }
    } catch (error) {
        console.error('Could not load cloud daily Sudoku progress:', error);
    }

    return candidates
        .filter(progress => progress.gameId === gameId && progress.challengeDate === challengeDate)
        .sort((left, right) => (Number(right.savedAt) || 0) - (Number(left.savedAt) || 0))[0] || null;
}

function formatChallengeDate(value) {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
}

async function refreshDailyStats() {
    const dateLabel = document.getElementById('daily-date');
    const today = new Date().toISOString().slice(0, 10);
    dateLabel.textContent = formatChallengeDate(today);
    const auth = window.SudokuAuth;
    const signedIn = Boolean(auth?.isSignedIn());
    const note = document.getElementById('daily-note');
    const startButton = document.getElementById('daily-start-button');

    if (!signedIn) {
        document.getElementById('daily-current-streak').textContent = '—';
        document.getElementById('daily-best-streak').textContent = '—';
        document.getElementById('daily-completed-days').textContent = '—';
        note.textContent = 'Войдите в профиль, чтобы сохранять серии и достижения.';
        startButton.disabled = false;
        startButton.textContent = 'Играть сегодня';
        renderDailyAchievements([]);
        return;
    }

    try {
        const result = await auth.loadDailyStats();
        const stats = result?.stats;
        const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
        const activeStreak = stats && [today, yesterday].includes(stats.last_challenge_date)
            ? stats.current_streak
            : 0;
        const completedToday = stats?.last_challenge_date === today;
        document.getElementById('daily-current-streak').textContent = String(activeStreak);
        document.getElementById('daily-best-streak').textContent = String(stats?.best_streak || 0);
        document.getElementById('daily-completed-days').textContent = String(stats?.completed_days || 0);
        note.textContent = completedToday
            ? 'Сегодняшнее задание уже решено. Следующее появится после смены дня UTC.'
            : 'Решайте задание каждый день, чтобы поддерживать серию.';
        startButton.disabled = completedToday;
        startButton.textContent = completedToday ? 'Уже решено сегодня' : 'Играть сегодня';
        renderDailyAchievements(result?.achievements || []);
    } catch (error) {
        console.error('Could not load daily Sudoku stats:', error);
        note.textContent = 'Статистика недоступна. Проверьте применение миграции Supabase.';
        startButton.disabled = false;
        startButton.textContent = 'Играть сегодня';
    }
}

function renderDailyAchievements(unlocked = []) {
    const unlockedCodes = new Set(unlocked.map(item => typeof item === 'string' ? item : item.code));
    const container = document.getElementById('daily-achievements');
    container.replaceChildren();
    DAILY_ACHIEVEMENTS.forEach(achievement => {
        const badge = document.createElement('span');
        badge.className = 'daily-achievement';
        badge.textContent = achievement.label;
        badge.classList.toggle('is-unlocked', unlockedCodes.has(achievement.code));
        badge.setAttribute('aria-label', `${achievement.label}: ${unlockedCodes.has(achievement.code) ? 'получено' : 'не получено'}`);
        container.appendChild(badge);
    });
}

function formatElapsed(value) {
    const minutes = Math.floor(value / 60).toString().padStart(2, '0');
    const secs = (value % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
}

function giveHint() {
    if (isGameOver) return;
    assistedGame = true;
    const h = Sudoku.hint(getBoard(), solution);
    if (!h) return;

    const cell = allCells()[h.index];
    cell.innerText = h.value;
    cell.classList.remove('correct', 'wrong');
    cell.classList.add('hinted');

    const messageEl = document.getElementById('message');
    messageEl.innerText = '💡 ' + h.text;
    messageEl.style.color = '#ff6577';

    updateStats();
    saveProgress();
    selectCell(cell);
    finishIfSolved();
}

function checkSolution() {
    if (isGameOver) return;
    let errors = 0, empty = 0;

    allCells().forEach(cell => {
        const index = parseInt(cell.dataset.index);
        if (cell.innerText === '') {
            empty++;
        } else if (isEditable(cell) && parseInt(cell.innerText) !== solution[index]) {
            cell.classList.add('wrong');
            errors++;
        }
    });

    const messageEl = document.getElementById('message');
    messageEl.innerText = `❌ Ошибок: ${errors} | Пустых: ${empty}`;
    messageEl.style.color = '#ff203b';
    updateStats();
    finishIfSolved();
}

function solveGame() {
    if (isGameOver) return;
    assistedGame = true;
    allCells().forEach((cell, index) => {
        if (!cell.classList.contains('fixed')) {
            cell.innerText = solution[index];
            cell.classList.remove('correct', 'wrong');
            cell.classList.add('hinted');
        }
    });

    const messageEl = document.getElementById('message');
    messageEl.innerText = '🤖 Судоку решено!';
    messageEl.style.color = '#ff6577';
    isGameOver = true;
    clearInterval(timerInterval);
    clearSavedProgress();
    clearCloudProgress();
    saveNote.textContent = 'Игра завершена — сохранение прогресса очищено.';
    saveNote.classList.remove('is-saved');
    updateStats();
}

function saveProgress() {
    if (isGameOver || allCells().length !== 81) return;
    const mode = dailyGame ? 'daily' : 'normal';
    const progress = {
        version: 1,
        mode: dailyGame ? 'daily' : rankedGame ? 'ranked' : 'local',
        challengeDate: dailyChallengeDate,
        difficulty: currentDifficulty,
        puzzle: [...allCells()].map(cell => cell.classList.contains('fixed') ? Number(cell.innerText) : 0),
        solution: solution.slice(),
        board: getBoard(),
        seconds,
        assisted: assistedGame,
        gameId: currentGameId,
        ranked: rankedGame,
        hinted: [...allCells()].flatMap((cell, index) => cell.classList.contains('hinted') ? [index] : []),
        savedAt: Date.now(),
    };
    try {
        localStorage.setItem(progressStorageKey(), JSON.stringify(progress));
        saveNote.textContent = cloudSyncError
            ? 'Сохранено в браузере; облачная синхронизация не удалась.'
            : 'Прогресс сохранён в этом браузере.';
        saveNote.classList.add('is-saved');
    } catch (error) {
        console.error('Could not save Sudoku progress:', error);
        saveNote.textContent = 'Не удалось сохранить прогресс. Проверьте настройки браузера.';
        saveNote.classList.remove('is-saved');
    }
    queueCloudSave(mode);
}

function queueCloudSave(mode) {
    const auth = window.SudokuAuth;
    if (!auth?.isSignedIn() || cloudSaveTimeout !== null || isGameOver) return;
    const delay = Math.max(0, 10000 - (Date.now() - cloudSavedAt));
    cloudSaveTimeout = setTimeout(() => {
        cloudSaveTimeout = null;
        cloudSavedAt = Date.now();
        const latestProgress = readSavedProgress(mode);
        if (!isGameOver && latestProgress) persistCloudProgress(mode, latestProgress);
    }, delay);
}

function persistCloudProgress(mode, progress) {
    const auth = window.SudokuAuth;
    if (!auth?.isSignedIn()) return;
    const save = mode === 'daily' ? auth.saveDailyProgress : auth.saveProgress;
    cloudSyncQueue = cloudSyncQueue.then(() => save(progress)).then(() => {
        cloudSavedAt = Date.now();
        cloudSyncError = false;
        saveNote.textContent = 'Прогресс сохранён в браузере и аккаунте.';
        saveNote.classList.add('is-saved');
    }).catch(error => {
        cloudSyncError = true;
        console.error('Could not sync Sudoku progress:', error);
        saveNote.textContent = 'Сохранено в браузере; облачная синхронизация не удалась.';
        saveNote.classList.remove('is-saved');
    });
}

function clearCloudProgress(mode = dailyGame ? 'daily' : 'normal') {
    clearTimeout(cloudSaveTimeout);
    cloudSaveTimeout = null;
    if (!window.SudokuAuth?.isSignedIn()) return;
    const auth = window.SudokuAuth;
    const clear = mode === 'daily' ? auth.clearDailyProgress : auth.clearProgress;
    cloudSyncQueue = cloudSyncQueue.then(() => clear()).catch(error => {
        console.error('Could not clear cloud Sudoku progress:', error);
        saveNote.textContent = 'Игра завершена, но не удалось очистить облачный сейв.';
        saveNote.classList.remove('is-saved');
    });
}

function clearSavedProgress(mode = dailyGame ? 'daily' : 'normal') {
    try {
        localStorage.removeItem(progressStorageKey(mode));
    } catch (error) {
        console.error('Could not clear saved Sudoku progress:', error);
    }
}

function readSavedProgress(mode = 'normal') {
    try {
        const raw = localStorage.getItem(progressStorageKey(mode));
        if (!raw) return null;
        const progress = JSON.parse(raw);
        if (!isValidProgress(progress, mode)) {
            clearSavedProgress(mode);
            return null;
        }
        return progress;
    } catch (error) {
        console.error('Could not read saved Sudoku progress:', error);
        clearSavedProgress(mode);
        return null;
    }
}

function isValidProgress(progress, expectedMode = 'normal') {
    if (!progress || typeof progress !== 'object') return false;
    const validDifficulty = ['easy', 'medium', 'hard'].includes(progress.difficulty);
    const validBoards = [progress.puzzle, progress.solution, progress.board]
        .every(board => Array.isArray(board) && board.length === 81 &&
            board.every(value => Number.isInteger(value) && value >= 0 && value <= 9));
    const mode = progress.mode || (progress.ranked ? 'ranked' : 'local');
    const validMode = ['local', 'ranked', 'daily'].includes(mode);
    const matchingMode = expectedMode === 'daily' ? mode === 'daily' : mode !== 'daily';
    const validDaily = mode !== 'daily' ||
        (typeof progress.gameId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(progress.challengeDate));
    return progress.version === 1 && validDifficulty && validBoards && validMode && matchingMode && validDaily &&
        Number.isInteger(progress.seconds) && progress.seconds >= 0 &&
        typeof progress.assisted === 'boolean' &&
        typeof progress.ranked === 'boolean' &&
        (progress.gameId === null || typeof progress.gameId === 'string') &&
        Array.isArray(progress.hinted) && progress.hinted.every(index =>
            Number.isInteger(index) && index >= 0 && index < 81) &&
        progress.puzzle.every((value, index) => value === 0 || value === progress.solution[index]) &&
        progress.board.every((value, index) =>
            progress.puzzle[index] === 0 || value === progress.puzzle[index]);
}

async function loadBestProgress() {
    const auth = window.SudokuAuth;
    await auth?.waitForSession?.();
    const candidates = [
        readSavedProgress('normal'),
        readSavedProgress('daily'),
    ].filter(Boolean);

    if (auth?.loadProgress && auth?.loadDailyProgress) {
        const cloudLoads = await Promise.all([
            auth.loadProgress().catch(error => {
                console.error('Could not load cloud Sudoku progress:', error);
                return null;
            }),
            auth.loadDailyProgress().catch(error => {
                console.error('Could not load cloud daily Sudoku progress:', error);
                return null;
            }),
        ]);
        cloudLoads.forEach((cloudProgress, index) => {
            if (!cloudProgress) return;
            const mode = cloudProgress.mode || (cloudProgress.ranked ? 'ranked' : 'local');
            const candidate = { ...cloudProgress, version: 1, mode };
            const expectedMode = index === 1 ? 'daily' : 'normal';
            if (!isValidProgress(candidate, expectedMode)) {
                console.error('Ignoring invalid cloud Sudoku progress.');
                return;
            }
            if (expectedMode === 'daily' && candidate.challengeDate !== new Date().toISOString().slice(0, 10)) return;
            candidates.push(candidate);
        });
    }

    const currentDailyProgress = candidates.find(progress => progress.mode === 'daily');
    if (currentDailyProgress && currentDailyProgress.challengeDate !== new Date().toISOString().slice(0, 10)) {
        clearSavedProgress('daily');
        candidates.splice(candidates.indexOf(currentDailyProgress), 1);
    }
    return candidates.sort((left, right) =>
        (Number(right.savedAt) || 0) - (Number(left.savedAt) || 0))[0] || null;
}

document.addEventListener('keydown', e => {
    if (e.key >= '1' && e.key <= '9') inputNumber(parseInt(e.key));
    else if (e.key === 'Backspace' || e.key === 'Delete') inputNumber(0);
    else if (e.key.startsWith('Arrow') && selectedCell && !isGameOver) {
        e.preventDefault();
        const i = parseInt(selectedCell.dataset.index);
        const r = Math.floor(i / 9), c = i % 9;
        const nr = Math.min(8, Math.max(0, r + (e.key === 'ArrowDown') - (e.key === 'ArrowUp')));
        const nc = Math.min(8, Math.max(0, c + (e.key === 'ArrowRight') - (e.key === 'ArrowLeft')));
        selectCell(allCells()[nr * 9 + nc]);
    }
});

window.addEventListener('pagehide', saveProgress);
window.addEventListener('sudoku-auth-change', () => { void refreshDailyStats(); });
window.addEventListener('load', async () => {
    if (new URLSearchParams(window.location.search).get('profile') === '1') {
        document.getElementById('profile-dialog').showModal();
    }
    const progress = await loadBestProgress();
    if (progress) {
        await startGame(progress.difficulty, progress);
        saveNote.textContent = progress.mode === 'daily'
            ? 'Продолжили ежедневное задание.'
            : 'Продолжили сохранённую игру с этого устройства.';
        saveNote.classList.add('is-saved');
    } else {
        await startGame('easy');
    }
    await refreshDailyStats();
});
