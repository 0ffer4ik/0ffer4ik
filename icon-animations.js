const CLICK_SPIN_SELECTOR = [
    '.top-right-icon',
    '.close-icon',
    '.guestbook-action svg',
    '.contact-icon',
    '.live-refresh-icon',
    '.live-cover-empty',
    '.steam-avatar-fallback',
    '.sudoku-icon',
    '#profile-trigger-avatar',
    '.streak-icon'
].join(',');

const ICON_CONTROL_TARGETS = [
    ['.top-right-btn', '.top-right-icon'],
    ['.close-btn', '.close-icon'],
    ['.contact-card', '.contact-icon'],
    ['.guestbook-action', 'svg'],
    ['.live-refresh', '.live-refresh-icon'],
    ['.back-btn', '.sudoku-icon'],
    ['.profile-trigger', '#profile-trigger-avatar'],
    ['.profile-close', '.sudoku-icon'],
    ['.btn-action', '.sudoku-icon'],
    ['.erase-btn', '.sudoku-icon'],
    ['.daily-streak-card', '.streak-icon']
];

document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;

    let icon = event.target.closest(CLICK_SPIN_SELECTOR);
    if (!icon) {
        for (const [controlSelector, iconSelector] of ICON_CONTROL_TARGETS) {
            const control = event.target.closest(controlSelector);
            if (!control) continue;
            icon = control.querySelector(iconSelector);
            if (icon) break;
        }
    }

    if (!icon) return;
    icon.classList.remove('icon-spin-on-click');
    void icon.offsetWidth;
    icon.classList.add('icon-spin-on-click');
}, true);

document.addEventListener('animationend', event => {
    if (event.animationName !== 'icon-click-spin' || !(event.target instanceof Element)) return;
    event.target.classList.remove('icon-spin-on-click');
});
