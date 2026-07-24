const UPSTREAM_API = 'https://wc-api-u378.onrender.com/wc-api/api';

export async function onRequest(context) {
    const { request } = context;

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', {
            status: 405,
            headers: { Allow: 'GET, HEAD' }
        });
    }

    const incomingUrl = new URL(request.url);
    const apiPath = incomingUrl.pathname.replace(/^\/api(?=\/|$)/, '');
    const upstreamUrl = new URL(`${UPSTREAM_API}${apiPath}${incomingUrl.search}`);

    let upstreamResponse;

    try {
        upstreamResponse = await fetch(upstreamUrl, {
            method: request.method,
            headers: {
                Accept: request.headers.get('Accept') || 'application/json'
            },
            redirect: 'follow'
        });
    } catch (error) {
        console.error('World Cup API request failed:', error);
        return Response.json(
            { error: 'The upstream API is temporarily unavailable.' },
            { status: 502 }
        );
    }

    const headers = new Headers();
    const contentType = upstreamResponse.headers.get('Content-Type');
    const cacheControl = upstreamResponse.headers.get('Cache-Control');

    if (contentType) headers.set('Content-Type', contentType);
    headers.set('Cache-Control', cacheControl || 'public, max-age=300');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Vary', 'Accept');

    return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers
    });
}
