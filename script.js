/**
 * Fetch wrapper that caches JSON responses in localStorage.
 * 
 * @param {string} url - The API endpoint to fetch.
 * @param {number} ttl - Time to live in milliseconds (default: 1 hour).
 * @returns {Promise<any>} The parsed JSON data.
 */
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
    const data = fetchWithCache(url)

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