const TEAMS_API_URL = '/api/v1/teams';

let teams = [];
let selectedConfederation = 'all';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('confederation-filter')?.addEventListener('click', handleFilterClick);
    document.getElementById('teams-grid')?.addEventListener('click', handleGridClick);
    loadTeams();
});

async function requestApi(url) {
    return await fetchJson(url);
}

async function fetchJson(url) {
    if (typeof window.fetchWithCache === 'function') {
        return window.fetchWithCache(url);
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
    return response.json();
}

async function loadTeams() {
    const grid = document.getElementById('teams-grid');
    grid?.setAttribute('aria-busy', 'true');
    showStatus('Cargando selecciones...', 'loading');

    try {
        const payload = await requestApi(TEAMS_API_URL);
        teams = normalizeTeams(payload).sort((a, b) =>
            a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
        );

        if (!teams.length) {
            showStatus('No hay equipos disponibles en este momento.', 'empty');
            return;
        }

        renderTeams();
    } catch (error) {
        console.error('No se pudieron cargar los equipos:', error);
        showStatus('No pudimos cargar los equipos. Revisa tu conexión e intenta nuevamente.', 'error');
    } finally {
        grid?.setAttribute('aria-busy', 'false');
    }
}

function normalizeTeams(payload) {
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

    return list.filter(team => team && team.id && team.name);
}

function handleFilterClick(event) {
    const button = event.target.closest('[data-confederation]');
    if (!button) return;

    selectedConfederation = button.dataset.confederation;
    document.querySelectorAll('[data-confederation]').forEach(filterButton => {
        const isActive = filterButton === button;
        filterButton.classList.toggle('active', isActive);
        filterButton.setAttribute('aria-pressed', String(isActive));
    });
    renderTeams();
}

function handleGridClick(event) {
    const retryButton = event.target.closest('[data-action="retry"]');
    if (retryButton) loadTeams();

    const teamLink = event.target.closest('[data-team-id]');
    if (teamLink) {
        sessionStorage.setItem('selectedTeamId', teamLink.dataset.teamId);
    }
}

function renderTeams() {
    const grid = document.getElementById('teams-grid');
    const count = document.getElementById('results-count');
    if (!grid) return;

    const visibleTeams = selectedConfederation === 'all'
        ? teams
        : teams.filter(team =>
            String(team.confederation || '').toUpperCase() === selectedConfederation
        );

    grid.replaceChildren();

    if (!visibleTeams.length) {
        showStatus('No se encontraron selecciones para esta confederación.', 'empty');
    } else {
        const fragment = document.createDocumentFragment();
        visibleTeams.forEach(team => fragment.append(createTeamCard(team)));
        grid.append(fragment);
    }

    if (count) {
        const suffix = visibleTeams.length === 1 ? 'selección' : 'selecciones';
        count.textContent = `${visibleTeams.length} ${suffix}`;
    }
}

function createTeamCard(team) {
    const article = document.createElement('article');
    article.className = 'country-card';
    article.style.setProperty('--team-primary', safeColor(team.colors?.primary_color, '#7b2cbf'));
    article.style.setProperty('--team-secondary', safeColor(team.colors?.secondary_color, '#4cc9f0'));
    article.style.setProperty('--team-primary-text', safeColor(team.colors?.primary_text_color, '#ffffff'));
    article.style.setProperty('--team-secondary-text', safeColor(team.colors?.secondary_text_color, '#ffffff'));

    const link = document.createElement('a');
    link.className = 'country-card-link';
    const encodedTeamId = encodeURIComponent(team.id);
    link.href = `/equipos/equipo-detalle/?id=${encodedTeamId}#${encodedTeamId}`;
    link.dataset.teamId = team.id;
    link.setAttribute('aria-label', `Ver detalles de ${team.name}`);

    const header = document.createElement('div');
    header.className = 'card-header';

    const flagShell = document.createElement('div');
    flagShell.className = 'flag-shell';
    const flag = document.createElement('img');
    flag.className = 'flag-icon';
    flag.src = team.flag_url || team.flag_uri || '';
    flag.alt = `Bandera de ${team.name}`;
    flag.loading = 'lazy';
    flag.addEventListener('error', () => replaceFlagWithCode(flag, team.id));
    flagShell.append(flag);

    const name = document.createElement('h2');
    name.className = 'country-name';
    name.textContent = team.name;

    const confederation = document.createElement('span');
    confederation.className = 'confederation-tag';
    confederation.textContent = team.confederation || 'Sin confederación';

    const code = document.createElement('span');
    code.className = 'fifa-code-tag';
    code.textContent = team.id;

    const tags = document.createElement('div');
    tags.className = 'team-meta-tags';
    tags.append(confederation, code);

    header.append(flagShell, name, tags);

    if (team.host) {
        const host = document.createElement('span');
        host.className = 'host-tag';
        host.textContent = 'Anfitrión';
        header.append(host);
    }

    header.append(createTeamPalette());

    const stats = document.createElement('div');
    stats.className = 'card-body';
    stats.append(
        createStat('Ranking', formatRanking(team.world_ranking)),
        createStat('Grupo', team.group || '—'),
        createStat('Participaciones', formatValue(team.appearances))
    );

    link.append(header, stats);
    article.append(link);
    return article;
}

function createTeamPalette() {
    const palette = document.createElement('div');
    palette.className = 'team-palette';
    palette.setAttribute('aria-label', 'Colores oficiales del equipo');

    const primary = document.createElement('span');
    primary.className = 'team-color team-color-primary';
    primary.textContent = 'Principal';

    const secondary = document.createElement('span');
    secondary.className = 'team-color team-color-secondary';
    secondary.textContent = 'Alterno';

    palette.append(primary, secondary);
    return palette;
}

function createStat(label, value) {
    const column = document.createElement('div');
    column.className = 'stat-col';

    const labelElement = document.createElement('span');
    labelElement.className = 'stat-label';
    labelElement.textContent = label;

    const valueElement = document.createElement('span');
    valueElement.className = 'stat-value';
    valueElement.textContent = value;

    column.append(labelElement, valueElement);
    return column;
}

function replaceFlagWithCode(image, code) {
    const fallback = document.createElement('span');
    fallback.className = 'flag-fallback';
    fallback.textContent = code || 'FIFA';
    image.replaceWith(fallback);
}

function safeColor(value, fallback) {
    return /^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? value : fallback;
}

function formatRanking(value) {
    return Number.isFinite(Number(value)) ? `#${Number(value)}` : '—';
}

function formatValue(value) {
    return value === 0 || value ? String(value) : '—';
}

function showStatus(message, type) {
    const grid = document.getElementById('teams-grid');
    if (!grid) return;

    const status = document.createElement('div');
    status.className = `teams-status${type === 'error' ? ' error' : ''}`;

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

    grid.replaceChildren(status);
    const count = document.getElementById('results-count');
    if (count && type !== 'loading') count.textContent = '0 selecciones';
}
