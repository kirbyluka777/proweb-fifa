const RECORDS_API_URL = 'https://wc-api-u378.onrender.com/wc-api/api/v1/records/';
const RECORDS_PROXY_URL = `https://proxy.corsfix.com/?${RECORDS_API_URL}`;
const RECORDS_PER_PAGE = 12;
const DEFAULT_THUMBNAIL = '/assets/2026_FIFA_World_Cup_emblem.png';

let records = [];
let visibleRecords = RECORDS_PER_PAGE;
let currentSearch = '';

function getRecordsCollection(data) {
    if (Array.isArray(data)) return data;
    return data?.records || data?.data || data?.results || [];
}

function createRecordCard(record, index) {
    const article = document.createElement('article');
    const mediaLink = document.createElement('a');
    const image = document.createElement('img');
    const play = document.createElement('span');
    const body = document.createElement('div');
    const type = document.createElement('p');
    const title = document.createElement('h3');
    const detailLink = document.createElement('a');
    const detailUrl = `/archivos/archivo-detalle/?id=${encodeURIComponent(record.id)}`;
    const recordTitle = record.title || 'Video del torneo';

    article.className = 'record-card';
    mediaLink.className = 'record-card__media';
    mediaLink.href = detailUrl;
    mediaLink.setAttribute('aria-label', `Ver ${recordTitle}`);

    image.src = record.thumbnail_url || DEFAULT_THUMBNAIL;
    image.alt = '';
    image.loading = index < 3 ? 'eager' : 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
        image.src = DEFAULT_THUMBNAIL;
        image.classList.add('record-card__fallback');
    }, { once: true });

    play.className = 'record-card__play';
    play.textContent = '▶';
    play.setAttribute('aria-hidden', 'true');

    body.className = 'record-card__body';
    type.className = 'record-card__type';
    type.textContent = record.subtitle || 'Archivo FIFA';
    title.className = 'record-card__title';
    title.textContent = recordTitle;
    detailLink.className = 'record-card__link';
    detailLink.href = detailUrl;
    detailLink.textContent = 'Ver video →';

    mediaLink.append(image, play);
    body.append(type, title, detailLink);
    article.append(mediaLink, body);
    return article;
}

function getFilteredRecords() {
    if (!currentSearch) return records;

    return records.filter(record => {
        const searchable = `${record.title || ''} ${record.subtitle || ''}`.toLocaleLowerCase('es');
        return searchable.includes(currentSearch);
    });
}

function renderRecords() {
    const grid = document.querySelector('#records-grid');
    const count = document.querySelector('#records-count');
    const moreButton = document.querySelector('#records-more');
    const filtered = getFilteredRecords();
    const visible = filtered.slice(0, visibleRecords);

    if (!grid || !count || !moreButton) return;

    count.textContent = `${filtered.length} ${filtered.length === 1 ? 'video' : 'videos'}`;
    moreButton.hidden = visible.length >= filtered.length;

    if (!visible.length) {
        const status = document.createElement('p');
        status.className = 'records-status';
        status.textContent = currentSearch
            ? 'No encontramos videos que coincidan con tu búsqueda.'
            : 'No hay videos disponibles en este momento.';
        grid.replaceChildren(status);
        return;
    }

    grid.replaceChildren(...visible.map(createRecordCard));
}

async function fetchRecords() {
    return await fetchWithCache(RECORDS_PROXY_URL, 30 * 60 * 1000);
}

async function loadRecords() {
    const grid = document.querySelector('#records-grid');

    try {
        const data = await fetchRecords();
        records = getRecordsCollection(data).filter(record => record && (record.id || record.title));
        renderRecords();
    } catch (error) {
        console.error('No se pudo cargar el archivo:', error);
        const status = document.createElement('p');
        status.className = 'records-status records-status--error';
        status.textContent = 'No pudimos cargar el catálogo en este momento. Intenta nuevamente más tarde.';
        grid.replaceChildren(status);
        document.querySelector('#records-count').textContent = 'No disponible';
        document.querySelector('#records-more').hidden = true;
    } finally {
        grid.setAttribute('aria-busy', 'false');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const search = document.querySelector('#records-search');
    const moreButton = document.querySelector('#records-more');

    search?.addEventListener('input', event => {
        currentSearch = event.target.value.trim().toLocaleLowerCase('es');
        visibleRecords = RECORDS_PER_PAGE;
        renderRecords();
    });

    moreButton?.addEventListener('click', () => {
        visibleRecords += RECORDS_PER_PAGE;
        renderRecords();
    });

    loadRecords();
});
