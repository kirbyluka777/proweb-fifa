const RANKING_API_URL = 'https://wc-api-u378.onrender.com/wc-api/api/v1/ranking';

let ranking = [];
let selectedConfederation = 'all';
let searchTerm = '';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('team-search')?.addEventListener('input', handleSearch);
    document.getElementById('confederation-filter')?.addEventListener('click', handleFilter);
    document.getElementById('ranking-content')?.addEventListener('click', handleRankingClick);
    document.getElementById('ranking-podium')?.addEventListener('click', rememberSelectedTeam);
    loadRanking();
});

async function fetchJson(url) {
    if (typeof window.fetchWithCache === 'function') {
        return window.fetchWithCache(url);
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
    return response.json();
}

async function requestRanking() {
    try {
        return await fetchJson(RANKING_API_URL);
    } catch (directError) {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(RANKING_API_URL)}`;
        try {
            return await fetchJson(proxyUrl);
        } catch {
            const fallbackProxyUrl = `https://proxy.cors.sh/${RANKING_API_URL}`;
            try {
                return await fetchJson(fallbackProxyUrl);
            } catch {
                throw directError;
            }
        }
    }
}

async function loadRanking() {
    const content = document.getElementById('ranking-content');
    content?.setAttribute('aria-busy', 'true');
    showStatus('Cargando ranking FIFA...', 'loading');

    try {
        const payload = await requestRanking();
        ranking = normalizeRanking(payload).sort((left, right) => left.rank - right.rank);

        if (!ranking.length) {
            showStatus('No hay posiciones disponibles en este momento.', 'empty');
            renderPodium([]);
            return;
        }

        renderSummary();
        renderPodium(ranking.slice(0, 3));
        renderRanking();
    } catch (error) {
        console.error('No se pudo cargar el ranking FIFA:', error);
        showStatus('No pudimos cargar el ranking. Revisa tu conexión e intenta nuevamente.', 'error');
        renderPodium([]);
    } finally {
        content?.setAttribute('aria-busy', 'false');
    }
}

function normalizeRanking(payload) {
    if (typeof payload === 'string') {
        try {
            payload = JSON.parse(payload);
        } catch {
            return [];
        }
    }

    const list = Array.isArray(payload)
        ? payload
        : payload && typeof payload === 'object'
            ? Object.values(payload)
            : [];

    return list
        .filter(entry => entry?.team && Number.isFinite(Number(entry.rank)))
        .map(entry => ({
            ...entry,
            rank: Number(entry.rank),
            previous_rank: Number.isFinite(Number(entry.previous_rank))
                ? Number(entry.previous_rank)
                : Number(entry.rank),
            points: Number(entry.points) || 0,
            previous_points: Number(entry.previous_points) || 0
        }));
}

function handleSearch(event) {
    searchTerm = normalizeText(event.target.value.trim());
    renderRanking();
}

function handleFilter(event) {
    const button = event.target.closest('[data-confederation]');
    if (!button) return;

    selectedConfederation = button.dataset.confederation;
    document.querySelectorAll('[data-confederation]').forEach(filterButton => {
        const active = filterButton === button;
        filterButton.classList.toggle('active', active);
        filterButton.setAttribute('aria-pressed', String(active));
    });
    renderRanking();
}

function handleRankingClick(event) {
    if (event.target.closest('[data-action="retry"]')) {
        loadRanking();
        return;
    }
    rememberSelectedTeam(event);
}

function rememberSelectedTeam(event) {
    const link = event.target.closest('[data-team-id]');
    if (link) sessionStorage.setItem('selectedTeamId', link.dataset.teamId);
}

function visibleRanking() {
    return ranking.filter(entry => {
        const confederation = String(entry.team.confederation || '').toUpperCase();
        const matchesConfederation = selectedConfederation === 'all'
            || confederation === selectedConfederation;
        const searchable = normalizeText(`${entry.team.name || ''} ${entry.team.id || ''}`);
        return matchesConfederation && searchable.includes(searchTerm);
    });
}

function renderSummary() {
    const confederations = new Set(
        ranking.map(entry => entry.team.confederation).filter(Boolean)
    );
    document.getElementById('teams-total').textContent = ranking.length;
    document.getElementById('confederations-total').textContent = confederations.size;
    document.getElementById('ranking-leader').textContent = ranking[0]?.team.name || '—';
}

function renderPodium(leaders) {
    const podium = document.getElementById('ranking-podium');
    if (!podium) return;

    if (!leaders.length) {
        const message = document.createElement('p');
        message.textContent = 'El podio no está disponible.';
        podium.replaceChildren(message);
        return;
    }

    podium.replaceChildren(...leaders.map(createPodiumCard));
}

function createPodiumCard(entry) {
    const team = entry.team;
    const link = document.createElement('a');
    const encodedId = encodeURIComponent(team.id || '');
    link.className = 'podium-card';
    link.dataset.rank = entry.rank;
    link.dataset.teamId = team.id || '';
    link.href = `../equipos/equipo-detalle/?id=${encodedId}#${encodedId}`;
    link.setAttribute('aria-label', `${team.name}, posición ${entry.rank}`);

    const rank = document.createElement('span');
    rank.className = 'podium-rank';
    rank.textContent = `#${entry.rank}`;

    const flag = createFlag(team, 'podium-flag', 'podium-code-fallback');
    const name = document.createElement('h3');
    name.className = 'podium-name';
    name.textContent = team.name || team.id || 'Selección';

    const points = document.createElement('span');
    points.className = 'podium-points';
    points.textContent = `${formatPoints(entry.points)} puntos`;

    link.append(rank, flag, name, points);
    return link;
}

