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
            if (this.classList.contains('fixed')) return;
            
            document.querySelectorAll('.sudoku-cell').forEach(c => c.classList.remove('highlight'));
            this.classList.add('highlight');
            selectedCell = this;
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
}

function checkCell(cell) {
    cell.classList.remove('correct', 'wrong', 'hinted');
    if (cell.innerText === '') return;

    const index = parseInt(cell.dataset.index);
    const correctValue = currentSolution[index];
    const currentValue = cell.innerText;
    let isCorrectValue = (currentValue === correctValue);
    const row = Math.floor(index / 9);
    const col = index % 9;
    let isDuplicate = false;
    const cells = document.querySelectorAll('.sudoku-cell');

    for (let i = 0; i < 81; i++) {
        if (i === index) continue; 
        if ((Math.floor(i / 9) === row || i % 9 === col) && cells[i].innerText === currentValue) {
            isDuplicate = true;
            break;
        }
    }

    if (isCorrectValue && !isDuplicate) cell.classList.add('correct');
    else cell.classList.add('wrong');
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
    let currentBoard = "";
    for (let i = 0; i < cells.length; i++) currentBoard += cells[i].innerText || "0";

    const messageEl = document.getElementById('message');
    if (currentBoard === currentSolution) {
        messageEl.innerText = `🎉 Победа! Время: ${document.getElementById('timer').innerText}`;
        messageEl.style.color = "#4CAF50";
        isGameOver = true;
        clearInterval(timerInterval);
    } else {
        messageEl.innerText = "❌ Есть ошибки или пустые клетки!";
        messageEl.style.color = "#ff3333";
    }
}

window.onload = () => startGame('easy');