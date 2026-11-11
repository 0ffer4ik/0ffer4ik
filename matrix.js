const canvas = document.getElementById('matrix-canvas');
const ctx = canvas.getContext('2d');
const toggleBtn = document.getElementById('matrix-toggle');

let isMatrixOn = true;
let intervalId;

// Делаем холст на весь экран
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Символы (катые, иероглифы, цифры)
const chars = "アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレゲゼデベペオォコソトノホモヨョロゴゾドボポヴ0123456789ABCDEF";
const fontSize = 16;
let columns = canvas.width / fontSize;
let drops = [];

// Заполняем капли
for (let x = 0; x < columns; x++) {
    drops[x] = 1;
}

function drawMatrix() {
    // Полупрозрачный черный фон, чтобы символы оставляли шлейф
    ctx.fillStyle = "rgba(10, 5, 5, 0.1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ff0000"; // Красный цвет символов
    ctx.font = fontSize + "px monospace";

    for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        // Случайный сброс капли наверх
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
        }
        drops[i]++;
    }
}

// Управление
function startMatrix() {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(drawMatrix, 80); // ~30 кадров в секунду
    isMatrixOn = true;
    toggleBtn.innerText = "Выключить Матрицу";
    canvas.style.opacity = "0.3"; // Делаем эффект полупрозрачным, чтобы не мешал читать
}

function stopMatrix() {
    clearInterval(intervalId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    isMatrixOn = false;
    toggleBtn.innerText = "Включить Матрицу";
}

toggleBtn.addEventListener('click', () => {
    if (isMatrixOn) stopMatrix();
    else startMatrix();
});

// Автозапуск
startMatrix();