function renderRanking() {
    const content = document.getElementById('ranking-content');
    const count = document.getElementById('results-count');
    if (!content) return;

    const entries = visibleRanking();
    const suffix = entries.length === 1 ? 'selección' : 'selecciones';
    if (count) count.textContent = `${entries.length} ${suffix}`;

    if (!entries.length) {
        showStatus('No se encontraron selecciones con estos filtros.', 'empty');
        return;
    }

    const wrap = document.createElement('div');
    const table = document.createElement('table');
    const head = document.createElement('thead');
    const body = document.createElement('tbody');

    wrap.className = 'ranking-table-wrap';
    table.className = 'data-table ranking-table';
    head.innerHTML = '<tr><th scope="col">Pos.</th><th scope="col">Selección</th><th scope="col">Conf.</th><th scope="col">Puntos</th><th scope="col">Anterior</th><th scope="col">Cambio</th></tr>';

    entries.forEach(entry => body.append(createRankingRow(entry)));
    table.append(head, body);
    wrap.append(table);
    content.replaceChildren(wrap);
}

function createRankingRow(entry) {
    const row = document.createElement('tr');
    const rank = document.createElement('span');
    rank.className = `rank-number${entry.rank <= 3 ? ' top-rank' : ''}`;
    rank.textContent = entry.rank;

    const confederation = document.createElement('span');
    confederation.className = 'confederation-tag';
    confederation.textContent = entry.team.confederation || '—';

    row.append(
        createCell(rank),
        createCell(createTeamLink(entry.team)),
        createCell(confederation),
        createCell(formatPoints(entry.points)),
        createCell(entry.previous_rank),
        createCell(createMovement(entry))
    );
    return row;
}

function createTeamLink(team) {
    const link = document.createElement('a');
    const encodedId = encodeURIComponent(team.id || '');
    link.className = 'team-link';
    link.href = `../equipos/equipo-detalle/?id=${encodedId}#${encodedId}`;
    link.dataset.teamId = team.id || '';

    const flag = createFlag(team, 'team-flag', 'flag-code');
    const text = document.createElement('span');
    const name = document.createElement('span');
    const code = document.createElement('span');

    text.className = 'team-name-wrap';
    name.textContent = team.name || team.id || 'Selección';
    code.className = 'team-code';
    code.textContent = team.id || '';
    text.append(name, code);
    link.append(flag, text);
    return link;
}

function createFlag(team, imageClass, fallbackClass) {
    const source = team.flag_url || team.flag_uri;
    if (!source) return createFlagFallback(team.id, fallbackClass);

    const image = document.createElement('img');
    image.className = imageClass;
    image.src = source;
    image.alt = `Bandera de ${team.name || team.id || 'la selección'}`;
    image.loading = 'lazy';
    image.addEventListener('error', () => {
        image.replaceWith(createFlagFallback(team.id, fallbackClass));
    }, { once: true });
    return image;
}

function createFlagFallback(code, className) {
    const fallback = document.createElement('span');
    fallback.className = className;
    fallback.textContent = code || 'FIFA';
    fallback.setAttribute('aria-hidden', 'true');
    return fallback;
}

function createMovement(entry) {
    const movement = entry.previous_rank - entry.rank;
    const element = document.createElement('span');
    element.className = 'movement';

    if (movement > 0) {
        element.classList.add('movement-up');
        element.textContent = `▲ ${movement}`;
        element.setAttribute('aria-label', `Sube ${movement} posiciones`);
    } else if (movement < 0) {
        element.classList.add('movement-down');
        element.textContent = `▼ ${Math.abs(movement)}`;
        element.setAttribute('aria-label', `Baja ${Math.abs(movement)} posiciones`);
    } else {
        element.classList.add('movement-same');
        element.textContent = '—';
        element.setAttribute('aria-label', 'Sin cambios');
    }
    return element;
}

function createCell(value) {
    const cell = document.createElement('td');
    if (value instanceof Node) cell.append(value);
    else cell.textContent = value;
    return cell;
}

function formatPoints(value) {
    return new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(value) || 0);
}

function normalizeText(value) {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function showStatus(message, type) {
    const content = document.getElementById('ranking-content');
    if (!content) return;

    const status = document.createElement('div');
    status.className = `ranking-status${type === 'error' ? ' error' : ''}`;

    if (type === 'loading') {
        const spinner = document.createElement('span');
        spinner.className = 'loading-spinner';
        spinner.setAttribute('aria-hidden', 'true');
        status.append(spinner);
    }

    const text = document.createElement('p');
    text.textContent = message;
    status.append(text);

    if (type === 'error') {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'btn retry-button';
        retry.dataset.action = 'retry';
        retry.textContent = 'Reintentar';
        status.append(retry);
    }

    content.replaceChildren(status);
    const count = document.getElementById('results-count');
    if (count && type !== 'loading') count.textContent = '0 selecciones';
}
