// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * 未設定の項目がある状態の警告表示。
 *
 * 実際の publisher.ts は設定済みのため、この状態は差し替えでしか作れない。
 * 実設定に依存しないので、将来どちらの状態でも意味を持ち続ける。
 */
vi.mock("./publisher", () => ({
  PUBLISHER_PLACEHOLDER: "__未設定__",
  publisher: {
    name: "__未設定__",
    email: "__未設定__",
    revisedOn: "2026-09-16",
  },
  isPlaceholder: (value: string) => value.includes("__未設定__"),
  unsetPublisherFields: () => ["提供者名", "連絡先"],
  hasUnsetPublisherFields: () => true,
}));

const { default: LegalPage } = await import("./LegalPage");

describe("提供者情報が未設定のとき", () => {
  afterEach(cleanup);

  it("何が足りないかを名指しして警告する", () => {
    render(
      <MemoryRouter>
        <LegalPage slug="terms" />
      </MemoryRouter>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("提供者名");
    expect(alert.textContent).toContain("連絡先");
    // 直すべき場所が分かるように、ファイル名まで出す
    expect(alert.textContent).toContain("publisher.ts");
  });
});
