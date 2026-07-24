async function fetchWithCache(url, ttl = 60 * 60 * 1000) {
    const cacheKey = `cache_${url}`;
    const cachedItem = localStorage.getItem(cacheKey);

    if (cachedItem) {
        const { data, expiry } = JSON.parse(cachedItem);
        const now = new Date().getTime();

        if (now < expiry) {
            console.log(`[Cache Hit] Serving from cache: ${url}`);
            return data;
        } else {
            console.log(`[Cache Expired] Removing old data for: ${url}`);
            localStorage.removeItem(cacheKey);
        }
    }

    console.log(`[Network Request] Fetching new data: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    const cacheData = {
        data: data,
        expiry: new Date().getTime() + ttl
    };

    try {
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (e) {
        console.warn("Could not save to localStorage. Cache might be full.", e);
    }

    return data;
}

document.addEventListener('DOMContentLoaded', () => {
    const pullTab = document.querySelector('.pull-tab');

    if (!pullTab) return;

    pullTab.addEventListener('click', (e) => {
        const isExpanded = pullTab.classList.contains('is-expanded');
        const clickedOnIcon = e.target.closest('.tab-icon');

        if (!isExpanded) {
            e.preventDefault();
            pullTab.classList.add('is-expanded');
        } else {
            if (clickedOnIcon) {
                e.preventDefault();
                pullTab.classList.remove('is-expanded');
            }
        }
    });
    document.addEventListener('click', (e) => {
        if (!pullTab.contains(e.target)) {
            pullTab.classList.remove('is-expanded');
        }
    });
    window.addEventListener('scroll', () => {
        if (pullTab.classList.contains('is-expanded')) {
            pullTab.classList.remove('is-expanded');
        }
    }, { passive: true });
});
