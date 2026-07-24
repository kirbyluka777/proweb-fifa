const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80';
const TORONTO_BACKUP = 'https://images.unsplash.com/photo-1517090504586-fde19ea6066f?auto=format&fit=crop&w=1200&q=80'; // Foto de respaldo para Toronto

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const cityId = urlParams.get('id');

    if (!cityId) {
        showError("No se especificó ninguna ciudad. Regresa al catálogo e intenta nuevamente.");
        return;
    }

    loadCityDetails(cityId);
});

// Petición multinivel con respaldo de proxies para evitar fallos de CORS
async function fetchApiData(endpointUrl) {
    try {
        const res = await fetch(endpointUrl);
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn(`[Intento directo fallido], probando proxy CORS...`);
    }

    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(endpointUrl)}`;
    const resProxy = await fetch(proxyUrl);
    if (!resProxy.ok) throw new Error(`Error HTTP: ${resProxy.status}`);
    return await resProxy.json();
}

// Función auxiliar para probar si una imagen existe y carga correctamente
function validateImageUrl(url) {
    return new Promise((resolve) => {
        if (!url) return resolve(false);
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

async function loadCityDetails(id) {
    const endpointUrl = `https://wc-api-u378.onrender.com/wc-api/api/v1/cities/${id}`;

    try {
        let cityData = await fetchApiData(endpointUrl);
        
        if (typeof cityData === 'string') {
            try { cityData = JSON.parse(cityData); } catch (e) {}
        }

        if (!cityData || (!cityData.name && !cityData.id)) {
            throw new Error("Los datos de la ciudad están incompletos.");
        }

        await renderCityDetails(cityData);

        // Consultamos la API de partidos pasando exactamente el ID de esta ciudad
        loadRealMatches(cityData.id);

    } catch (error) {
        console.error("Error al cargar detalles:", error);
        showError("No se pudo conectar con el servidor para cargar los datos de la ciudad.");
    }
}

async function renderCityDetails(city) {
    document.title = `${city.name || 'Ciudad'} - Detalle Mundial 2026`;
    
    // Actualiza el texto directamente dentro del banner central
    document.getElementById('city-title').textContent = `${city.name || 'Ciudad'} (${city.country || ''})`;

    const banner = document.getElementById('city-banner');
    
    // 1. Elegimos la imagen inicial (Si es Toronto por nombre o si la API falla, usamos respaldo)
    let imageUrl = city.image_url || city.stadium?.image_url;
    if (city.name && city.name.toLowerCase().includes('toronto')) {
        imageUrl = city.image_url || TORONTO_BACKUP;
    }

    // 2. Validamos que la imagen realmente sirva antes de ponerla
    const isValid = await validateImageUrl(imageUrl);
    if (!isValid) {
        imageUrl = (city.name && city.name.toLowerCase().includes('toronto')) ? TORONTO_BACKUP : DEFAULT_IMAGE;
    }

    banner.style.backgroundImage = `url('${imageUrl}')`;

    const logoImg = document.getElementById('city-logo');
    if (city.logo_url) {
        logoImg.src = city.logo_url;
        logoImg.style.display = 'inline-block';
        logoImg.onerror = () => { logoImg.style.display = 'none'; };
    }

    const descContainer = document.getElementById('city-description');
    descContainer.innerHTML = '';
    
    if (Array.isArray(city.description) && city.description.length > 0) {
        city.description.forEach(paragraph => {
            const p = document.createElement('p');
            p.textContent = paragraph;
            descContainer.appendChild(p);
        });
    } else {
        descContainer.innerHTML = '<p>No hay descripción disponible para esta ciudad.</p>';
    }

    if (city.stadium) {
        document.getElementById('stadium-section').style.display = 'block';
        document.getElementById('stadium-name').textContent = city.stadium.name || 'Estadio por definir';
        
        const stadiumImg = document.getElementById('stadium-img');
        let stadiumUrl = city.stadium.image_url || imageUrl;
        
        // Verificamos también la foto del estadio
        const isStadiumValid = await validateImageUrl(stadiumUrl);
        stadiumImg.src = isStadiumValid ? stadiumUrl : imageUrl;
        stadiumImg.onerror = () => { stadiumImg.src = DEFAULT_IMAGE; };

        const cap = city.stadium.capacity 
            ? `${Number(city.stadium.capacity).toLocaleString()} espectadores` 
            : 'No disponible';
        document.getElementById('stadium-capacity').textContent = cap;

        if (city.stadium.coordinates) {
            const lat = city.stadium.coordinates.latitude;
            const lon = city.stadium.coordinates.longitude;
            document.getElementById('stadium-coords').textContent = `${lat}° N, ${lon}° W`;
        } else {
            document.getElementById('stadium-coords').textContent = 'No disponibles';
        }
    }

    const extraContainer = document.getElementById('stadium-extra');
    if (city.extra_info && (city.extra_info.title || city.extra_info.description)) {
        let extraHtml = `<h4>${city.extra_info.title || 'Dato Histórico'}</h4>`;
        if (Array.isArray(city.extra_info.description)) {
            city.extra_info.description.forEach(txt => { extraHtml += `<p>${txt}</p>`; });
        }
        if (city.extra_info.hashtag) {
            extraHtml += `<p><strong>${city.extra_info.hashtag}</strong></p>`;
        }
        extraContainer.innerHTML = extraHtml;
    } else {
        extraContainer.style.display = 'none';
    }
}

