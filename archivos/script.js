const DEFAULT_THUMBNAIL = 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80';
const BASE_API_URL = 'https://wc-api-u378.onrender.com/wc-api/api/v1/records/';

document.addEventListener('DOMContentLoaded', () => {
    loadRecords();
});

// 1. Función que "despierta" a Render pidiendo solo 1 registro (archivo ultra ligero)
async function despertarServidor() {
    const pingUrl = `${BASE_API_URL}?limit=1`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(pingUrl)}`;
    
    const maxRetries = 10; // 10 intentos = hasta 50 segundos de espera total
    const delayMs = 5000;

    for (let i = 1; i <= maxRetries; i++) {
        try {
            console.log(`[Paso 1: Despertando API en Render - Intento ${i}/${maxRetries}]...`);
            const res = await fetch(proxyUrl);
            if (res.ok) {
                console.log("¡El servidor en Render ha despertado y está listo!");
                return true;
            }
        } catch (e) {
            console.warn(`El servidor sigue encendiéndose... reintentando en 5s.`);
        }
        await new Promise(r => setTimeout(r, delayMs));
    }
    throw new Error("El servidor de Render no respondió después de 50 segundos.");
}

// 2. Descarga por bloques pequeños para no superar el límite de tamaño de corsproxy.io
async function loadRecords() {
    const grid = document.getElementById('records-grid');
    grid.innerHTML = '<div class="status-msg">Conectando con el servidor en Render (puede tardar hasta 40s si estaba en reposo)...</div>';
    
    try {
        // Primero nos aseguramos de que Render esté despierto
        await despertarServidor();
        
        grid.innerHTML = '<div class="status-msg">Descargando catálogo de vídeos...</div>';

        let allRecords = [];
        let offset = 0;
        const limit = 50; // Límite pequeño de 50 para que corsproxy.io jamás dé error 413
        let masDatos = true;

        // Bucle para traer todo el archivo en pedazos ligeros
        while (masDatos) {
            const paginatedUrl = `${BASE_API_URL}?offset=${offset}&limit=${limit}`;
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(paginatedUrl)}`;
            
            const res = await fetch(proxyUrl);
            if (!res.ok) break;
            
            let data = await res.json();
            let chunk = [];
            
            if (Array.isArray(data)) {
                chunk = data;
            } else if (typeof data === 'object' && data !== null) {
                chunk = data.records || data.data || Object.values(data);
            }

            if (chunk.length > 0) {
                allRecords = allRecords.concat(chunk);
                offset += limit;
            }

            if (chunk.length < limit || chunk.length === 0 || allRecords.length >= 500) {
                masDatos = false;
            }
        }

        if (allRecords.length === 0) {
            grid.innerHTML = '<div class="status-msg">No se encontraron archivos de vídeo disponibles.</div>';
            return;
        }

        renderRecords(allRecords);

    } catch (error) {
        console.error("Error crítico:", error);
        grid.innerHTML = '<div class="status-msg error">El servidor de la API está tardando demasiado en encender. Por favor, recarga la página (F5).</div>';
    }
}

function renderRecords(records) {
    const grid = document.getElementById('records-grid');
    grid.innerHTML = ''; 

    records.forEach(record => {
        if (!record || (!record.title && !record.id)) return;

        const card = document.createElement('article');
        card.className = 'record-card';

        const id = record.id;
        const title = record.title || 'Resumen de Partido';
        const subtitle = record.subtitle || 'Archivo FIFA';
        const thumbUrl = record.thumbnail_url || DEFAULT_THUMBNAIL;

        card.innerHTML = `
            <div class="record-thumb-wrapper">
                <img src="${thumbUrl}" alt="${title}" onerror="this.src='${DEFAULT_THUMBNAIL}';">
                <div class="play-overlay"></div>
            </div>
            <div class="record-content">
                <div>
                    <h2 class="record-title">${title}</h2>
                    <p class="record-subtitle">🎬 ${subtitle}</p>
                </div>
                <a href="archivo-detalle/index.html?id=${id}" class="btn-watch">Ver Video</a>
            </div>
        `;

        grid.appendChild(card);
    });
}