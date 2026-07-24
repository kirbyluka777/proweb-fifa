const TEAMS_API_BASE_URL = '/api/v1/teams';
const POSITION_ORDER = ['Arquero', 'Defensor', 'Mediocampista', 'Delantero'];

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('team-detail')?.addEventListener('click', handleDetailClick);
    loadTeam();
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

async function loadTeam() {
    const page = document.getElementById('team-detail');
    const teamId = getTeamId();

    if (!teamId) {
        renderError('No se indicó qué equipo deseas consultar.', false);
        return;
    }

    page?.setAttribute('aria-busy', 'true');
    renderLoading();

    try {
        const team = await requestApi(`${TEAMS_API_BASE_URL}/${encodeURIComponent(teamId)}`);
        if (!team || !team.id) throw new Error('La API devolvió un equipo inválido.');
        renderTeam(team);
    } catch (error) {
        console.error('No se pudo cargar el equipo:', error);
        renderError('No pudimos cargar la información de este equipo. Revisa tu conexión e intenta nuevamente.', true);
    } finally {
        page?.setAttribute('aria-busy', 'false');
    }
}

function getTeamId() {
    const queryId = new URLSearchParams(window.location.search).get('id');
    const rawHash = window.location.hash.slice(1);
    let hashId = rawHash;
    try {
        hashId = decodeURIComponent(rawHash);
    } catch {
        // La validación posterior rechaza los ID codificados incorrectamente.
    }
    hashId = hashId.replace(/^id=/i, '');
    const referrerPath = document.referrer ? new URL(document.referrer).pathname : '';
    const storedId = referrerPath.includes('/equipos')
        ? sessionStorage.getItem('selectedTeamId')
        : '';
    const rawId = queryId || hashId || storedId;
    return rawId && /^[a-z0-9_-]+$/i.test(rawId) ? rawId.toUpperCase() : '';
}

function handleDetailClick(event) {
    if (event.target.closest('[data-action="retry"]')) loadTeam();
}

function renderLoading() {
    const page = document.getElementById('team-detail');
    if (!page) return;
    preserveBackLink(page);

    const status = document.createElement('div');
    status.className = 'detail-status';
    const spinner = document.createElement('span');
    spinner.className = 'loading-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const message = document.createElement('p');
    message.textContent = 'Cargando información del equipo...';
    status.append(spinner, message);
    page.append(status);
}

function renderTeam(team) {
    const page = document.getElementById('team-detail');
    if (!page) return;
    preserveBackLink(page);

    const colors = {
        primary: safeColor(team.colors?.primary_color, '#7b2cbf'),
        secondary: safeColor(team.colors?.secondary_color, '#4cc9f0'),
        primaryText: safeColor(team.colors?.primary_text_color, '#ffffff'),
        secondaryText: safeColor(team.colors?.secondary_text_color, '#ffffff')
    };
    page.style.setProperty('--team-primary', colors.primary);
    page.style.setProperty('--team-secondary', colors.secondary);
    page.style.setProperty('--team-primary-text', colors.primaryText);
    page.style.setProperty('--team-secondary-text', colors.secondaryText);
    page.style.setProperty('--team-secondary-soft', hexToRgba(colors.secondary, 0.2));

    const hero = createHero(team);
    const facts = createFacts(team);
    const roster = createRoster(team.players);
    page.append(hero, facts, roster);

    document.title = `${team.name} - FIFA World Cup 2026`;
}

function createHero(team) {
    const hero = document.createElement('section');
    hero.className = 'detail-card team-hero';

    const flagShell = document.createElement('div');
    flagShell.className = 'detail-flag-shell';
    const flag = document.createElement('img');
    flag.className = 'detail-flag';
    flag.src = team.flag_uri || team.flag_url || '';
    flag.alt = `Bandera de ${team.name}`;
    flag.addEventListener('error', () => replaceWithInitials(flag, team.id, 'flag-fallback'));
    flagShell.append(flag);

    const label = document.createElement('p');
    label.className = 'team-label';
    label.textContent = team.host ? 'Equipo anfitrión' : 'Detalle de equipo';

    const title = document.createElement('h1');
    title.className = 'team-title';
    title.textContent = team.name;

    const subtitle = document.createElement('p');
    subtitle.className = 'team-subtitle';
    subtitle.textContent = `${team.confederation || 'Confederación por definir'} · Grupo ${team.group || '—'}`;

    hero.append(flagShell, label, title, subtitle, createTeamPalette());
    return hero;
}

function createTeamPalette() {
    const palette = document.createElement('div');
    palette.className = 'team-palette';
    palette.setAttribute('aria-label', 'Colores oficiales del equipo');

    const primary = document.createElement('span');
    primary.className = 'team-color team-color-primary';
    primary.textContent = 'Color principal';

    const secondary = document.createElement('span');
    secondary.className = 'team-color team-color-secondary';
    secondary.textContent = 'Color alterno';

    palette.append(primary, secondary);
    return palette;
}

function createFacts(team) {
    const facts = document.createElement('section');
    facts.className = 'facts-grid';
    facts.setAttribute('aria-label', 'Datos del equipo');
    facts.append(
        createFact('Confederación', team.confederation || '—'),
        createFact('Grupo', team.group ? `Grupo ${team.group}` : '—'),
        createFact('Ranking FIFA', formatRanking(team.world_ranking)),
        createFact('Participaciones', formatValue(team.appearances)),
        createFact('Código FIFA', team.id || '—'),
        createFact('Condición', team.host ? 'Anfitrión' : 'Clasificado')
    );
    return facts;
}

