// Variable global para almacenar catálogos en caché y no saturar las peticiones
let teamsMap = {};
let citiesMap = {};
let roundsMap = {};
let catalogosCargados = false;

// Verificación robusta de carga del DOM
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

    // Carga inicial sin filtros
    loadMatchesData({});
}

// Función inteligente: intenta petición directa primero (vital para Render) y proxy como respaldo
async function fetchApiData(endpointUrl) {
    try {
        const res = await fetch(endpointUrl);
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn(`[Intento directo fallido para ${endpointUrl}], probando con proxy CORS...`, e);
    }
    
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(endpointUrl)}`;
    const resProxy = await fetch(proxyUrl);
    if (!resProxy.ok) throw new Error(`Error HTTP: ${resProxy.status}`);
    return await resProxy.json();
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
        container.innerHTML = '<p class="loading-text">Cargando partidos (si el servidor de la API estaba en reposo, puede tardar hasta 50 segundos en despertar)...</p>';
    }

    try {
        // 1. Cargar catálogos de traducción una sola vez y guardarlos en memoria
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
                        if (id !== undefined) teamsMap[String(id).trim().toLowerCase()] = name;
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
                console.warn('No se pudieron cargar los catálogos secundarios. Se mostrarán los identificadores directos.');
            }
        }

        // 2. Construir la URL exacta con parámetros para la API /matches
        let matchesUrl = `${baseUrl}matches`;
        const queryParts = [];
        
        if (filterParams.city_id) queryParts.push(`city_id=${encodeURIComponent(filterParams.city_id)}`);
        if (filterParams.round !== undefined && filterParams.round !== '') queryParts.push(`round=${encodeURIComponent(filterParams.round)}`);
        if (filterParams.status) queryParts.push(`status=${encodeURIComponent(filterParams.status)}`);
        if (filterParams.group) queryParts.push(`group=${encodeURIComponent(filterParams.group)}`);

        if (queryParts.length > 0) {
            matchesUrl += `?${queryParts.join('&')}`;
        }

        // 3. Petición a los partidos
        const matchesData = await fetchApiData(matchesUrl);
        const allMatches = Array.isArray(matchesData) ? matchesData : (matchesData.matches || matchesData.data || []);

        if (allMatches.length === 0) {
            if (container) {
                container.innerHTML = '<p class="no-results">No se encontraron partidos con los parámetros seleccionados.</p>';
            }
            return;
        }

        // 4. Cruzar IDs con los nombres legibles
        const parsedMatches = allMatches.map(match => {
            const homeIdStr = (match.home_id !== undefined && match.home_id !== null) ? String(match.home_id).trim() : '';
            const awayIdStr = (match.away_id !== undefined && match.away_id !== null) ? String(match.away_id).trim() : '';
            const cityIdStr = (match.city !== undefined && match.city !== null) ? String(match.city).trim() : '';
            const roundIdStr = (match.round !== undefined && match.round !== null) ? String(match.round).trim() : '';

            const homeName = teamsMap[homeIdStr.toLowerCase()] || homeIdStr || 'Por definir';
            const awayName = teamsMap[awayIdStr.toLowerCase()] || awayIdStr || 'Por definir';
            const cityName = citiesMap[cityIdStr.toLowerCase()] || (cityIdStr ? `Sede ${cityIdStr}` : 'Sede por definir');
            const roundName = roundsMap[roundIdStr.toLowerCase()] || (roundIdStr ? `Ronda ${roundIdStr}` : 'Fase de Grupos');
            
            let groupName = match.group || 'Fase Final';
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
                cityName,
                roundName,
                groupName,
                statusName: match.status || 'scheduled'
            };
        });

        // 5. Filtrado local inteligente de Equipo (cubre tanto partidos de local como de visitante)
        let partidosFinales = parsedMatches;
        if (filterParams.team_id) {
            partidosFinales = parsedMatches.filter(m => 
                m.homeIdStr === filterParams.team_id || m.awayIdStr === filterParams.team_id
            );
        }

        // 6. Poblar los menús desplegables solo al cargar inicialmente
        if (Object.keys(filterParams).length === 0) {
            configurarLos5Filtros(parsedMatches, { filtroCiudad, filtroRonda, filtroEstatus, filtroGrupo, filtroEquipo });
        }

        // 7. Renderizar en el contenedor
        renderMatches(partidosFinales, container);

    } catch (error) {
        console.error("Error al cargar los partidos:", error);
        if (container) {
            container.innerHTML = `<p class="no-results">No se pudo cargar la información. Error: ${error.message || 'Fallo de conexión'}. Si el error persiste, presiona F12 y revisa la pestaña Console.</p>`;
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
        container.innerHTML = '<p class="no-results">No hay partidos que coincidan con los filtros seleccionados.</p>';
        return;
    }

    matchesToRender.forEach(match => {
        const id = match.id || 1;
        const home = match.homeName;
        const away = match.awayName;
        const grupo = match.groupName;
        const ciudad = match.cityName;

        const card = document.createElement('div');
        card.className = 'match-card';
        
        card.innerHTML = `
            <span class="match-teams"><strong>${home}</strong> vs <strong>${away}</strong></span>
            <span class="match-info">${grupo} | ${ciudad}</span>
            <a href="partido-detalle/index.html?id=${id}" class="btn-slanted">Ver Detalles</a>
        `;

        container.appendChild(card);
    });
}