let solution = [];         
let selectedCell = null;
let timerInterval;
let seconds = 0;
let isGameOver = false;
let currentGameId = null;
let rankedGame = false;
let assistedGame = false;
let gameRequestId = 0;
let currentDifficulty = 'easy';
const PROGRESS_KEY = 'sudoku-progress-v1';
const saveNote = document.getElementById('save-note');
let cloudSaveTimeout = null;
let cloudSyncQueue = Promise.resolve();
let cloudSavedAt = 0;
let cloudSyncError = false;

const allCells = () => document.querySelectorAll('.sudoku-cell');
const isEditable = cell => !cell.classList.contains('fixed') && !cell.classList.contains('hinted');
const progressStorageKey = () => {
    const userId = window.SudokuAuth?.getUserId?.();
    return userId ? `${PROGRESS_KEY}:${userId}` : PROGRESS_KEY;
};


function getBoard() {
    return [...allCells()].map(c => (c.innerText === '' ? 0 : parseInt(c.innerText)));
}

async function startGame(difficulty, savedProgress = null) {
    const requestId = ++gameRequestId;
    clearTimeout(cloudSaveTimeout);
    cloudSaveTimeout = null;
    clearInterval(timerInterval);
    seconds = savedProgress ? savedProgress.seconds : 0;
    isGameOver = false;
    currentDifficulty = difficulty;
    currentGameId = savedProgress?.gameId || null;
    rankedGame = Boolean(savedProgress?.ranked && currentGameId);
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

    if (rankedGame && currentGameId && !assistedGame) {
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
    const progress = {
        version: 1,
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
    queueCloudSave();
}

function queueCloudSave() {
    const auth = window.SudokuAuth;
    if (!auth?.isSignedIn() || cloudSaveTimeout !== null || isGameOver) return;
    const delay = Math.max(0, 10000 - (Date.now() - cloudSavedAt));
    cloudSaveTimeout = setTimeout(() => {
        cloudSaveTimeout = null;
        cloudSavedAt = Date.now();
        const progress = readSavedProgress();
        if (!progress || isGameOver) return;
        cloudSyncQueue = cloudSyncQueue.then(() => auth.saveProgress(progress)).then(() => {
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
    }, delay);
}

function clearCloudProgress() {
    clearTimeout(cloudSaveTimeout);
    cloudSaveTimeout = null;
    if (!window.SudokuAuth?.isSignedIn()) return;
    const auth = window.SudokuAuth;
    cloudSyncQueue = cloudSyncQueue.then(() => auth.clearProgress()).catch(error => {
        console.error('Could not clear cloud Sudoku progress:', error);
        saveNote.textContent = 'Игра завершена, но не удалось очистить облачный сейв.';
        saveNote.classList.remove('is-saved');
    });
}

function clearSavedProgress() {
    try {
        localStorage.removeItem(progressStorageKey());
    } catch (error) {
        console.error('Could not clear saved Sudoku progress:', error);
    }
}

function readSavedProgress() {
    try {
        const raw = localStorage.getItem(progressStorageKey());
        if (!raw) return null;
        const progress = JSON.parse(raw);
        if (!isValidProgress(progress)) {
            clearSavedProgress();
            return null;
        }
        return progress;
    } catch (error) {
        console.error('Could not read saved Sudoku progress:', error);
        clearSavedProgress();
        return null;
    }
}

function isValidProgress(progress) {
    if (!progress || typeof progress !== 'object') return false;
    const validDifficulty = ['easy', 'medium', 'hard'].includes(progress.difficulty);
    const validBoards = [progress.puzzle, progress.solution, progress.board]
        .every(board => Array.isArray(board) && board.length === 81 &&
            board.every(value => Number.isInteger(value) && value >= 0 && value <= 9));
    return progress.version === 1 && validDifficulty && validBoards &&
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
    const localProgress = readSavedProgress();
    if (!auth?.loadProgress) return localProgress;

    try {
        const cloudProgress = await auth.loadProgress();
        if (cloudProgress) {
            const candidate = { ...cloudProgress, version: 1 };
            if (isValidProgress(candidate)) {
                const localTime = Number(localProgress?.savedAt) || 0;
                const cloudTime = Number(candidate.savedAt) || 0;
                return cloudTime > localTime ? candidate : localProgress;
            }
            console.error('Ignoring invalid cloud Sudoku progress.');
        }
    } catch (error) {
        console.error('Could not load cloud Sudoku progress:', error);
        saveNote.textContent = 'Не удалось загрузить облачный сейв. Проверяем локальное сохранение…';
    }
    return localProgress;
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
window.addEventListener('load', async () => {
    const progress = await loadBestProgress();
    if (progress) {
        await startGame(progress.difficulty, progress);
        saveNote.textContent = 'Продолжили сохранённую игру с этого устройства.';
        saveNote.classList.add('is-saved');
    } else {
        await startGame('easy');
    }
});
