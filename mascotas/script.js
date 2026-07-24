async function loadMascotasData() {
    // Endpoint específico para las mascotas en la API
    const apiUrl = 'https://wc-api-u378.onrender.com/wc-api/api/v1/mascots';

    const container = document.getElementById('mascotas-container');

    try {
        const response = await fetch(apiUrl);
        
        let responseToUse = response;
        if (!response.ok) {
            const fallbackApiUrl = 'https://wc-api-u378.onrender.com/wc-api/api/v1/mascotas';
            responseToUse = await fetch(fallbackApiUrl);
        }

        if (!responseToUse.ok) {
            throw new Error(`HTTP error! Status: ${responseToUse.status}`);
        }

        const data = await responseToUse.json();

        const mascotas = Array.isArray(data) ? data : (data.mascots || data.mascotas || []);

        container.replaceChildren();

        if (mascotas.length > 0) {
            mascotas.forEach((mascota, index) => {
                const article = document.createElement('article');
                article.className = 'card mascota-card';

                const heading = document.createElement('h3');
                heading.className = 'mascota-card__title';
                heading.textContent = mascota.name || `Mascota ${index + 1}`;
                article.appendChild(heading);

                const imageUrl = mascota.image_url || mascota.image || (Array.isArray(mascota.images) ? mascota.images[0] : null);
                if (imageUrl) {
                    const image = document.createElement('img');
                    image.className = 'mascota-card__image';
                    image.src = imageUrl;
                    image.alt = mascota.name ? `${mascota.name} — Mascotas Oficiales` : 'Mascota Oficial';
                    image.loading = 'lazy';
                    article.appendChild(image);
                }

                const body = document.createElement('div');
                body.className = 'mascota-card__body';

                if (mascota.country || mascota.host) {
                    const countryBadge = document.createElement('span');
                    countryBadge.className = 'mascota-card__country';
                    countryBadge.textContent = mascota.country || mascota.host;
                    body.appendChild(countryBadge);
                }

                const rawDescription = mascota.description || mascota.history || mascota.bio || '';
                const descriptions = Array.isArray(rawDescription)
                    ? rawDescription
                    : [rawDescription].filter(Boolean);

                descriptions.forEach((description) => {
                    const paragraph = document.createElement('p');
                    paragraph.textContent = description;
                    body.appendChild(paragraph);
                });

                article.appendChild(body);
                container.appendChild(article);
            });
        } else {
            const status = document.createElement('p');
            status.className = 'mascota-status';
            status.textContent = 'Pronto habrá más información sobre las mascotas oficiales.';
            container.appendChild(status);
        }

    } catch (error) {
        console.error("Error populating mascotas data:", error);
        if (container) {
            const status = document.createElement('p');
            status.className = 'mascota-status';
            status.textContent = 'Ocurrió un error al cargar la información de las mascotas.';
            container.replaceChildren(status);
        }
    }
}

document.addEventListener('DOMContentLoaded', loadMascotasData);