// Меняй текст загадок, принимаемые ответы и картинки в этом списке.
const SITE_SECRETS = [
    {
        clue: 'Головоломка с цифрами',
        answers: ['судоку', 'sudoku'],
        image: 'images/Без названия (9).jpg',
        alt: 'Сабрина',
        slot: 'secret-slot-sudoku',
        activation: 'logo'
    },
    {
        clue: 'Мой зеленый телефон название',
        answers: ['realme 11 pro plus с 4х кратным зумом без потери качества', 'realme 11 pro plus с 4-х кратным зумом без потери качества'],
        image: 'images/Без названия (12).jpg',
        alt: 'Залётная',
        slot: 'secret-slot-phone',
        activation: 'phone-spin'
    },
    {
        clue: 'Что вращается рядом с любимыми треками и хранит музыку в дорожках?',
        answers: ['винил', 'vinil', 'виниловая пластинка'],
        image: 'images/max mayfield.jpg',
        alt: 'Макс Мэйфилд',
        slot: 'secret-slot-vinyl',
        activation: 'jump'
    },
    {
        clue: 'Favorite Actress',
        answers: ['Hande', 'Sabrina', 'Jenna', 'Ханде', 'Сабрина', 'Дженна'],
        image: 'images/Jenna Ortega_.jpg',
        alt: 'Дженна Ортега',
        slot: 'secret-slot-actress',
        activation: 'doge-triple-click'
    },
    {
        clue: 'Моё первое выученное слово на испанском? (после Hola конечно же)',
        answers: ['cono', 'коньо'],
        image: 'images/Hande Erçel.jpg',
        alt: 'Ханде Эрчел',
        slot: 'secret-slot-spanish',
        activation: 'type-hola'
    }
];

