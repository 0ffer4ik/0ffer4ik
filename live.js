// ===== НАСТРОЙКИ (заполни свои) =====
const LIVE = {
    lastfmUser: 'ТВОЙ_НИК_В_LASTFM',
    lastfmKey:  'ТВОЙ_API_KEY',      // бесплатно: https://www.last.fm/api/account/create
    // Telegram автоматически получить нельзя, поэтому значения в МИНУТАХ вводишь сам:
    telegram: { today: 155, week: 1590, month: 4443, avg: 412 },
    refreshSec: 30                   // как часто обновлять «Сейчас играет»
};

// ===== помощники =====
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = m => {
    const h = Math.floor(m / 60), mm = m % 60;
    return h ? `${h}<small>ч</small> ${mm}<small>м</small>` : `${mm}<small>м</small>`;
};
const plural = (n, f) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return f[2];
    if (b > 1 && b < 5) return f[1];
    if (b === 1) return f[0];
    return f[2];
};
const tracksWord = n => `${n} ${plural(n, ['трек', 'трека', 'треков'])}`;
const PLACEHOLDER = '2a96cbd8b46e442fc41c2b86b821562f'; // «пустая» картинка Last.fm

async function lfm(method, params = {}) {
    const q = new URLSearchParams({ method, user: LIVE.lastfmUser, api_key: LIVE.lastfmKey, format: 'json', ...params });
    const r = await fetch('https://ws.audioscrobbler.com/2.0/?' + q);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (d.error) throw new Error(d.message);
    return d;
}
const coverOf = t => {
    const url = (t.image || []).slice().reverse().map(i => i['#text']).find(u => u && !u.includes(PLACEHOLDER));
    return url ? `<img src="${esc(url)}" alt="">` : '<div class="live-cover-empty">♪</div>';
};
const errorBox = e => `<p class="live-muted">Не удалось загрузить: ${esc(e.message)}</p>`;

// ===== загрузчики =====
async function loadNow() {
    const box = $('live-now');
    try {
        const d = await lfm('user.getRecentTracks', { limit: 1 });
        let t = d.recenttracks.track;
        t = Array.isArray(t) ? t[0] : t;
        const playing = t && t['@attr'] && t['@attr'].nowplaying === 'true';
        if (playing) {
            box.innerHTML = `
                <div class="live-cover">${coverOf(t)}</div>
                <div class="live-big">${esc(t.name)}</div>
                <div class="live-muted">${esc(t.artist['#text'] || t.artist.name)}</div>`;
        } else {
            box.innerHTML = `
                <div class="live-cover"><div class="live-cover-empty">🔇</div></div>
                <div class="live-big">Тишина</div>
                <div class="live-muted">Сейчас ничего не играет</div>`;
        }
    } catch (e) { box.innerHTML = errorBox(e); }
}

function loadTelegram() {
    const t = LIVE.telegram;
    const item = (label, m) => `<div class="live-stat"><span class="live-label">${label}</span><span class="live-num">${fmt(m)}</span></div>`;
    $('live-tg').innerHTML = item('Сегодня', t.today) + item('За неделю', t.week) + item('За месяц', t.month) + item('В среднем за день', t.avg);
}

async function loadMusic() {
    const box = $('live-music');
    try {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const day = Math.floor(start.getTime() / 1000);
        const month = Math.floor(Date.now() / 1000) - 30 * 86400;
        const [a, b] = await Promise.all([
            lfm('user.getRecentTracks', { limit: 1, from: day }),
            lfm('user.getRecentTracks', { limit: 1, from: month })
        ]);
        const today = parseInt(a.recenttracks['@attr'].total);
        const mon = parseInt(b.recenttracks['@attr'].total);
        const avg = Math.round(mon / 30);
        const item = (label, n) => `<div class="live-stat"><span class="live-label">${label}</span><span class="live-num">${n}</span><span class="live-sub">${plural(n, ['прослушивание', 'прослушивания', 'прослушиваний'])}</span></div>`;
        box.innerHTML = item('Сегодня', today) + item('За 30 дней', mon) + item('В среднем за день', avg);
    } catch (e) { box.innerHTML = errorBox(e); }
}

async function loadTop() {
    const box = $('live-top');
    try {
        const d = await lfm('user.getTopTracks', { period: '1month', limit: 6 });
        const list = d.toptracks.track || [];
        box.innerHTML = list.map((t, i) => `
            <div class="live-track">
                <span class="live-rank">${i + 1}</span>
                <div class="live-mini">${coverOf(t)}</div>
                <div class="live-track-info">
                    <div class="live-track-name">${esc(t.name)}</div>
                    <div class="live-muted">${esc(t.artist.name)}</div>
                </div>
                <span class="live-count">${esc(t.playcount)} ${plural(parseInt(t.playcount), ['раз', 'раза', 'раз'])}</span>
            </div>`).join('') || '<p class="live-muted">Пока пусто</p>';
    } catch (e) { box.innerHTML = errorBox(e); }
}

// ===== сборка блока =====
function buildLive() {
    const root = $('live-root');
    if (!root) return;
    const head = (title, fn) => `<div class="live-head"><span>${title}</span><button class="live-refresh" data-fn="${fn}" title="Обновить">↻</button></div>`;
    root.innerHTML = `
        <section class="live-section">
            <h2 class="section-title"><span class="section-num">02</span> Live</h2>
            <div class="live-grid">
                <div class="live-card">${head('Сейчас играет', 'loadNow')}<div id="live-now" class="live-now"></div></div>
                <div class="live-card">${head('Telegram', 'loadTelegram')}<div id="live-tg" class="live-stats two"></div></div>
                <div class="live-card live-wide">${head('Музыка', 'loadMusic')}<div id="live-music" class="live-stats three"></div></div>
                <div class="live-card live-wide">${head('Топ треков (30 дней)', 'loadTop')}<div id="live-top" class="live-top"></div></div>
            </div>
        </section>`;
    const fns = { loadNow, loadTelegram, loadMusic, loadTop };
    root.querySelectorAll('.live-refresh').forEach(b => b.addEventListener('click', () => fns[b.dataset.fn]()));
    loadNow(); loadTelegram(); loadMusic(); loadTop();
    setInterval(loadNow, LIVE.refreshSec * 1000);
}
document.addEventListener('DOMContentLoaded', buildLive);
