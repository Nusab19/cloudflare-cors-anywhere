export default {
    async fetch(request, env) {
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
        let targetUrl = params.get("url");

        // 2. Password Check
        if (!pass || pass !== env.PASSWORD) {
            return new Response("Unauthorized", { status: 403 });
        }

        if (!targetUrl) {
            return new Response("Missing target URL", { status: 400 });
        }

        // 3. Automatic Protocol Injection
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
            targetUrl = "https://" + targetUrl;
        }

        const isPreflight = request.method === "OPTIONS";

        // 4. Setup CORS Headers
        const corsHeaders = {
            "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "*"
        };

        if (isPreflight) {
            return new Response(null, { headers: corsHeaders });
        }

        // 5. Prepare Proxy Request
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

            // 6. Return Response with CORS
            const responseHeaders = new Headers(proxyResponse.headers);
            Object.keys(corsHeaders).forEach(key => responseHeaders.set(key, corsHeaders[key]));

            return new Response(proxyResponse.body, {
                status: proxyResponse.status,
                statusText: proxyResponse.statusText,
                headers: responseHeaders
            });
        } catch (e) {
            return new Response("Error: " + e.message, { status: 500 });
        }
    }
};
