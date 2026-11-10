const puzzles = {
    easy: {
        start: "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
        solution: "534678912672195348198342567859761423426853791713924856961537284287419635345286179"
    },
    medium: {
        start: "000260701680070090190004500820100040004602900050003028009300074040050036703018000",
        solution: "435269781682571493197834562826195347374682915951743628519326874248957136763418259"
    },
    hard: {
        start: "000000907000420180000705026100904000050000040000507009920108000034059000507000000",
        solution: "483651927265429183719735426132984675856173249947562318921348765634597812578216394"
    }
};

let currentSolution = "";
let timerInterval;
let seconds = 0;

function startGame(difficulty) {
    // Сбрасываем и запускаем таймер заново
    clearInterval(timerInterval);
    seconds = 0;
    document.getElementById('timer').innerText = "00:00";
    timerInterval = setInterval(updateTimer, 1000);

    const board = document.getElementById('sudoku-board');
    board.innerHTML = ''; 
    document.getElementById('message').innerText = ''; 

    const puzzle = puzzles[difficulty].start;
    currentSolution = puzzles[difficulty].solution;

    for (let i = 0; i < 81; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 1;
        input.classList.add('sudoku-cell');
        input.dataset.index = i;
        
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^1-9]/g, '');
            checkCell(this);
            updateStats();
        });

        const value = puzzle[i];
        if (value !== '0') {
            input.value = value;
            input.readOnly = true;
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

// Функция для работы таймера
function updateTimer() {
    seconds++;
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    document.getElementById('timer').innerText = `${mins}:${secs}`;
}

function checkCell(input) {
    input.classList.remove('correct', 'wrong'); 
    if (input.classList.contains('fixed') || input.value === '') return;

    const index = parseInt(input.dataset.index);
    const correctValue = currentSolution[index];
    const currentValue = input.value;
    let isCorrectValue = (currentValue === correctValue);
    const row = Math.floor(index / 9);
    const col = index % 9;
    let isDuplicate = false;
    const inputs = document.querySelectorAll('.sudoku-cell');

    for (let i = 0; i < 81; i++) {
        if (i === index) continue; 
        if ((Math.floor(i / 9) === row || i % 9 === col) && inputs[i].value === currentValue) {
            isDuplicate = true;
            break;
        }
    }

    if (isCorrectValue && !isDuplicate) {
        input.classList.add('correct');
    } else {
        input.classList.add('wrong');
    }
}

function updateStats() {
    const inputs = document.querySelectorAll('.sudoku-cell');
    let remain = 0, correct = 0, wrong = 0;

    inputs.forEach(input => {
        if (input.value === '' && !input.classList.contains('fixed')) {
            remain++;
        } else if (!input.classList.contains('fixed') && input.value !== '') {
            if (input.classList.contains('correct')) correct++;
            else wrong++;
        }
    });

    document.getElementById('stat-remain').innerText = remain;
    document.getElementById('stat-correct').innerText = correct;
    document.getElementById('stat-wrong').innerText = wrong;
}

function checkSolution() {
    const inputs = document.querySelectorAll('.sudoku-cell');
    let currentBoard = "";
    for (let i = 0; i < inputs.length; i++) currentBoard += inputs[i].value || "0";

    const messageEl = document.getElementById('message');
    if (currentBoard === currentSolution) {
        messageEl.innerText = `🎉 Победа! Твое время: ${document.getElementById('timer').innerText}`;
        messageEl.style.color = "#4CAF50";
        clearInterval(timerInterval); // Останавливаем таймер при победе
    } else {
        messageEl.innerText = "❌ Пока есть пустые клетки или ошибки, попробуй еще!";
        messageEl.style.color = "#ff4d4d";
    }
}

window.onload = () => startGame('easy');