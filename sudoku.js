let solution = [];         
let selectedCell = null;
let timerInterval;
let seconds = 0;
let isGameOver = false;

const allCells = () => document.querySelectorAll('.sudoku-cell');
const isEditable = cell => !cell.classList.contains('fixed') && !cell.classList.contains('hinted');


function getBoard() {
    return [...allCells()].map(c => (c.innerText === '' ? 0 : parseInt(c.innerText)));
}

function startGame(difficulty) {
    clearInterval(timerInterval);
    seconds = 0;
    isGameOver = false;
    document.getElementById('timer').innerText = '00:00';
    document.getElementById('message').innerText = '';

    const board = document.getElementById('sudoku-board');
    board.innerHTML = '';
    selectedCell = null;

    const data = Sudoku.generate(difficulty);  
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

    timerInterval = setInterval(updateTimer, 1000);
    updateStats();
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
}

function giveHint() {
    if (isGameOver) return;
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
    messageEl.style.color = '#ff3333';
    updateStats();
    finishIfSolved();
}

function solveGame() {
    if (isGameOver) return;
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
    updateStats();
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

window.onload = () => startGame('easy');
