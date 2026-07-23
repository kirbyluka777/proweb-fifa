async function loadBallData() {
    const apiUrl = 'https://wc-api-u378.onrender.com/wc-api/api/v1/ball';
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        
        const data = await response.json();

        const images = Array.isArray(data.images_url) ? data.images_url.filter(Boolean) : [];
        const features = Array.isArray(data.features) ? data.features : [];
        const ballName = data.name || 'Balón oficial del torneo';
        const imgElement = document.getElementById('img');
        const titleElement = document.getElementById('title');
        const featureGrid = document.getElementById('feature-grid');

        titleElement.textContent = ballName;
        document.title = `${ballName} | Balón Oficial`;

        if (images.length > 0) {
            imgElement.src = images[0];
            imgElement.alt = ballName;
        } else {
            imgElement.remove();
        }

        featureGrid.replaceChildren();

        if (features.length > 0) {
            features.forEach((feature, index) => {
                const article = document.createElement('article');
                article.className = 'card feature-card';

                const heading = document.createElement('h3');
                heading.className = 'feature-card__title';
                heading.textContent = feature.title || `Característica ${index + 1}`;
                article.appendChild(heading);

                if (images.length > 0) {
                    const image = document.createElement('img');
                    image.className = 'feature-card__image';
                    image.src = images[index % images.length];
                    image.alt = feature.title
                        ? `${feature.title} — ${ballName}`
                        : ballName;
                    image.loading = 'lazy';
                    article.appendChild(image);
                }

                const body = document.createElement('div');
                body.className = 'feature-card__body';
                const descriptions = Array.isArray(feature.description)
                    ? feature.description
                    : [feature.description].filter(Boolean);

                descriptions.forEach((description) => {
                    const paragraph = document.createElement('p');
                    paragraph.textContent = description;
                    body.appendChild(paragraph);
                });

                article.appendChild(body);
                featureGrid.appendChild(article);
            });
        } else {
            const status = document.createElement('p');
            status.className = 'ball-status';
            status.textContent = 'Pronto habrá más información sobre este balón.';
            featureGrid.appendChild(status);
        }

    } catch (error) {
        console.error("Error populating ball data:", error);
        const featureGrid = document.getElementById('feature-grid');
        const status = document.createElement('p');
        status.className = 'ball-status';
        status.textContent = 'No se pudo cargar la información del balón.';
        featureGrid.replaceChildren(status);
    }
}

document.addEventListener('DOMContentLoaded', loadBallData);
