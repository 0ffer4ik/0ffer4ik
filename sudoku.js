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

function startGame(difficulty) {
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
        input.dataset.index = i; // Запоминаем индекс клетки (от 0 до 80)
        
        // Ограничиваем ввод и обновляем статистику при вводе
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^1-9]/g, '');
            checkCell(this); // Проверяем конкретную клетку
            updateStats();   // Обновляем счетчик
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
    
    updateStats(); // Первичный подсчет при старте
}

// Функция проверки ОДНОЙ клетки (для подсветки)
function checkCell(input) {
    input.classList.remove('correct', 'wrong'); // Сбрасываем старые цвета
    
    if (input.classList.contains('fixed') || input.value === '') {
        return; // Если клетка изначально задана или пуста — ничего не делаем
    }

    const index = parseInt(input.dataset.index);
    const correctValue = currentSolution[index];

    if (input.value === correctValue) {
        input.classList.add('correct');
    } else {
        input.classList.add('wrong');
    }
}

// Функция подсчета статистики
function updateStats() {
    const inputs = document.querySelectorAll('.sudoku-cell');
    let remain = 0;
    let correct = 0;
    let wrong = 0;

    inputs.forEach(input => {
        // Считаем, сколько пустых (не считая изначально заданные)
        if (input.value === '' && !input.classList.contains('fixed')) {
            remain++;
        } 
        // Считаем верные и неверные (только для тех, что не были заданы изначально)
        else if (!input.classList.contains('fixed') && input.value !== '') {
            const index = parseInt(input.dataset.index);
            if (input.value === currentSolution[index]) {
                correct++;
            } else {
                wrong++;
            }
        }
    });

    // Обновляем цифры на экране
    document.getElementById('stat-remain').innerText = remain;
    document.getElementById('stat-correct').innerText = correct;
    document.getElementById('stat-wrong').innerText = wrong;
}

// Функция финальной проверки (кнопка)
function checkSolution() {
    const inputs = document.querySelectorAll('.sudoku-cell');
    let currentBoard = "";
    
    for (let i = 0; i < inputs.length; i++) {
        currentBoard += inputs[i].value || "0";
    }

    const messageEl = document.getElementById('message');

    if (currentBoard === currentSolution) {
        messageEl.innerText = "🎉 Победа! Ты решил судоку!";
        messageEl.style.color = "#4CAF50";
    } else {
        messageEl.innerText = "❌ Пока есть пустые клетки или ошибки, попробуй еще!";
        messageEl.style.color = "#ff4d4d";
    }
}

// Запускаем легкий уровень при загрузке страницы
window.onload = () => startGame('easy');