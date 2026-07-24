const DEFAULT_LOGO = '/assets/2026_FIFA_World_Cup_emblem.png';
const RECORDS_API_URL = '/api/v1/records/';
let activeHls;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const recordId = urlParams.get('id');

    if (!recordId) {
        showError("No se especificó un ID de archivo válido. Vuelve al catálogo e intenta de nuevo.");
        return;
    }

    loadRecordDetail(recordId);
});

function getRecordsCollection(data) {
    if (Array.isArray(data)) return data;
    return data?.records || data?.data || data?.results || [];
}

async function fetchRecordById(id) {
    const data = await fetchWithCache(RECORDS_API_URL, 30 * 60 * 1000);
    return getRecordsCollection(data).find(record => String(record?.id) === String(id));
}

function getPlaybackSource(rawUrl) {
    try {
        const url = new URL(rawUrl);

        if (url.hostname.includes('youtube.com') && url.pathname === '/watch') {
            const videoId = url.searchParams.get('v');
            return {
                type: 'embed',
                url: videoId
                    ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`
                    : rawUrl
            };
        }

        if (url.hostname === 'youtu.be') {
            const videoId = url.pathname.replace('/', '');
            return {
                type: 'embed',
                url: videoId
                    ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`
                    : rawUrl
            };
        }

        if (url.hostname.includes('sofascore.com') && url.pathname.includes('video-player')) {
            const streamUrl = url.searchParams.get('url');
            if (streamUrl) return { type: 'hls', url: streamUrl };
        }

        if (url.pathname.endsWith('.m3u8')) return { type: 'hls', url: rawUrl };
    } catch {
        return { type: 'embed', url: rawUrl };
    }

    return { type: 'embed', url: rawUrl };
}

function configurePlayer(record) {
    const source = getPlaybackSource(record.url);
    const iframe = document.getElementById('video-iframe');
    const video = document.getElementById('video-player');

    iframe.hidden = true;
    video.hidden = true;

    if (source.type === 'embed') {
        iframe.src = source.url;
        iframe.hidden = false;
        return;
    }

    video.poster = record.thumbnail_url || '';
    video.hidden = false;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = source.url;
        return;
    }

    if (window.Hls?.isSupported()) {
        activeHls?.destroy();
        activeHls = new window.Hls();
        activeHls.loadSource(source.url);
        activeHls.attachMedia(video);
        return;
    }

    throw new Error('Este navegador no permite reproducir transmisiones HLS.');
}

async function loadRecordDetail(id) {
    try {
        const recordData = await fetchRecordById(id);

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

    if (record.url) {
        configurePlayer(record);
    } else {
        showError("El enlace de reproducción para este video no está disponible.");
        return;
    }

    document.getElementById('record-title').textContent = record.title || 'Partido de la Copa Mundial';
    document.getElementById('record-subtitle').textContent = record.subtitle || 'Archivo Histórico';

    const descElement = document.getElementById('record-desc');
    descElement.textContent = record.description || `Disfruta del resumen completo y los momentos más destacados del partido: ${record.title || ''}.`;

    const logoImg = document.getElementById('tournament-logo');
    logoImg.src = record.logo_url || record.tournament_logo || DEFAULT_LOGO;
    logoImg.onerror = () => { logoImg.src = DEFAULT_LOGO; };

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