const NAGIEV_IMAGE = 'images/secret.jpg';
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
    const modalImage = document.getElementById('secret-modal-image');
    const modalTitle = document.getElementById('secret-title');
    const modalKicker = document.getElementById('secret-kicker');
    if (!trigger || !modal || !closeButton || !modalImage || !modalTitle || !modalKicker) return;

    let clickCount = 0;
    let modalReturnFocus = trigger;
    const revealedSecrets = new Set();

    const closeModal = () => {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        modalReturnFocus.focus();
    };

    const openImageModal = (image, alt, title, kicker, returnFocus) => {
        modalImage.src = image;
        modalImage.alt = alt;
        modalTitle.textContent = title;
        modalKicker.textContent = kicker;
        closeButton.setAttribute('aria-label', `Закрыть: ${title}`);
        modalReturnFocus = returnFocus;
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        closeButton.focus();
    };

    const revealSecret = index => {
        if (revealedSecrets.has(index)) return;

        const secret = SITE_SECRETS[index];
        const slot = document.getElementById(secret.slot);
        if (!slot) {
            console.error(`Missing secret location: #${secret.slot}`);
            return;
        }

        slot.innerHTML = `
            <article id="secret-puzzle-${index}" class="secret-puzzle is-unlocked" data-secret="${index}">
                <p class="secret-clue">${escapeSecretHtml(secret.clue)}</p>
                <form class="secret-answer-form">
                    <label for="secret-answer-${index}">Ответ</label>
                    <div class="secret-answer-row">
                        <input id="secret-answer-${index}" name="answer" type="text" autocomplete="off" required>
                        <button type="submit">Ответить</button>
                    </div>
                    <p class="secret-feedback" role="status" aria-live="polite"></p>
                </form>
                <div class="secret-puzzle-image" hidden>
                    <button class="secret-image-button" type="button" aria-label="Открыть картинку «${escapeSecretHtml(secret.alt)}»">
                        <img src="${escapeSecretHtml(secret.image)}" alt="${escapeSecretHtml(secret.alt)}" loading="lazy" decoding="async">
                    </button>
                </div>
            </article>`;
        revealedSecrets.add(index);
        slot.classList.add('is-unlocked');
        slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => slot.classList.remove('is-unlocked'), 1800);

        const form = slot.querySelector('.secret-answer-form');
        const puzzle = slot.querySelector('.secret-puzzle');
        const imageButton = slot.querySelector('.secret-image-button');

        form.addEventListener('submit', event => {
            event.preventDefault();
            const input = form.elements.answer;
            const feedback = form.querySelector('.secret-feedback');

            if (puzzle.classList.contains('is-solved')) return;

            const answer = normalizeSecretAnswer(input.value);
            const isCorrect = secret.answers.some(candidate => normalizeSecretAnswer(candidate) === answer);
            if (!isCorrect) {
                feedback.textContent = 'Пока не угадал — попробуй ещё раз.';
                input.setAttribute('aria-invalid', 'true');
                return;
            }

            puzzle.classList.add('is-solved');
            form.querySelectorAll('input, button').forEach(control => { control.disabled = true; });
            feedback.textContent = 'Верно! Картинка открыта.';
            puzzle.querySelector('.secret-puzzle-image').hidden = false;
        });

        imageButton.addEventListener('click', () => {
            openImageModal(secret.image, secret.alt, secret.alt, 'СЕКРЕТ ОТКРЫТ', imageButton);
        });

        form.elements.answer.addEventListener('input', event => {
            event.currentTarget.removeAttribute('aria-invalid');
            form.querySelector('.secret-feedback').textContent = '';
        });
    };

    const activationIndex = activation => SITE_SECRETS.findIndex(secret => secret.activation === activation);
    const revealByActivation = activation => {
        const index = activationIndex(activation);
        if (index < 0) {
            console.error(`Missing secret activation: ${activation}`);
            return;
        }
        revealSecret(index);
    };

    document.querySelector('.logo-core')?.addEventListener('click', () => revealByActivation('logo'));

    const phoneModel = document.querySelector('model-viewer');
    if (phoneModel) {
        let activePointerId = null;
        let previousAngle = 0;
        let accumulatedRotation = 0;

        const stopPhoneRotation = event => {
            if (activePointerId === null || event.pointerId !== activePointerId) return;
            activePointerId = null;
            document.removeEventListener('pointermove', trackPhoneRotation);
            document.removeEventListener('pointerup', stopPhoneRotation);
            document.removeEventListener('pointercancel', stopPhoneRotation);
        };

        const trackPhoneRotation = event => {
            if (event.pointerId !== activePointerId) return;
            const bounds = phoneModel.getBoundingClientRect();
            const dx = event.clientX - (bounds.left + bounds.width / 2);
            const dy = event.clientY - (bounds.top + bounds.height / 2);
            if (Math.hypot(dx, dy) < 24) return;

            const angle = Math.atan2(dy, dx);
            let change = angle - previousAngle;
            if (change > Math.PI) change -= Math.PI * 2;
            if (change < -Math.PI) change += Math.PI * 2;
            previousAngle = angle;
            accumulatedRotation += change;

            if (Math.abs(accumulatedRotation) >= Math.PI * 6) {
                stopPhoneRotation(event);
                revealByActivation('phone-spin');
            }
        };

        phoneModel.addEventListener('pointerdown', event => {
            activePointerId = event.pointerId;
            const bounds = phoneModel.getBoundingClientRect();
            previousAngle = Math.atan2(
                event.clientY - (bounds.top + bounds.height / 2),
                event.clientX - (bounds.left + bounds.width / 2)
            );
            accumulatedRotation = 0;
            document.addEventListener('pointermove', trackPhoneRotation);
            document.addEventListener('pointerup', stopPhoneRotation);
            document.addEventListener('pointercancel', stopPhoneRotation);
        });
    } else {
        console.error('Missing phone model for the rotation secret');
    }

    let jumps = 0;
    let jumpTimer;
    document.addEventListener('keydown', event => {
        if (event.code !== 'Space' || event.repeat || modal.classList.contains('show')) return;
        if (event.target instanceof Element && event.target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;

        jumps += 1;
        window.clearTimeout(jumpTimer);
        if (jumps === 3) {
            jumps = 0;
            revealByActivation('jump');
        } else {
            jumpTimer = window.setTimeout(() => { jumps = 0; }, 1200);
        }
    });

    const doge = document.querySelector('.offplay-meme-list img:nth-child(2)');
    if (doge) {
        let dogeClicks = 0;
        let dogeClickTimer;
        doge.addEventListener('click', () => {
            dogeClicks += 1;
            window.clearTimeout(dogeClickTimer);
            if (dogeClicks === 3) {
                dogeClicks = 0;
                revealByActivation('doge-triple-click');
            } else {
                dogeClickTimer = window.setTimeout(() => { dogeClicks = 0; }, 1200);
            }
        });
    } else {
        console.error('Missing meme image for the triple-click secret');
    }

    let typedCharacters = '';
    document.addEventListener('keydown', event => {
        if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey || modal.classList.contains('show')) return;
        if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;

        typedCharacters = (typedCharacters + event.key.toLocaleLowerCase('ru')).slice(-4);
        if (typedCharacters === 'hola') {
            typedCharacters = '';
            revealByActivation('type-hola');
        }
    });

    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('aria-label', 'Hola! Нажми пять раз, чтобы открыть секрет с Нагиевым');
    trigger.addEventListener('click', () => {
        clickCount += 1;
        if (clickCount === 5) {
            clickCount = 0;
            openImageModal(NAGIEV_IMAGE, 'Дмитрий Нагиев: «Спи»', 'Нагиев на месте', 'ПЯТЬ КЛИКОВ — И...', trigger);
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
