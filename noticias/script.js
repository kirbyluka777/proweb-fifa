const NEWS_API = 'https://wc-api-u378.onrender.com/wc-api/api/v1/news';

function createLink(news, label) {
    const link = document.createElement('a');
    link.className = 'news-link';
    link.href = `details/index.html?id=${encodeURIComponent(news.id)}`;
    link.textContent = label;
    return link;
}

function renderFeaturedNews(news) {
    const feature = document.getElementById('news-feature');
    const content = document.createElement('article');
    const date = document.createElement('p');
    const title = document.createElement('h2');
    const preview = document.createElement('p');

    content.className = 'news-feature__content';
    date.className = 'news-date';
    date.textContent = news.published_date;
    title.textContent = news.title;
    preview.textContent = news.preview_text;

    content.append(date, title, preview, createLink(news, 'Leer noticia'));
    feature.append(content);
    feature.style.backgroundImage = `url("${news.image_url}")`;
}

function createNewsCard(news) {
    const card = document.createElement('a');
    const heading = document.createElement('div');
    const title = document.createElement('h3');
    const image = document.createElement('img');
    const body = document.createElement('div');
    const date = document.createElement('p');
    const preview = document.createElement('p');
    const readMore = document.createElement('span');

    card.className = 'card news-card';
    card.href = `details/index.html?id=${encodeURIComponent(news.id)}`;
    heading.className = 'news-card__heading';
    title.textContent = news.title;
    heading.append(title);

    image.className = 'news-card__image';
    image.src = news.image_url;
    image.alt = news.image_title || news.title;
    image.loading = 'lazy';

    body.className = 'news-card__body';
    date.className = 'news-date';
    date.textContent = news.published_date;
    preview.textContent = news.preview_text;
    readMore.className = 'btn news-card__link';
    readMore.textContent = 'Leer más';
    body.append(date, preview, readMore);

    card.append(image, heading, body);
    return card;
}

async function loadNews() {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(NEWS_API)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

    const news = await response.json();
    if (!Array.isArray(news) || news.length === 0) return;

    renderFeaturedNews(news[0]);
    document.getElementById('news-grid').append(...news.slice(1).map(createNewsCard));
}

document.addEventListener('DOMContentLoaded', loadNews);
