const HOME_API = '/api/v1';

async function getHomeData(endpoint) {
    const apiUrl = `${HOME_API}/${endpoint}`;
    return await fetchWithCache(apiUrl);
}

function collection(data) {
    return Array.isArray(data) ? data : Object.values(data || {});
}

function showImage(id, src, alt) {
    const image = document.getElementById(id);
    if (!image || !src) return;
    image.src = src;
    image.alt = alt;
    image.hidden = false;
}

function renderNews(data) {
    const news = collection(data)[0];
    const container = document.getElementById('featured-news');
    if (!news || !container) return;

    const article = document.createElement('article');
    const meta = document.createElement('p');
    const title = document.createElement('h3');
    const preview = document.createElement('p');

    meta.className = 'home-meta';
    meta.textContent = news.published_date;
    title.textContent = news.title;
    preview.textContent = news.preview_text;
    article.append(meta, title, preview);
    container.append(article);
    container.style.backgroundImage = `url("${news.image_url}")`;
}

function fillList(id, items, format) {
    const list = document.getElementById(id);
    if (!list) return;
    list.append(...items.map((data) => {
        const item = document.createElement('li');
        item.textContent = format(data);
        return item;
    }));
}

function renderMatches(data) {
    const matches = collection(data)
        .filter((match) => String(match.status).toLowerCase() !== 'ended')
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
        .slice(0, 3);
    fillList('home-matches', matches, (match) => `${match.home_id} vs. ${match.away_id} · ${match.date}`);
}

function renderTeams(data) {
    const teams = collection(data)
        .sort((a, b) => Number(a.world_ranking) - Number(b.world_ranking))
        .slice(0, 3);
    fillList('home-teams', teams, (team) => `${team.name} · Grupo ${team.group}`);
}

function renderCities(data) {
    fillList(
        'home-cities',
        collection(data).slice(0, 3),
        (city) => `${city.name} · ${city.stadium?.name || city.country}`
    );
}

function renderEvent(data) {
    const event = collection(data)[0];
    const container = document.getElementById('home-event');
    if (!event || !container) return;

    const description = document.createElement('p');
    description.textContent = event.description;
    container.append(description);
}

function renderBall(data) {
    showImage('home-ball-image', data.images_url?.[1] || data.images_url?.[0], `${data.name}, balón oficial`);
}

function renderMascot(data) {
    const mascot = collection(data)[0];
    const container = document.getElementById('home-mascot-media');
    const imageUrl = mascot?.image_url || mascot?.image || mascot?.images?.[0];

    if (!container || !imageUrl) return;

    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = `${mascot.name || 'Mascota oficial'} del Mundial 2026`;
    image.loading = 'lazy';
    image.decoding = 'async';
    container.replaceChildren(image);
}

function renderSound(data) {
    showImage('home-sound-image', data.image_url, data.title);
}

async function loadHome() {
    const feeds = [
        ['news', renderNews],
        ['matches', renderMatches],
        ['teams', renderTeams],
        ['cities', renderCities],
        ['events', renderEvent],
        ['ball', renderBall],
        ['mascots', renderMascot],
        ['sound', renderSound]
    ];

    await Promise.allSettled(feeds.map(async ([endpoint, render]) => {
        render(await getHomeData(endpoint));
    }));
}

document.addEventListener('DOMContentLoaded', loadHome);
