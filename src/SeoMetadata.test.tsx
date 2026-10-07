// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import SeoMetadata from "./SeoMetadata";

function renderPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SeoMetadata />
      <Routes>
        <Route path="*" element={<div />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  document.head.querySelector('link[rel="canonical"]')?.remove();
  document.head.querySelector('meta[name="robots"]')?.remove();
});

describe("検索用メタデータ", () => {
  it.each(["/charts", "/help", "/terms", "/privacy"])(
    "%s は検索対象にする",
    async (path) => {
      renderPath(path);
      await waitFor(() =>
        expect(
          document.head
            .querySelector('meta[name="robots"]')
            ?.getAttribute("content"),
        ).toBe("index, follow"),
      );
      expect(
        document.head
          .querySelector('link[rel="canonical"]')
          ?.getAttribute("href"),
      ).toBe(`https://kakeizu-studioapp.nuconeko-garden.com${path}`);
      expect(document.title).toContain("Kakeizu Studio");
    },
  );

  it("利用者固有の編集画面は検索対象から外す", async () => {
    renderPath("/charts/personal-chart");
    await waitFor(() =>
      expect(
        document.head
          .querySelector('meta[name="robots"]')
          ?.getAttribute("content"),
      ).toBe("noindex, follow"),
    );
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
