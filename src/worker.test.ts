import { expect, it, vi } from "vitest";
import worker from "./worker";

it.each(["GET", "HEAD"])(
  "%s: 存在しない資材のHTMLを404・no-storeへ置き換える",
  async (method) => {
    const fetch = vi.fn(
      async () =>
        new Response("<html>SPA</html>", {
          headers: {
            "Content-Type": "text/html",
            "Cache-Control": "public, max-age=31536000, immutable",
            ETag: "old-html",
            "Content-Security-Policy": "default-src 'self'",
          },
        }),
    );
    const response = await worker.fetch(
      new Request("https://example.test/assets/missing.js", { method }),
      { ASSETS: { fetch } },
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("ETag")).toBeNull();
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "default-src 'self'",
    );
    expect(await response.text()).toBe(method === "HEAD" ? "" : "Not found");
  },
);

it("正規のJSとSPA画面の応答を変更しない", async () => {
  for (const [path, type] of [
    ["/assets/present.js", "text/javascript"],
    ["/charts/123", "text/html"],
  ]) {
    const original = new Response("fixture", {
      headers: { "Content-Type": type, "Cache-Control": "original" },
    });
    const response = await worker.fetch(
      new Request("https://example.test" + path),
      { ASSETS: { fetch: async () => original } },
    );
    expect(response).toBe(original);
  }
});

it("実在資材は静的配信に任せ、存在しない画面URLだけをSPAへ渡す", async () => {
  const fetch = vi.fn(async (request: Request) =>
    new URL(request.url).pathname === "/"
      ? new Response("SPA root", { headers: { "Content-Type": "text/html" } })
      : new Response(null, { status: 404 }),
  );
  const response = await worker.fetch(
    new Request("https://example.test/charts/123?test=1"),
    { ASSETS: { fetch } },
  );
  expect(await response.text()).toBe("SPA root");
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(new URL(fetch.mock.calls[1][0].url).pathname).toBe("/");
  expect(new URL(fetch.mock.calls[1][0].url).search).toBe("");
});

it("ASSETSの本来の404もキャッシュさせず、許可されないメソッドはそのまま返す", async () => {
  const missing = await worker.fetch(
    new Request("https://example.test/assets/missing.css"),
    { ASSETS: { fetch: async () => new Response(null, { status: 404 }) } },
  );
  expect(missing.status).toBe(404);
  expect(missing.headers.get("Cache-Control")).toBe("no-store");
  const unsupported = new Response(null, { status: 405 });
  const rejected = await worker.fetch(
    new Request("https://example.test/assets/file.js", { method: "POST" }),
    { ASSETS: { fetch: async () => unsupported } },
  );
  expect(rejected.status).toBe(405);
  expect(rejected.headers.get("Allow")).toBe("GET, HEAD");
  expect(rejected.headers.get("Cache-Control")).toBe("no-store");
});
