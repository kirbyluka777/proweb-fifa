let globalCitiesList = [];

// Imagen de respaldo por defecto si una ciudad o estadio no tiene imagen válida
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80';

// Respaldos específicos por ciudad para casos donde la API no proporcione imagen
const CITY_FALLBACK_IMAGES = {
    'toronto': 'https://images.unsplash.com/photo-1517090504586-fde19ea6066f?auto=format&fit=crop&w=800&q=80',
    'vancouver': 'https://images.unsplash.com/photo-1559511260-66a654ae982a?auto=format&fit=crop&w=800&q=80'
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarPagina);
} else {
    iniciarPagina();
}

function iniciarPagina() {
    const countryFilter = document.getElementById('country-filter');
    if (countryFilter) {
        countryFilter.addEventListener('change', (e) => {
            filterAndRenderCities(e.target.value);
        });
    }

    loadCitiesData();
}

// Conexión resiliente con proxy
async function fetchApiData(endpointUrl) {
    try {
        const res = await fetch(endpointUrl);
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn(`[Intento directo fallido], probando proxy CORS...`, e);
    }
    
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(endpointUrl)}`;
    const resProxy = await fetch(proxyUrl);
    if (!resProxy.ok) throw new Error(`Error HTTP: ${resProxy.status}`);
    return await resProxy.json();
}

// Transforma la estructura de objeto {"1": {...}, "2": {...}} a un Arreglo [...]
function parseCitiesResponse(data) {
    if (!data) return [];
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { return []; }
    }
    if (Array.isArray(data)) return data;
    if (typeof data === 'object' && data !== null) {
        return Object.values(data);
    }
    return [];
}

async function loadCitiesData() {
    const endpointUrl = 'https://wc-api-u378.onrender.com/wc-api/api/v1/cities';
    const citiesGrid = document.getElementById('cities-grid');

    if (citiesGrid) {
        citiesGrid.innerHTML = '<p class="status-msg">Cargando ciudades anfitrionas...</p>';
    }

    try {
        const rawData = await fetchApiData(endpointUrl);
        globalCitiesList = parseCitiesResponse(rawData);

        if (!globalCitiesList || globalCitiesList.length === 0) {
            if (citiesGrid) {
                citiesGrid.innerHTML = '<p class="status-msg">No se encontraron ciudades disponibles.</p>';
            }
            return;
        }

        filterAndRenderCities('');

    } catch (error) {
        console.error("Error de conexión:", error);
        if (citiesGrid) {
            citiesGrid.innerHTML = '<p class="status-msg error">No se pudieron cargar las ciudades. Por favor, intenta de nuevo.</p>';
        }
    }
}

function filterAndRenderCities(selectedCountry = '') {
    const citiesGrid = document.getElementById('cities-grid');
    if (!citiesGrid) return;

    let filteredCities = globalCitiesList;

    if (selectedCountry && selectedCountry.trim() !== '') {
        const filterTerm = selectedCountry.trim().toLowerCase();
        
        filteredCities = globalCitiesList.filter(city => {
            const countryName = String(city.country || '').trim().toLowerCase();
            
            if (filterTerm === 'canada' || filterTerm === 'canadá') {
                return countryName.includes('canad') || countryName === 'can' || countryName === 'ca';
            } else if (filterTerm === 'mexico' || filterTerm === 'méxico') {
                return countryName.includes('mexic') || countryName.includes('méxic') || countryName === 'mex' || countryName === 'mx';
            } else if (filterTerm === 'united states' || filterTerm === 'estados unidos' || filterTerm === 'usa') {
                return countryName.includes('united') || countryName.includes('state') || countryName.includes('usa') || countryName.includes('eeuu') || countryName.includes('estados') || countryName === 'us';
            }
            
            return countryName === filterTerm || countryName.includes(filterTerm);
        });
    }

    renderCities(filteredCities, citiesGrid);
}

function renderCities(citiesToRender, container) {
    if (!container) return;
    container.innerHTML = '';

    if (!citiesToRender || citiesToRender.length === 0) {
        container.innerHTML = '<p class="status-msg">No se encontraron ciudades para el país seleccionado.</p>';
        return;
    }

    citiesToRender.forEach(city => {
        const article = document.createElement('article');
        article.className = 'card city-card';

        const cityName = city.name || 'Ciudad por definir';
        const cityNameLower = cityName.toLowerCase().trim();

        // Imagen de respaldo si no viene en la API
        const fallbackImage = CITY_FALLBACK_IMAGES[cityNameLower] || DEFAULT_IMAGE;
        
        const rawImageUrl = city.image_url || city.stadium?.image_url;
        const imageUrl = (rawImageUrl && String(rawImageUrl).trim() !== '') ? rawImageUrl : fallbackImage;

        article.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${imageUrl}" 
                     alt="${cityName}" 
                     class="city-img" 
                     onerror="this.onerror=null; this.src='${fallbackImage}';">
            </div>
            <div class="card-content">
                <h3>${cityName}</h3>
                <div class="card-action">
                    <a href="ciudad-detalle/index.html?id=${city.id}" class="btn">Ver Ciudad</a>
                </div>
            </div>
        `;

        container.appendChild(article);
    });
}