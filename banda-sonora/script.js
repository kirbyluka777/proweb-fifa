const SOUND_API_URL = '/api/v1/sound';

function createSoundFeature(feature) {
    const article = document.createElement('article');
    const title = document.createElement('h3');
    const copy = document.createElement('div');
    const descriptions = Array.isArray(feature.description)
        ? feature.description
        : [feature.description].filter(Boolean);

    article.className = 'sound-feature';
    title.textContent = feature.title || 'El álbum oficial';
    copy.className = 'sound-feature__copy';
    copy.append(...descriptions.map(description => {
        const paragraph = document.createElement('p');
        paragraph.textContent = description;
        return paragraph;
    }));
    article.append(title, copy);
    return article;
}

function renderSound(data) {
    const title = document.querySelector('#sound-title');
    const resume = document.querySelector('#sound-resume');
    const image = document.querySelector('#sound-image');
    const primaryLink = document.querySelector('#sound-link');
    const secondaryLink = document.querySelector('#sound-secondary-link');
    const features = document.querySelector('#sound-features');
    const featureItems = Array.isArray(data.features) ? data.features : [];

    if (data.title) title.textContent = data.title;
    if (data.resume) resume.textContent = data.resume;

    if (data.image_url) {
        image.src = data.image_url;
        image.alt = data.title || 'Álbum oficial del Mundial 2026';
        image.hidden = false;
    }

    if (data.url) {
        primaryLink.href = data.url;
        secondaryLink.href = data.url;
    }

    if (featureItems.length) {
        features.replaceChildren(...featureItems.map(createSoundFeature));
    } else {
        const status = document.createElement('p');
        status.className = 'sound-status';
        status.textContent = 'Próximamente se publicará más información sobre el álbum.';
        features.replaceChildren(status);
    }
}

async function loadSound() {
    const features = document.querySelector('#sound-features');

    try {
        renderSound(await fetchWithCache(SOUND_API_URL));
    } catch (error) {
        console.error('No se pudo cargar la banda sonora:', error);
        const status = document.createElement('p');
        status.className = 'sound-status sound-status--error';
        status.textContent = 'No pudimos actualizar la información del álbum en este momento.';
        features.replaceChildren(status);
    } finally {
        features.setAttribute('aria-busy', 'false');
    }
}

document.addEventListener('DOMContentLoaded', loadSound);
