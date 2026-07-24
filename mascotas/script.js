const MASCOTS_API_URL = '/api/v1/mascots';
const COUNTRY_NAMES = {
    Canada: 'Canadá',
    Mexico: 'México',
    USA: 'Estados Unidos'
};

function getMascotsCollection(data) {
    if (Array.isArray(data)) return data;
    return data?.mascots || data?.mascotas || data?.data || [];
}

function createMascotCard(mascot, index) {
    const article = document.createElement('article');
    const media = document.createElement('div');
    const image = document.createElement('img');
    const body = document.createElement('div');
    const country = document.createElement('span');
    const title = document.createElement('h3');
    const description = document.createElement('p');
    const name = mascot.name || `Mascota ${index + 1}`;
    const paragraphs = Array.isArray(mascot.description)
        ? mascot.description
        : [mascot.description || mascot.history || mascot.bio].filter(Boolean);

    article.className = 'mascot-card';
    media.className = 'mascot-card__media';
    image.className = 'mascot-card__image';
    image.src = mascot.image_url || mascot.image || mascot.images?.[0] || '';
    image.alt = `${name}, mascota oficial del Mundial 2026`;
    image.loading = index === 0 ? 'eager' : 'lazy';
    image.decoding = 'async';

    body.className = 'mascot-card__body';
    country.className = 'mascot-card__country';
    country.textContent = COUNTRY_NAMES[mascot.country] || mascot.country || mascot.host || 'Mundial 2026';
    title.className = 'mascot-card__title';
    title.textContent = name;
    description.className = 'mascot-card__description';
    description.textContent = paragraphs.join(' ');

    media.append(image);
    body.append(country, title, description);
    article.append(media, body);
    return article;
}

async function loadMascots() {
    const container = document.querySelector('#mascotas-container');

    if (!container) return;

    try {
        const data = await fetchWithCache(MASCOTS_API_URL);
        const mascots = getMascotsCollection(data);

        if (!mascots.length) throw new Error('La API no devolvió mascotas.');

        container.replaceChildren(...mascots.map(createMascotCard));
    } catch (error) {
        console.error('No se pudieron cargar las mascotas:', error);
        const status = document.createElement('p');
        status.className = 'mascots-status mascots-status--error';
        status.textContent = 'No pudimos cargar las mascotas en este momento. Intenta nuevamente más tarde.';
        container.replaceChildren(status);
    } finally {
        container.setAttribute('aria-busy', 'false');
    }
}

document.addEventListener('DOMContentLoaded', loadMascots);