// Consulta de partidos en tiempo real y filtrado estricto por city_id == id
async function loadRealMatches(currentCityId) {
    const matchesList = document.getElementById('matches-list');
    matchesList.innerHTML = '<li class="status-msg">Buscando partidos programados en la API...</li>';

    const matchesEndpoint = 'https://wc-api-u378.onrender.com/wc-api/api/v1/matches';

    try {
        let rawMatches = await fetchApiData(matchesEndpoint);
        
        if (typeof rawMatches === 'string') {
            try { rawMatches = JSON.parse(rawMatches); } catch (e) {}
        }

        let matchesArray = [];
        if (Array.isArray(rawMatches)) {
            matchesArray = rawMatches;
        } else if (typeof rawMatches === 'object' && rawMatches !== null) {
            matchesArray = rawMatches.matches || rawMatches.data || Object.values(rawMatches);
        }

        const targetId = Number(currentCityId);
        const cityMatches = matchesArray.filter(match => {
            if (!match) return false;
            const matchCityId = Number(match.city_id !== undefined ? match.city_id : match.city);
            return matchCityId === targetId;
        });

        renderMatchesList(cityMatches);

    } catch (error) {
        console.error("Error al cargar partidos de la API:", error);
        matchesList.innerHTML = '<li class="status-msg error">No se pudo cargar el calendario de partidos en este momento.</li>';
    }
}

// Dibuja la lista real resolviendo correctamente los objetos home_score y away_score
function renderMatchesList(matches) {
    const matchesList = document.getElementById('matches-list');
    matchesList.innerHTML = '';

    if (!matches || matches.length === 0) {
        matchesList.innerHTML = '<li class="status-msg">No se encontraron partidos programados para esta ciudad.</li>';
        return;
    }

    matches.forEach(match => {
        const li = document.createElement('li');
        li.className = 'match-item';

        const homeTeam = match.home_id || 'Local';
        const awayTeam = match.away_id || 'Visitante';
        
        let scoreText = 'vs';
        if (match.home_score && match.away_score && match.home_score.total !== undefined && match.away_score.total !== undefined) {
            scoreText = `${match.home_score.total} - ${match.away_score.total}`;
        }

        const matchTitle = `${homeTeam} ${scoreText} ${awayTeam}`;
        
        let roundText = '';
        if (match.round) {
            roundText = ` | Ronda ${match.round}`;
        } else if (match.group) {
            roundText = ` | Grupo ${match.group}`;
        }

        const dateText = match.date || 'Fecha por confirmar';

        li.innerHTML = `
            <span><strong>${matchTitle}</strong></span>
            <span class="match-date">${dateText}${roundText}</span>
        `;
        matchesList.appendChild(li);
    });
}

function showError(message) {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="content-container">
            <div class="card-detalle" style="text-align: center; color: #dc3545;">
                <h2>¡Ocurrió un error!</h2>
                <p>${message}</p>
                <br>
                <a href="../index.html" class="btn-back" style="background:#1a1a2e;">Volver al Catálogo</a>
            </div>
        </div>
    `;
}