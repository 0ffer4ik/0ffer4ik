let currentSolution = "";
let selectedCell = null;
let timerInterval;
let seconds = 0;
let isGameOver = false;

function startGame(difficulty) {
    clearInterval(timerInterval);
    seconds = 0;
    isGameOver = false;
    document.getElementById('timer').innerText = "00:00";
    document.getElementById('message').innerText = "";
    timerInterval = setInterval(updateTimer, 1000);

    const board = document.getElementById('sudoku-board');
    board.innerHTML = ''; 
    selectedCell = null;

    const randomIndex = Math.floor(Math.random() * puzzles[difficulty].length);
    const puzzle = puzzles[difficulty][randomIndex].start;
    currentSolution = puzzles[difficulty][randomIndex].solution;

    for (let i = 0; i < 81; i++) {
        const input = document.createElement('div');
        input.classList.add('sudoku-cell');
        input.dataset.index = i;
        
        input.addEventListener('click', function() {
            if (isGameOver) return;
            selectCell(this);
        });

        const value = puzzle[i];
        if (value !== '0') {
            input.innerText = value;
            input.classList.add('fixed');
        }

        const row = Math.floor(i / 9);
        const col = i % 9;
        if ((col + 1) % 3 === 0 && col !== 8) input.classList.add('border-right');
        if ((row + 1) % 3 === 0 && row !== 8) input.classList.add('border-bottom');

        board.appendChild(input);
    }
    
    updateStats();
}

function selectCell(cell) {
    document.querySelectorAll('.sudoku-cell').forEach(c => {
        c.classList.remove('highlight', 'crosshair', 'same-num');
    });

    if (!cell || cell.classList.contains('fixed')) return;

    cell.classList.add('highlight');
    const val = cell.innerText;
    const index = parseInt(cell.dataset.index);
    const row = Math.floor(index / 9);
    const col = index % 9;

    document.querySelectorAll('.sudoku-cell').forEach((c, i) => {
        const r = Math.floor(i / 9);
        const cl = i % 9;

        if (r === row || cl === col) c.classList.add('crosshair');
        if (val !== '' && c.innerText === val) c.classList.add('same-num');
    });

    selectedCell = cell;
}

function inputNumber(num) {
    if (!selectedCell || isGameOver) return;
    
    if (num === 0) {
        selectedCell.innerText = '';
        selectedCell.classList.remove('correct', 'wrong', 'hinted');
    } else {
        selectedCell.innerText = num;
        checkCell(selectedCell);
    }
    updateStats();
    selectCell(selectedCell);
}

function checkCell(cell) {
    cell.classList.remove('correct', 'wrong', 'hinted');
    if (cell.innerText === '') return;

    const index = parseInt(cell.dataset.index);
    const correctValue = currentSolution[index];
    const currentValue = cell.innerText;

    if (currentValue === correctValue) {
        cell.classList.add('correct');
    } else {
        cell.classList.add('wrong');
    }
}

function updateStats() {
    const cells = document.querySelectorAll('.sudoku-cell');
    let remain = 0, correct = 0, wrong = 0;

    cells.forEach(cell => {
        if (cell.innerText === '' && !cell.classList.contains('fixed')) {
            remain++;
        } else if (!cell.classList.contains('fixed') && cell.innerText !== '') {
            if (cell.classList.contains('correct') || cell.classList.contains('hinted')) correct++;
            else wrong++;
        }
    });

    document.getElementById('stat-remain').innerText = remain;
    document.getElementById('stat-correct').innerText = correct;
    document.getElementById('stat-wrong').innerText = wrong;
}

function updateTimer() {
    seconds++;
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    document.getElementById('timer').innerText = `${mins}:${secs}`;
}

function giveHint() {
    if (isGameOver) return;
    const cells = document.querySelectorAll('.sudoku-cell');
    let emptyCells = [];
    
    cells.forEach(cell => {
        if (cell.innerText === '' || cell.classList.contains('wrong')) {
            emptyCells.push(cell);
        }
    });

    if (emptyCells.length > 0) {
        const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const index = parseInt(randomCell.dataset.index);
        randomCell.innerText = currentSolution[index];
        randomCell.classList.remove('wrong');
        randomCell.classList.add('hinted', 'fixed');
        updateStats();
    }
}

function checkSolution() {
    if (isGameOver) return;
    const cells = document.querySelectorAll('.sudoku-cell');
    let errors = 0;
    let empty = 0;

    cells.forEach(cell => {
        const index = parseInt(cell.dataset.index);
        if (cell.innerText === '') {
            empty++;
        } else if (!cell.classList.contains('fixed') && cell.innerText !== currentSolution[index]) {
            cell.classList.add('wrong');
            errors++;
        }
    });

    const messageEl = document.getElementById('message');
    if (empty === 0 && errors === 0) {
        messageEl.innerText = `🎉 Победа! Время: ${document.getElementById('timer').innerText}`;
        messageEl.style.color = "#4CAF50";
        isGameOver = true;
        clearInterval(timerInterval);
    } else {
        messageEl.innerText = `❌ Ошибок: ${errors} | Пустых: ${empty}`;
        messageEl.style.color = "#ff3333";
    }
}

function solveGame() {
    if (isGameOver) return;
    const cells = document.querySelectorAll('.sudoku-cell');
    cells.forEach((cell, index) => {
        if (!cell.classList.contains('fixed')) {
            cell.innerText = currentSolution[index];
            cell.classList.add('hinted');
        }
    });
    
    const messageEl = document.getElementById('message');
    messageEl.innerText = `🤖 Судоку решено!`;
    messageEl.style.color = "#00ffff";
    isGameOver = true;
    clearInterval(timerInterval);
    updateStats();
}

window.onload = () => startGame('easy');