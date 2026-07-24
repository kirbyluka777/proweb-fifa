let teamsMap = {};
let teamFlagsMap = {};
let citiesMap = {};
let roundsMap = {};
let catalogosCargados = false;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarPagina);
} else {
    iniciarPagina();
}

function iniciarPagina() {
    const btnAplicar = document.getElementById('btn-aplicar-filtros');
    if (btnAplicar) {
        btnAplicar.addEventListener('click', () => {
            const filtroCiudad = document.getElementById('filtro-ciudad');
            const filtroRonda = document.getElementById('filtro-ronda');
            const filtroEstatus = document.getElementById('filtro-estatus');
            const filtroGrupo = document.getElementById('filtro-grupo');
            const filtroEquipo = document.getElementById('filtro-equipo');

            const params = {};
            if (filtroCiudad && filtroCiudad.value) params.city_id = filtroCiudad.value;
            if (filtroRonda && filtroRonda.value) params.round = filtroRonda.value;
            if (filtroEstatus && filtroEstatus.value) params.status = filtroEstatus.value;
            if (filtroGrupo && filtroGrupo.value) params.group = filtroGrupo.value;
            if (filtroEquipo && filtroEquipo.value) params.team_id = filtroEquipo.value;

            loadMatchesData(params);
        });
    }

    loadMatchesData({});
}

