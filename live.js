// ===== НАСТРОЙКИ (заполни свои) =====
const LIVE = {
    statsfmUser: '31zampzx6vdwi7qqah3yttplww2q',   // ник или customId из ссылки на твой профиль stats.fm
    // Любимые треки (показываются первые 3). Меняй прямо здесь:
    //   title  — название, artist — исполнитель,
    //   cover  — картинка (ссылка или файл из репозитория, например 'covers/1.jpg'), можно оставить '',
    //   link   — ссылка на трек (можно оставить '')
    favorites: [
        { title: 'Блондинка', artist: 'GSPD', cover: '', link: 'https://open.spotify.com/track/50IKCZwA8w4mON9FDDkciA?si=4a1883c281834593' },
        { title: 'Мементо Мори', artist: 'ксюшенька.', cover: '', link: 'https://music.yandex.com/album/40513185/track/147876905?utm_source=web&utm_medium=copy_link' },
        { title: 'SOLO', artist: 'lightprey', cover: '', link: 'https://open.spotify.com/track/484u1CQG998X0poznDaSHM?si=f433fe56c84a4b91' }
    ],
    refreshSec: 30                       // как часто обновлять «Сейчас играет»
};

// ===== помощники =====
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = m => {
    const h = Math.floor(m / 60), mm = m % 60;
    return h ? `${h}<small>ч</small> ${mm}<small>м</small>` : `${mm}<small>м</small>`;
};
const fmtMs = ms => fmt(Math.round(ms / 60000));
const plural = (n, f) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return f[2];
    if (b > 1 && b < 5) return f[1];
    if (b === 1) return f[0];
    return f[2];
};
const tracksWord = n => `${n} ${plural(n, ['трек', 'трека', 'треков'])}`;

const API = 'https://api.stats.fm/api/v1/users/';
async function sfm(path, params = {}) {
    const q = new URLSearchParams(params);
    const r = await fetch(`${API}${encodeURIComponent(LIVE.statsfmUser)}${path}?${q}`);
    if (r.status === 404 && path === '/streams/current') return null;      // ничего не играет
    if (r.status === 403) throw new Error('профиль закрыт: включи публичность в настройках stats.fm');
    if (r.status === 404) throw new Error('пользователь не найден, проверь ник');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
}
const coverOf = t => {
    const url = t && t.albums && t.albums[0] && t.albums[0].image;
    return url ? `<img src="${esc(url)}" alt="">` : '<div class="live-cover-empty">♪</div>';
};
const artistsOf = t => (t.artists || []).map(a => a.name).join(', ');
const errorBox = e => `<p class="live-muted">Не удалось загрузить: ${esc(e.message)}</p>`;

// ===== загрузчики =====
async function loadNow() {
    const box = $('live-now');
    try {
        const d = await sfm('/streams/current');
        const it = d && d.item;
        const t = it && it.track;
        if (t && it.isPlaying !== false) {
            box.innerHTML = `
                <div class="live-cover">${coverOf(t)}</div>
                <div class="live-big">${esc(t.name)}</div>
                <div class="live-muted">${esc(artistsOf(t))}</div>`;
        } else {
            box.innerHTML = `
                <div class="live-cover"><div class="live-cover-empty">🔇</div></div>
                <div class="live-big">Тишина</div>
                <div class="live-muted">Сейчас ничего не играет</div>`;
        }
    } catch (e) { box.innerHTML = errorBox(e); }
}

function loadFavorites() {
    $('live-fav').innerHTML = LIVE.favorites.slice(0, 3).map((t, i) => {
        const cover = t.cover ? `<img src="${esc(t.cover)}" alt="">` : '<div class="live-cover-empty">♪</div>';
        const inner = `
            <span class="live-rank">${i + 1}</span>
            <div class="live-mini">${cover}</div>
            <div class="live-track-info">
                <div class="live-track-name">${esc(t.title)}</div>
                <div class="live-muted">${esc(t.artist)}</div>
            </div>
            ${t.link ? '<span class="live-count">↗</span>' : ''}`;
        return t.link
            ? `<a class="live-track" href="${esc(t.link)}" target="_blank" rel="noopener">${inner}</a>`
            : `<div class="live-track">${inner}</div>`;
    }).join('');
}

async function rangeStats(afterMs) {
    const d = await sfm('/streams/stats', { after: afterMs, before: Date.now() });
    const i = d.items || d;
    return { ms: i.durationMs || 0, count: i.count || 0 };
}

async function loadMusic() {
    const box = $('live-music');
    try {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const [today, month] = await Promise.all([
            rangeStats(start.getTime()),
            rangeStats(Date.now() - 30 * 86400000)
        ]);
        const item = (label, ms, count) => `<div class="live-stat"><span class="live-label">${label}</span><span class="live-num">${fmtMs(ms)}</span><span class="live-sub">${tracksWord(count)}</span></div>`;
        box.innerHTML =
            item('Сегодня', today.ms, today.count) +
            item('За 30 дней', month.ms, month.count) +
            item('В среднем за день', month.ms / 30, Math.round(month.count / 30));
    } catch (e) { box.innerHTML = errorBox(e); }
}

async function loadTop() {
    const box = $('live-top');
    try {
        const d = await sfm('/top/tracks', { range: 'weeks', limit: 6 });
        const list = (d.items || []).slice(0, 6);
        box.innerHTML = list.map((x, i) => {
            const t = x.track || {};
            const n = x.streams ?? x.count ?? 0;
            return `
            <div class="live-track">
                <span class="live-rank">${i + 1}</span>
                <div class="live-mini">${coverOf(t)}</div>
                <div class="live-track-info">
                    <div class="live-track-name">${esc(t.name)}</div>
                    <div class="live-muted">${esc(artistsOf(t))}</div>
                </div>
                <span class="live-count">${n} ${plural(n, ['раз', 'раза', 'раз'])}</span>
            </div>`;
        }).join('') || '<p class="live-muted">Пока пусто</p>';
    } catch (e) { box.innerHTML = errorBox(e); }
}

// ===== сборка блока =====
function buildLive() {
    const root = $('live-root');
    if (!root) return;
    const head = (title, fn) => `<div class="live-head"><span>${title}</span>${fn ? `<button class="live-refresh" data-fn="${fn}" title="Обновить">↻</button>` : ''}</div>`;
    root.innerHTML = `
        <section class="live-section">
            <h2 class="section-title"><span class="section-num">02</span> Live</h2>
            <div class="live-grid">
                <div class="live-card">${head('Сейчас играет', 'loadNow')}<div id="live-now" class="live-now"></div></div>
                <div class="live-card">${head('Любимые треки')}<div id="live-fav" class="live-fav"></div></div>
                <div class="live-card live-wide">${head('Музыка', 'loadMusic')}<div id="live-music" class="live-stats three"></div></div>
                <div class="live-card live-wide">${head('Топ треков (4 недели)', 'loadTop')}<div id="live-top" class="live-top"></div></div>
            </div>
        </section>`;
    const fns = { loadNow, loadMusic, loadTop };
    root.querySelectorAll('.live-refresh').forEach(b => b.addEventListener('click', () => fns[b.dataset.fn]()));
    loadNow(); loadFavorites(); loadMusic(); loadTop();
    setInterval(loadNow, LIVE.refreshSec * 1000);
}
document.addEventListener('DOMContentLoaded', buildLive);
