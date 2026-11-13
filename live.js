// ===== НАСТРОЙКИ (заполни свои) =====
const LIVE = {
    statsfmUser: '31zampzx6vdwi7qqah3yttplww2q',   // ник или customId из ссылки на твой профиль stats.fm
    refreshSec: 30                       // как часто обновлять «Сейчас играет»
};

// Здесь можно менять любимые фильмы, Steam-профиль и пути к постерам и мемам.
const OFFPLAY_CONTENT = {
    // Если меняешь профиль, обнови vanityName в supabase/functions/steam-status/index.ts.
    steamProfile: 'https://steamcommunity.com/id/djxd_17/',
    // Положи локальные постеры в images/ и укажи пути к ним.
    movies: [
        {
            title: '1+1',
            imdbId: 'tt1675434',
            poster: 'https://www.film.ru/sites/default/files/movies/posters/1632369-341246.jpg'
        },
        {
            title: 'Гарри Поттер',
            imdbId: 'tt0241527',
            poster: 'https://www.film.ru/sites/default/files/movies/posters/1627991-298099.jpg'
        }
    ],
    // Меняй эти файлы в images/ — ссылки на картинки и alt-текст находятся здесь.
    memes: [
        { image: 'images/meme.jpg', alt: 'Пиксельный смайлик', pixelated: true },
        { image: 'images/meme-doge.jpg', alt: 'Мем с собакой Доге' },
        { image: 'images/meme-cat.jpg', alt: 'Мем с котом' }
    ]
};

