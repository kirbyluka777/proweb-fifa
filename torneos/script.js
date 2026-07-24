const DEFAULT_EVENT_IMAGE = 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80';
const EVENTS_API_URL = 'https://wc-api-u378.onrender.com/wc-api/api/v1/events';

document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
});

// Función de consulta a la API utilizando proxy como respaldo para evitar problemas de CORS
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

async function loadEvents() {
    const grid = document.getElementById('events-grid');
    
    try {
        let rawEvents = await fetchApiData(EVENTS_API_URL);
        
        // Manejo por si el proxy devuelve un string JSON en lugar de un objeto parseado
        if (typeof rawEvents === 'string') {
            try { rawEvents = JSON.parse(rawEvents); } catch (e) {}
        }

        let eventsArray = [];
        if (Array.isArray(rawEvents)) {
            eventsArray = rawEvents;
        } else if (typeof rawEvents === 'object' && rawMatches !== null) {
            eventsArray = rawEvents.events || rawEvents.data || Object.values(rawEvents);
        }

        if (eventsArray.length === 0) {
            grid.innerHTML = '<div class="status-msg">No se encontraron torneos ni eventos disponibles en este momento.</div>';
            return;
        }

        renderEvents(eventsArray);

    } catch (error) {
        console.error("Error al cargar la API de eventos:", error);
        grid.innerHTML = '<div class="status-msg error">Ocurrió un error al cargar los torneos. Por favor, intenta de nuevo más tarde.</div>';
    }
}

function renderEvents(events) {
    const grid = document.getElementById('events-grid');
    grid.innerHTML = ''; // Limpiamos el mensaje de carga

    events.forEach(event => {
        // Validamos que tengamos los datos mínimos
        if (!event || !event.title) return;

        const card = document.createElement('article');
        card.className = 'event-card';

        const title = event.title;
        const description = event.description || 'No hay descripción disponible para este evento.';
        const url = event.url || '#';
        const imageUrl = event.image_url || DEFAULT_EVENT_IMAGE;

        card.innerHTML = `
            <div class="event-img-wrapper">
                <img src="${imageUrl}" alt="${title}" onerror="this.src='${DEFAULT_EVENT_IMAGE}';">
            </div>
            <div class="event-content">
                <div>
                    <h2 class="event-title">${title}</h2>
                    <p class="event-description">${description}</p>
                </div>
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn-event-official">
                    Sitio Oficial <span>↗</span>
                </a>
            </div>
        `;

        grid.appendChild(card);
    });
}