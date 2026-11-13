// Меняй текст загадок, принимаемые ответы и картинки в этом списке.
const SITE_SECRETS = [
    {
        clue: 'Какая головоломка с числами 1–9 открывается кнопкой вверху страницы?',
        answers: ['судоку', 'sudoku'],
        image: 'images/Без названия (9).jpg',
        alt: 'Пиксельный смайлик'
    },
    {
        clue: 'Как называется телефон с S Pen и камерой на 200 МП?',
        answers: ['s24 ultra', 'galaxy s24 ultra', 'samsung galaxy s24 ultra'],
        image: 'images/Без названия (12).jpg',
        alt: 'Секретная фотография'
    },
    {
        clue: 'Что вращается рядом с любимыми треками и хранит музыку в дорожках?',
        answers: ['винил', 'пластинка', 'виниловая пластинка'],
        image: 'images/max mayfield.jpg',
        alt: 'Секретный мем'
    },
    {
        clue: 'В каком игровом сервисе можно увидеть, что сейчас запущен Wallpaper Engine?',
        answers: ['steam', 'стим'],
        image: 'images/Jenna Ortega_.jpg',
        alt: 'Мем с собакой Доге'
    },
    {
        clue: 'Какое испанское приветствие написано над терминалом?',
        answers: ['hola', 'ола'],
        image: 'images/Hande Erçel.jpg',
        alt: 'Мем с котом'
    }
];

const normalizeSecretAnswer = value => value.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');
const escapeSecretHtml = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[character]));

document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.getElementById('secret-trigger');
    const modal = document.getElementById('secret-modal');
    const closeButton = document.getElementById('close-secret');
    const list = document.getElementById('secret-list');
    const progress = document.getElementById('secret-progress');
    if (!trigger || !modal || !closeButton || !list || !progress) return;

    const solved = new Set();
    let clickCount = 0;

    const updateProgress = () => {
        progress.textContent = `Открыто секретов: ${solved.size} из ${SITE_SECRETS.length}`;
    };

    const closeModal = () => {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        trigger.focus();
    };

    list.innerHTML = SITE_SECRETS.map((secret, index) => `
        <article class="secret-card" data-secret="${index}">
            <h3>Секрет ${index + 1}</h3>
            <p class="secret-clue">${escapeSecretHtml(secret.clue)}</p>
            <form class="secret-answer-form">
                <label for="secret-answer-${index}">Твой ответ</label>
                <div class="secret-answer-row">
                    <input id="secret-answer-${index}" name="answer" type="text" autocomplete="off" required>
                    <button type="submit">Проверить</button>
                </div>
                <p class="secret-feedback" role="status" aria-live="polite"></p>
            </form>
            <div class="secret-reveal" hidden>
                <img src="${escapeSecretHtml(secret.image)}" alt="${escapeSecretHtml(secret.alt)}" loading="lazy" decoding="async">
            </div>
        </article>`).join('');
    updateProgress();

    list.querySelectorAll('.secret-answer-form').forEach(form => {
        form.addEventListener('submit', event => {
            event.preventDefault();
            const card = form.closest('.secret-card');
            const index = Number(card.dataset.secret);
            const secret = SITE_SECRETS[index];
            const input = form.elements.answer;
            const feedback = form.querySelector('.secret-feedback');

            if (solved.has(index)) return;

            const answer = normalizeSecretAnswer(input.value);
            const isCorrect = secret.answers.some(candidate => normalizeSecretAnswer(candidate) === answer);
            if (!isCorrect) {
                feedback.textContent = 'Пока не угадал — попробуй ещё раз.';
                input.setAttribute('aria-invalid', 'true');
                return;
            }

            solved.add(index);
            card.classList.add('is-solved');
            form.querySelectorAll('input, button').forEach(control => { control.disabled = true; });
            feedback.textContent = 'Верно! Картинка открыта.';
            card.querySelector('.secret-reveal').hidden = false;
            updateProgress();
        });

        form.elements.answer.addEventListener('input', event => {
            event.currentTarget.removeAttribute('aria-invalid');
            form.querySelector('.secret-feedback').textContent = '';
        });
    });

    const openModal = () => {
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        closeButton.focus();
    };

    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('aria-label', 'Hola! Нажми пять раз, чтобы открыть секреты');
    trigger.addEventListener('click', () => {
        clickCount += 1;
        if (clickCount === 5) {
            clickCount = 0;
            openModal();
        }
    });
    trigger.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            trigger.click();
        }
    });

    closeButton.addEventListener('click', closeModal);
    modal.addEventListener('click', event => {
        if (event.target === modal) closeModal();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && modal.classList.contains('show')) closeModal();
    });
});