// ===== помощники =====
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
                <div class="live-idle" role="status">
                    <div class="live-idle-visual" aria-hidden="true">
                        <span></span><span></span><span></span><span></span><span></span>
                    </div>
                    <span class="live-idle-label">ОЖИДАНИЕ ТРЕКА</span>
                    <div class="live-big">Сейчас тихо</div>
                    <div class="live-muted">Новый трек появится здесь автоматически</div>
                </div>`;
        }
    } catch (e) { box.innerHTML = errorBox(e); }
}

// Рисует полку по данным из favorite-tracks.js; меняй треки именно там.
function loadFavorites() {
    const favorites = window.FAVORITE_TRACKS;
    if (!Array.isArray(favorites)) {
        $('live-fav').innerHTML = errorBox(new Error('Не удалось загрузить список: проверь favorite-tracks.js'));
        return;
    }

    $('live-fav').innerHTML = favorites.slice(0, 3).map((t, i) => {
        const cover = t.cover
            ? `<img src="${esc(t.cover)}" alt="">`
            : `<div class="favorite-sleeve-art favorite-sleeve-art-${i + 1}" aria-hidden="true">
                <span class="favorite-sleeve-label">SIDE A · 0${i + 1}</span>
                <strong>${esc(t.title.charAt(0))}</strong>
                <span class="favorite-sleeve-title">${esc(t.title)}</span>
                <span class="favorite-sleeve-artist">${esc(t.artist)}</span>
            </div>`;
        const inner = `
            <div class="favorite-record-art" aria-hidden="true">
                <div class="favorite-vinyl-disc"><span></span></div>
                <div class="favorite-vinyl-sleeve">${cover}</div>
            </div>
            <span class="favorite-record-rank">0${i + 1}</span>
            <span class="favorite-record-title">${esc(t.title)}</span>
            <span class="favorite-record-artist">${esc(t.artist)}</span>`;
        return t.link
            ? `<a class="favorite-record" href="${esc(t.link)}" target="_blank" rel="noopener" aria-label="${esc(t.title)} — ${esc(t.artist)}, открыть трек">${inner}</a>`
            : `<div class="favorite-record">${inner}</div>`;
    }).join('');
}

async function loadSteamStatus() {
    const status = $('steam-status');
    const hint = $('steam-hint');
    const avatar = $('steam-avatar');
    const name = $('steam-name');

    status.textContent = 'Загружаю статус…';
    hint.textContent = '';
    status.classList.remove('is-playing', 'is-online', 'is-offline');
    try {
        const baseUrl = window.SUDOKU_SUPABASE_URL;
        const publishableKey = window.SUDOKU_SUPABASE_KEY;
        if (!baseUrl || !publishableKey) {
            throw new Error('Supabase не настроен');
        }

        const response = await fetch(`${baseUrl}/functions/v1/steam-status`, {
            headers: {
                apikey: publishableKey,
                Authorization: `Bearer ${publishableKey}`
            }
        });
        const data = await response.json();
        const serverError = typeof data?.error === 'string' ? data.error : '';
        if (!response.ok) {
            let message = serverError || `HTTP ${response.status}`;
            if (response.status === 404) {
                message = serverError ? 'Профиль Steam не найден' : 'Функция Steam не опубликована';
            } else if (response.status === 503) message = 'Добавь API-ключ Steam в Supabase';
            else if (response.status >= 500) message = 'Steam временно недоступен';
            throw new Error(message);
        }
        if (!data || typeof data.personaName !== 'string') throw new Error('Некорректный ответ Steam');

        name.textContent = data.personaName;
        if (data.avatarUrl) {
            avatar.innerHTML = `<img src="${esc(data.avatarUrl)}" alt="">`;
        }

        if (data.isPublic === false) {
            status.textContent = 'Профиль закрыт';
        } else if (typeof data.gameName === 'string' && data.gameName) {
            status.textContent = `Играет в ${data.gameName}`;
            status.classList.add('is-playing');
        } else if (data.isOnline) {
            status.textContent = 'В сети';
            status.classList.add('is-online');
        } else {
            status.textContent = 'Сейчас не в игре';
            status.classList.add('is-offline');
        }
    } catch (error) {
        console.error('Could not load Steam status:', error);
        status.textContent = 'Статус недоступен';
        status.classList.add('is-offline');
        hint.textContent = error.message || 'Проверь подключение';
    }
}

// ===== сборка блока =====
function buildLive() {
    const root = $('live-root');
    if (!root) return;
    const head = (title, fn, refreshTitle = 'Обновить') => `<div class="live-head"><span>${title}</span>${fn ? `<button class="live-refresh" data-fn="${fn}" title="${refreshTitle}" aria-label="${refreshTitle}">↻</button>` : ''}</div>`;
    const movies = OFFPLAY_CONTENT.movies.map((movie, i) => {
        const poster = movie.poster
            ? `<img src="${esc(movie.poster)}" alt="Постер фильма «${esc(movie.title)}»" loading="lazy" decoding="async">`
            : 'Добавь локальный постер';
        return `
            <a class="offplay-movie offplay-movie-${i + 1}" href="https://www.imdb.com/title/${esc(movie.imdbId)}/" target="_blank" rel="noopener" aria-label="Открыть фильм «${esc(movie.title)}» на IMDb">
                <span class="offplay-movie-poster">${poster}</span>
                <strong>${esc(movie.title)}</strong>
            </a>`;
    }).join('');
    const memes = OFFPLAY_CONTENT.memes.map(meme => `
        <img${meme.pixelated ? ' class="is-pixelated"' : ''} src="${esc(meme.image)}" alt="${esc(meme.alt)}" decoding="async">`).join('');
    root.innerHTML = `
        <section class="live-section">
            <h2 class="section-title">Live</h2>
            <div class="live-grid">
                <div class="live-card">${head('Сейчас играет', 'loadNow', 'Обновить статус воспроизведения')}<div id="live-now" class="live-now"></div></div>
                <div class="live-card">${head('Любимые треки')}<div id="live-fav" class="live-fav"></div></div>
                <div class="live-card live-wide">
                    ${head('Вне плейлиста', 'loadSteamStatus', 'Обновить статус Steam')}
                    <div class="offplay-grid">
                        <div class="offplay-tile offplay-movies">
                            <span class="offplay-label">ФИЛЬМЫ</span>
                            <div class="offplay-movie-list">${movies}</div>
                            <div class="imdb-attribution">
                                <a href="https://www.imdb.com/" target="_blank" rel="noopener">IMDb</a>
                                <span>Все карточки ведут на IMDb</span>
                            </div>
                        </div>
                        <div class="offplay-tile offplay-meme">
                            <span class="offplay-label">МЕМЫ</span>
                            <div class="offplay-meme-list">${memes}</div>
                        </div>
                        <div class="offplay-tile offplay-steam">
                            <span class="offplay-label">STEAM</span>
                            <a class="offplay-steam-link" href="${esc(OFFPLAY_CONTENT.steamProfile)}" target="_blank" rel="noopener">
                                <span id="steam-avatar" class="offplay-steam-avatar" aria-hidden="true">S</span>
                                <span class="offplay-steam-info">
                                    <strong id="steam-name">djxd_17</strong>
                                    <span id="steam-status" class="offplay-steam-status">Загружаю статус…</span>
                                    <span id="steam-hint" class="offplay-steam-hint"></span>
                                </span>
                                <span class="offplay-steam-arrow" aria-hidden="true">↗</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>`;
    const fns = { loadNow, loadSteamStatus };
    root.querySelectorAll('.live-refresh').forEach(b => b.addEventListener('click', () => fns[b.dataset.fn]()));
    loadNow(); loadFavorites(); loadSteamStatus();
    setInterval(loadNow, LIVE.refreshSec * 1000);
}
document.addEventListener('DOMContentLoaded', buildLive);