async function fetchApiData(endpointUrl) {

    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(endpointUrl)}`;
    return await fetchWithCache(proxyUrl)
}

async function loadMatchesData(filterParams = {}) {
    const baseUrl = 'https://wc-api-u378.onrender.com/wc-api/api/v1/';
    const container = document.getElementById('matches-container');
    const filtroCiudad = document.getElementById('filtro-ciudad');
    const filtroRonda = document.getElementById('filtro-ronda');
    const filtroEstatus = document.getElementById('filtro-estatus');
    const filtroGrupo = document.getElementById('filtro-grupo');
    const filtroEquipo = document.getElementById('filtro-equipo');

    if (container) {
        container.innerHTML = '<p class="loading-text">Cargando partidos...</p>';
    }

    try {
        if (!catalogosCargados) {
            try {
                const [citiesData, teamsData, roundsData] = await Promise.all([
                    fetchApiData(`${baseUrl}cities`).catch(() => null),
                    fetchApiData(`${baseUrl}teams`).catch(() => null),
                    fetchApiData(`${baseUrl}rounds`).catch(() => null)
                ]);

                if (citiesData) {
                    const list = Array.isArray(citiesData) ? citiesData : (citiesData.cities || citiesData.data || []);
                    list.forEach(c => {
                        const id = c.id !== undefined ? c.id : (c.city_id !== undefined ? c.city_id : c.code);
                        const name = c.name || c.city_name || c.city || c.host_city || String(id);
                        if (id !== undefined) citiesMap[String(id).trim().toLowerCase()] = name;
                    });
                }

                if (teamsData) {
                    const list = Array.isArray(teamsData) ? teamsData : (teamsData.teams || teamsData.data || []);
                    list.forEach(t => {
                        const id = t.id !== undefined ? t.id : (t.team_id !== undefined ? t.team_id : (t.code !== undefined ? t.code : t.abbreviation));
                        const name = t.name || t.team_name || t.country || String(id);
                        if (id !== undefined) {
                            const key = String(id).trim().toLowerCase();
                            teamsMap[key] = name;
                            teamFlagsMap[key] = t.flag_url || t.flag_uri || '';
                        }
                    });
                }

                if (roundsData) {
                    const list = Array.isArray(roundsData) ? roundsData : (roundsData.rounds || roundsData.data || []);
                    list.forEach(r => {
                        const id = r.id !== undefined ? r.id : (r.round !== undefined ? r.round : r.round_number);
                        const name = r.name || r.round_name || r.title || `Ronda ${id}`;
                        if (id !== undefined) roundsMap[String(id).trim().toLowerCase()] = name;
                    });
                }

                catalogosCargados = true;
            } catch (e) {
                console.warn('Catálogos secundarios inaccesibles, mostrando identificadores por defecto.');
            }
        }

        let matchesUrl = `${baseUrl}matches`;
        const queryParts = [];

        if (filterParams.city_id) queryParts.push(`city_id=${encodeURIComponent(filterParams.city_id)}`);
        if (filterParams.round !== undefined && filterParams.round !== '') queryParts.push(`round=${encodeURIComponent(filterParams.round)}`);
        if (filterParams.status) queryParts.push(`status=${encodeURIComponent(filterParams.status)}`);
        if (filterParams.group) queryParts.push(`group=${encodeURIComponent(filterParams.group)}`);

        if (queryParts.length > 0) {
            matchesUrl += `?${queryParts.join('&')}`;
        }

        const matchesData = await fetchApiData(matchesUrl);
        const allMatches = Array.isArray(matchesData) ? matchesData : (matchesData.matches || matchesData.data || []);

        if (allMatches.length === 0) {
            if (container) {
                container.innerHTML = '<p class="no-results">No se encontraron partidos con los parámetros seleccionados.</p>';
            }
            return;
        }

        const parsedMatches = allMatches.map(match => {
            const homeIdStr = (match.home_id !== undefined && match.home_id !== null) ? String(match.home_id).trim() : '';
            const awayIdStr = (match.away_id !== undefined && match.away_id !== null) ? String(match.away_id).trim() : '';
            const cityIdStr = (match.city !== undefined && match.city !== null) ? String(match.city).trim() : '';
            const roundIdStr = (match.round !== undefined && match.round !== null) ? String(match.round).trim() : '';

            const homeName = teamsMap[homeIdStr.toLowerCase()] || homeIdStr || 'Por definir';
            const awayName = teamsMap[awayIdStr.toLowerCase()] || awayIdStr || 'Por definir';
            const cityName = citiesMap[cityIdStr.toLowerCase()] || (cityIdStr ? `Sede ${cityIdStr}` : 'Sede por definir');
            const roundName = roundsMap[roundIdStr.toLowerCase()] || (roundIdStr ? `Ronda ${roundIdStr}` : 'Fase de Grupos');

            let groupName = match.group || '';
            if (groupName && !String(groupName).toLowerCase().includes('grupo') && !String(groupName).toLowerCase().includes('fase')) {
                groupName = `Grupo ${groupName}`;
            }

            return {
                ...match,
                homeIdStr,
                awayIdStr,
                cityIdStr,
                roundIdStr,
                homeName,
                awayName,
                homeFlag: teamFlagsMap[homeIdStr.toLowerCase()] || '',
                awayFlag: teamFlagsMap[awayIdStr.toLowerCase()] || '',
                cityName,
                roundName,
                groupName,
                statusName: match.status || 'scheduled'
            };
        });

        let partidosFinales = parsedMatches;
        if (filterParams.team_id) {
            partidosFinales = parsedMatches.filter(m =>
                m.homeIdStr === filterParams.team_id || m.awayIdStr === filterParams.team_id
            );
        }

        if (Object.keys(filterParams).length === 0) {
            configurarLos5Filtros(parsedMatches, { filtroCiudad, filtroRonda, filtroEstatus, filtroGrupo, filtroEquipo });
        }

        renderMatches(partidosFinales, container);

    } catch (error) {
        console.error("Error al cargar los partidos:", error);
        if (container) {
            container.innerHTML = `<p class="no-results">Error al obtener información de partidos: ${error.message || 'Error de red'}</p>`;
        }
    }
}

function configurarLos5Filtros(matches, selectores) {
    const ciudades = new Map();
    const rondas = new Map();
    const estatuses = new Set();
    const grupos = new Set();
    const equipos = new Map();

    matches.forEach(match => {
        if (match.cityIdStr) ciudades.set(match.cityIdStr, match.cityName);
        if (match.roundIdStr !== '') rondas.set(match.roundIdStr, match.roundName);
        if (match.status) estatuses.add(String(match.status));
        if (match.group) grupos.add(String(match.group));
        if (match.homeIdStr && !match.homeName.toLowerCase().includes('por definir')) equipos.set(match.homeIdStr, match.homeName);
        if (match.awayIdStr && !match.awayName.toLowerCase().includes('por definir')) equipos.set(match.awayIdStr, match.awayName);
    });

    llenarSelectMap(selectores.filtroCiudad, ciudades, "Filtro: Ciudad");
    llenarSelectMap(selectores.filtroRonda, rondas, "Filtro: Ronda");
    llenarSelectSet(selectores.filtroEstatus, estatuses, "Filtro: Estatus");
    llenarSelectSet(selectores.filtroGrupo, grupos, "Filtro: Grupo");
    llenarSelectMap(selectores.filtroEquipo, equipos, "Filtro: Equipo");
}

function llenarSelectMap(selectElement, mapValues, textoDefecto) {
    if (!selectElement) return;
    selectElement.innerHTML = `<option value="">${textoDefecto}</option>`;

    Array.from(mapValues.entries()).sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, name]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        selectElement.appendChild(option);
    });
}

function llenarSelectSet(selectElement, setValues, textoDefecto) {
    if (!selectElement) return;
    selectElement.innerHTML = `<option value="">${textoDefecto}</option>`;

    Array.from(setValues).sort().forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        selectElement.appendChild(option);
    });
}

function renderMatches(matchesToRender, container) {
    if (!container) return;
    container.innerHTML = '';

    if (matchesToRender.length === 0) {
        container.innerHTML = '<p class="no-results">No hay partidos disponibles con estos criterios.</p>';
        return;
    }

    const sortedMatches = [...matchesToRender].sort((a, b) =>
        `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`)
    );
    const matchesByDate = new Map();
    sortedMatches.forEach(match => {
        const date = match.date || '';
        if (!matchesByDate.has(date)) matchesByDate.set(date, []);
        matchesByDate.get(date).push(match);
    });

    matchesByDate.forEach((matches, date) => {
        const day = document.createElement('section');
        const heading = document.createElement('h2');
        const games = document.createElement('div');

        day.className = 'match-day';
        heading.className = 'match-day__heading';
        heading.textContent = formatMatchDayHeader(date);
        games.className = 'match-day__games';

        matches.forEach(match => games.append(createMatchCard(match)));
        day.append(heading, games);
        container.append(day);
    });
}

function formatMatchDayHeader(date) {
    if (!date) return 'Fecha por confirmar';
    const parsedDate = new Date(`${date}T00:00:00`);
    return new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
    }).format(parsedDate);
}

function formatMatchTime(time) {
    return String(time || '').slice(0, 5);
}

function formatMatchCardDate(date, time) {
    if (!date) return formatMatchTime(time) || 'TBD';
    const parsedDate = new Date(`${date}T00:00:00`);
    const dateLabel = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    }).format(parsedDate);
    return dateLabel;
}

function matchStatus(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'ended') return 'FT';
    if (normalized === 'halftime') return 'HT';
    if (normalized === 'in progress') return 'LIVE';
    return 'SCHEDULED';
}

function matchWinner(match) {
    if (String(match.status).toLowerCase() !== 'ended') return '';
    const homePenalty = Number(match.home_score?.penalty);
    const awayPenalty = Number(match.away_score?.penalty);
    if (
        Number.isFinite(homePenalty) &&
        Number.isFinite(awayPenalty) &&
        homePenalty !== awayPenalty
    ) {
        return homePenalty > awayPenalty ? 'home' : 'away';
    }

    const homeScore = Number(match.home_score?.total);
    const awayScore = Number(match.away_score?.total);
    if (homeScore === awayScore) return '';
    return homeScore > awayScore ? 'home' : 'away';
}

function createTeamRow(name, flagUrl, score, isWinner) {
    const row = document.createElement('div');
    row.className = `match-team${isWinner ? ' is-winner' : ''}`;

    if (flagUrl) {
        const flag = document.createElement('img');
        flag.className = 'match-team__flag';
        flag.src = flagUrl;
        flag.alt = '';
        row.append(flag);
    } else {
        const flagSpace = document.createElement('span');
        flagSpace.className = 'match-team__flag-space';
        row.append(flagSpace);
    }

    const teamName = document.createElement('span');
    teamName.className = 'match-team__name';
    teamName.textContent = name;

    const scoreWrap = document.createElement('div');
    scoreWrap.className = 'match-team__score-wrap';

    const teamScore = document.createElement('span');
    teamScore.className = 'match-team__score';
    teamScore.textContent = score;

    scoreWrap.append(teamScore);

    if (isWinner) {
        const arrow = document.createElement('span');
        arrow.className = 'match-team__winner-arrow';
        arrow.textContent = '◄';
        scoreWrap.append(arrow);
    }

    row.append(teamName, scoreWrap);
    return row;
}

function createMatchCard(match) {
    const card = document.createElement('a');
    card.className = 'match-card';
    card.href = `/partidos/partido-detalle/?id=${match.id}`;
    card.setAttribute('aria-label', `${match.homeName} vs ${match.awayName}`);

    const winner = matchWinner(match);
    const matchEnded = String(match.status).toLowerCase() === 'ended';
    const homeScore = matchEnded ? match.home_score?.total ?? '0' : '-';
    const awayScore = matchEnded ? match.away_score?.total ?? '0' : '-';

    const stageHeader = document.createElement('div');
    stageHeader.className = 'match-card__stage';
    stageHeader.textContent = match.groupName ? `${match.roundName} - ${match.groupName}` : match.roundName;

    const content = document.createElement('div');
    content.className = 'match-card__content';

    const teams = document.createElement('div');
    teams.className = 'match-card__teams';
    teams.append(
        createTeamRow(match.homeName, match.homeFlag, homeScore, winner === 'home'),
        createTeamRow(match.awayName, match.awayFlag, awayScore, winner === 'away')
    );

    const divider = document.createElement('div');
    divider.className = 'match-card__divider';

    const meta = document.createElement('div');
    meta.className = 'match-card__meta';

    const status = document.createElement('span');
    status.className = 'match-card__status';
    status.textContent = matchStatus(match.status);

    const date = document.createElement('time');
    date.className = 'match-card__date';
    date.dateTime = `${match.date || ''}T${match.time || ''}`;
    date.textContent = formatMatchCardDate(match.date, match.time);

    meta.append(status, date);
    content.append(teams, divider, meta);
    card.append(stageHeader, content);

    return card;
}
