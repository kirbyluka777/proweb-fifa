const DEFAULT_LOGO = 'https://digitalhub.fifa.com/transform/c0288b07-db6c-4081-9fc1-9667bb20bb35/Tournament-thumbnail-4_3-1570px_1178px';

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const recordId = urlParams.get('id');

    if (!recordId) {
        showError("No se especificó un ID de archivo válido. Vuelve al catálogo e intenta de nuevo.");
        return;
    }

    loadRecordDetail(recordId);
});

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

async function loadRecordDetail(id) {
    const endpointUrl = `https://wc-api-u378.onrender.com/wc-api/api/v1/records/${id}`;

    try {
        let recordData = await fetchApiData(endpointUrl);
        
        if (typeof recordData === 'string') {
            try { recordData = JSON.parse(recordData); } catch (e) {}
        }

        if (!recordData || (!recordData.title && !recordData.url)) {
            throw new Error("La información de este video está incompleta o no se encuentra disponible.");
        }

        renderPlayer(recordData);

    } catch (error) {
        console.error("Error al cargar detalle del video:", error);
        showError("No se pudo cargar la información del video en este momento.");
    }
}

function renderPlayer(record) {
    document.title = `${record.title || 'Video'} - Archivos Mundial 2026`;

    // 1. Asignamos la URL al iframe
    const iframe = document.getElementById('video-iframe');
    if (record.url) {
        iframe.src = record.url;
    } else {
        showError("El enlace de reproducción para este video no está disponible.");
        return;
    }

    // 2. Llenamos los datos de texto
    document.getElementById('record-title').textContent = record.title || 'Partido de la Copa Mundial';
    document.getElementById('record-subtitle').textContent = record.subtitle || 'Archivo Histórico';
    
    const descElement = document.getElementById('record-desc');
    descElement.textContent = record.description || `Disfruta del resumen completo y los momentos más destacados del partido: ${record.title || ''}.`;

    // 3. Verificamos si la API incluye un logo de torneo o enviamos el oficial por defecto
    const logoImg = document.getElementById('tournament-logo');
    logoImg.src = record.logo_url || record.tournament_logo || DEFAULT_LOGO;
    logoImg.onerror = () => { logoImg.src = DEFAULT_LOGO; };

    // 4. Mostramos el reproductor y ocultamos el mensaje de carga
    document.getElementById('loading-container').style.display = 'none';
    document.getElementById('record-detail-card').style.display = 'block';
}

function showError(message) {
    const container = document.querySelector('.player-main');
    container.innerHTML = `
        <div class="status-msg" style="color: #ff6b6b; border-color: rgba(255, 107, 107, 0.3);">
            <h2>¡Ocurrió un problema!</h2>
            <p style="margin: 1rem 0 1.5rem 0; color: #cccccc;">${message}</p>
            <a href="/archivos/" class="btn-back" style="display:inline-block; background: #ff007f; border-color: #ff007f;">Volver al Catálogo</a>
        </div>
    `;
}
