const NEWS_API = '/api/v1/news';

function renderNewsDetail(news) {
    const detail = document.getElementById('news-detail');
    const header = document.createElement('header');
    const date = document.createElement('p');
    const title = document.createElement('h1');
    const image = document.createElement('img');
    const body = document.createElement('div');
    const preview = document.createElement('p');
    const source = document.createElement('a');

    header.className = 'news-detail__header';
    date.className = 'news-detail__date';
    date.textContent = news.published_date;
    title.textContent = news.title;
    header.append(date, title);

    image.className = 'news-detail__image';
    image.src = news.image_url;
    image.alt = news.image_title || news.title;

    body.className = 'news-detail__body';
    preview.textContent = news.preview_text;
    source.className = 'btn news-source';
    source.href = news.url;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = 'Leer en FIFA.com';
    body.append(preview, source);

    detail.append(header, image, body);
    document.title = `${news.title} | Noticias`;
}

async function loadNewsDetail() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;

    const apiUrl = `${NEWS_API}/${encodeURIComponent(id)}`;
    renderNewsDetail(await fetchWithCache(apiUrl));
}

document.addEventListener('DOMContentLoaded', loadNewsDetail);
