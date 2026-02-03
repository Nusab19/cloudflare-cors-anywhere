addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    const params = url.searchParams;
    
    // 1. Root Homepage
    if (url.pathname === "/" && !params.has("url")) {
        return new Response(`
            <h1>Proxy Active</h1>
            <p>Usage:</p>
            <pre>GET  /?pass=$PASSWORD&url=example.com</pre>
            <pre>POST /?pass=$PASSWORD&url=example.com&data={"key":"val"}</pre>
        `, {
            headers: { "Content-Type": "text/html" }
        });
    }

    const pass = params.get("pass");
    const targetUrl = params.get("url");

    // 2. Password Check
    // Note: PASSWORD must be set as a Secret or Environment Variable in Cloudflare
    if (!pass || pass !== (typeof PASSWORD !== 'undefined' ? PASSWORD : null)) {
        return new Response("Unauthorized", { status: 403 });
    }

    if (!targetUrl) {
        return new Response("Missing target URL", { status: 400 });
    }

    const isPreflight = request.method === "OPTIONS";

    // 3. Setup CORS Headers
    const corsHeaders = {
        "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "*"
    };

    if (isPreflight) {
        return new Response(null, { headers: corsHeaders });
    }

    // 4. Prepare Proxy Request
    const method = request.method;
    const bodyData = params.get("data");
    
    try {
        const proxyResponse = await fetch(targetUrl, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Cloudflare Worker"
            },
            body: (method === "POST" || method === "PUT") ? bodyData : null,
            redirect: "follow"
        });

        // 5. Return Response with CORS
        const responseHeaders = new Headers(proxyResponse.headers);
        Object.keys(corsHeaders).forEach(key => responseHeaders.set(key, corsHeaders[key]));

        return new Response(proxyResponse.body, {
            status: proxyResponse.status,
            statusText: proxyResponse.statusText,
            headers: responseHeaders
        });
    } catch (e) {
        return new Response("Error fetching target: " + e.message, { status: 500 });
    }
}
