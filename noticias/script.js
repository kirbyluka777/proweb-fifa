const NEWS_API = 'https://wc-api-u378.onrender.com/wc-api/api/v1/news';
let allNews = [];
let currentIndex = 1;
const BATCH_SIZE = 6;
let observer;
function createLink(news, label) {
    const link = document.createElement('a');
    link.className = 'news-link';
    link.href = `/noticias/details/?id=${encodeURIComponent(news.id)}`;
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
    card.href = `/noticias/details/?id=${encodeURIComponent(news.id)}`;
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
function setupObserver() {
    observer = new IntersectionObserver((entries) => {
        const lastCardEntry = entries[0];
        
        if (lastCardEntry.isIntersecting) {
            observer.unobserve(lastCardEntry.target);
            renderNextBatch();
        }
    }, { rootMargin: '200px' });
}
function renderNextBatch() {
    const grid = document.getElementById('news-grid');
    const nextBatch = allNews.slice(currentIndex, currentIndex + BATCH_SIZE);

    if (nextBatch.length === 0) return;

    nextBatch.forEach((newsItem, index) => {
        const card = createNewsCard(newsItem);
        grid.append(card);

        if (index === nextBatch.length - 1) {
            observer.observe(card);
        }
    });

    currentIndex += BATCH_SIZE;
}
async function loadNews() {
    try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(NEWS_API)}`;
        
        allNews = await fetchWithCache(proxyUrl, 30 * 60 * 1000);

        if (!Array.isArray(allNews) || allNews.length === 0) return;

        renderFeaturedNews(allNews[0]);
        setupObserver();
        renderNextBatch();

    } catch (error) {
        console.error("Failed to load news:", error);
    }
}

document.addEventListener('DOMContentLoaded', loadNews);
