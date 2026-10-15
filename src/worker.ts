interface AssetEnvironment {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const securityHeaders = [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Cross-Origin-Opener-Policy",
];

export default {
  async fetch(request: Request, env: AssetEnvironment): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/assets/")) {
      if (
        response.status === 404 &&
        (request.method === "GET" || request.method === "HEAD")
      ) {
        url.pathname = "/";
        url.search = "";
        return env.ASSETS.fetch(new Request(url, request));
      }
      return response;
    }
    const readable = request.method === "GET" || request.method === "HEAD";
    if (
      readable &&
      response.status !== 404 &&
      !response.headers.get("Content-Type")?.includes("text/html")
    )
      return response;

    // A missing hashed asset must never cache the SPA HTML for a year.
    const headers = new Headers({
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    for (const name of securityHeaders) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (!readable) headers.set("Allow", "GET, HEAD");
    return new Response(request.method === "HEAD" ? null : "Not found", {
      status: readable ? 404 : 405,
      headers,
    });
  },
};