function createFact(label, value) {
    const fact = document.createElement('div');
    fact.className = 'team-fact';
    const labelElement = document.createElement('span');
    labelElement.className = 'team-fact-label';
    labelElement.textContent = label;
    const valueElement = document.createElement('strong');
    valueElement.className = 'team-fact-value';
    valueElement.textContent = value;
    fact.append(labelElement, valueElement);
    return fact;
}

function createRoster(rawPlayers) {
    const section = document.createElement('section');
    section.className = 'detail-card roster-section';

    const players = Array.isArray(rawPlayers) ? rawPlayers.filter(Boolean) : [];
    const heading = document.createElement('div');
    heading.className = 'section-heading';
    const title = document.createElement('h2');
    title.textContent = 'Jugadores convocados';
    const count = document.createElement('p');
    count.textContent = `${players.length} ${players.length === 1 ? 'jugador' : 'jugadores'}`;
    heading.append(title, count);
    section.append(heading);

    if (!players.length) {
        const empty = document.createElement('div');
        empty.className = 'position-group';
        const message = document.createElement('p');
        message.textContent = 'La convocatoria todavía no está disponible.';
        empty.append(message);
        section.append(empty);
        return section;
    }

    const groupedPlayers = groupPlayers(players);
    groupedPlayers.forEach(([position, positionPlayers]) => {
        const group = document.createElement('div');
        group.className = 'position-group';
        const groupTitle = document.createElement('h3');
        groupTitle.className = 'position-title';
        groupTitle.textContent = `${position} · ${positionPlayers.length}`;
        const grid = document.createElement('div');
        grid.className = 'players-grid';
        positionPlayers
            .sort((a, b) => Number(a.number || 999) - Number(b.number || 999))
            .forEach(player => grid.append(createPlayerCard(player)));
        group.append(groupTitle, grid);
        section.append(group);
    });

    return section;
}

function groupPlayers(players) {
    const groups = new Map();
    players.forEach(player => {
        const position = player.position || 'Sin posición';
        if (!groups.has(position)) groups.set(position, []);
        groups.get(position).push(player);
    });

    return [...groups.entries()].sort(([positionA], [positionB]) => {
        const indexA = POSITION_ORDER.indexOf(positionA);
        const indexB = POSITION_ORDER.indexOf(positionB);
        return (indexA < 0 ? 99 : indexA) - (indexB < 0 ? 99 : indexB)
            || positionA.localeCompare(positionB, 'es');
    });
}

function createPlayerCard(player) {
    const card = document.createElement('article');
    card.className = 'player-card';
    card.dataset.playerId = player.id || '';

    const photoShell = document.createElement('div');
    photoShell.className = 'player-photo-shell';
    if (player.photo_url) {
        const photo = document.createElement('img');
        photo.className = 'player-photo';
        photo.src = player.photo_url;
        photo.alt = `Foto de ${player.name || 'jugador'}`;
        photo.loading = 'lazy';
        photo.addEventListener('error', () =>
            replaceWithInitials(photo, getInitials(player.name), 'player-initials')
        );
        photoShell.append(photo);
    } else {
        const initials = document.createElement('span');
        initials.className = 'player-initials';
        initials.textContent = getInitials(player.name) || 'FIFA';
        photoShell.append(initials);
    }

    const info = document.createElement('div');
    info.className = 'player-info';
    const name = document.createElement('strong');
    name.className = 'player-name';
    name.textContent = player.name || 'Jugador por definir';
    name.title = player.name || '';
    const meta = document.createElement('span');
    meta.className = 'player-meta';
    const number = player.number === 0 || player.number ? `#${player.number}` : 'Sin dorsal';
    meta.textContent = `${player.position || 'Sin posición'} · ${number}`;
    info.append(name, meta);

    card.append(photoShell, info);
    return card;
}

function preserveBackLink(page) {
    const backLink = page.querySelector('.back-link');
    page.replaceChildren();
    if (backLink) page.append(backLink);
}

function renderError(message, allowRetry) {
    const page = document.getElementById('team-detail');
    if (!page) return;
    preserveBackLink(page);

    const status = document.createElement('div');
    status.className = 'detail-status error';
    const text = document.createElement('p');
    text.textContent = message;
    status.append(text);

    const actions = document.createElement('div');
    actions.className = 'status-actions';
    if (allowRetry) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'btn status-button';
        retry.dataset.action = 'retry';
        retry.textContent = 'Reintentar';
        actions.append(retry);
    }
    const back = document.createElement('a');
    back.className = 'btn';
    back.href = '/equipos/';
    back.textContent = 'Ver equipos';
    actions.append(back);
    status.append(actions);
    page.append(status);
    page.setAttribute('aria-busy', 'false');
}

function replaceWithInitials(image, text, className) {
    const fallback = document.createElement('span');
    fallback.className = className;
    fallback.textContent = text || 'FIFA';
    image.replaceWith(fallback);
}

function getInitials(name) {
    return String(name || '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase();
}

function safeColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
}

function hexToRgba(hex, alpha) {
    const value = hex.replace('#', '');
    const number = Number.parseInt(value, 16);
    return `rgba(${number >> 16}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
}

function formatRanking(value) {
    return Number.isFinite(Number(value)) ? `#${Number(value)}` : '—';
}

function formatValue(value) {
    return value === 0 || value ? String(value) : '—';
}
