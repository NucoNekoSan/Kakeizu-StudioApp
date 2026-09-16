// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import LegalPage from "./LegalPage";
import HelpPage from "../help/HelpPage";
import StorageModeGate from "../storage/StorageModeGate";

vi.mock("../../api", () => ({
  api: {
    backupStatus: vi.fn(async () => ({
      chartCount: 0,
      lastExportedAt: null,
      daysSinceExport: null,
    })),
  },
  ApiError: class ApiError extends Error {},
}));

const renderAt = (path: string, element: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={element} />
      </Routes>
    </MemoryRouter>,
  );

describe("法的文書ページ", () => {
  afterEach(cleanup);

  it("利用規約を表示する", () => {
    renderAt("/terms", <LegalPage slug="terms" />);
    expect(screen.getByRole("heading", { name: "利用規約" })).toBeTruthy();
    expect(screen.getByText(/第4条（免責）/)).toBeTruthy();
  });

  it("プライバシーポリシーを表示する", () => {
    renderAt("/privacy", <LegalPage slug="privacy" />);
    expect(
      screen.getByRole("heading", { name: "プライバシーポリシー" }),
    ).toBeTruthy();
    expect(screen.getByText(/個人情報を収集しません/)).toBeTruthy();
  });

  it("提供者情報が揃っていれば警告を出さない", () => {
    // 実際の設定に対する検証。プレースホルダを持ち込んだらここが落ちる
    renderAt("/terms", <LegalPage slug="terms" />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("設定した連絡先を文書に表示する", () => {
    renderAt("/privacy", <LegalPage slug="privacy" />);
    expect(
      screen.getByText(/連絡先: kakeizu@nuconeko-garden\.com/),
    ).toBeTruthy();
  });

  it("使い方に共有端末の案内がある", () => {
    renderAt("/help", <HelpPage />);
    expect(screen.getByText(/共有の端末で使い終えたら/)).toBeTruthy();
    expect(screen.getByText(/ログアウトがありません/)).toBeTruthy();
  });
});

describe("保存モード選択との関係", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("モード未選択でも規約を読める", () => {
    render(
      <MemoryRouter initialEntries={["/terms"]}>
        <StorageModeGate>
          <Routes>
            <Route path="/terms" element={<LegalPage slug="terms" />} />
          </Routes>
        </StorageModeGate>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "利用規約" })).toBeTruthy();
    expect(screen.queryByText(/この端末での保存方法/)).toBeNull();
  });

  it("モード未選択で通常の画面は保存方法の選択を出す", () => {
    render(
      <MemoryRouter initialEntries={["/charts"]}>
        <StorageModeGate>
          <Routes>
            <Route path="/charts" element={<p>相関図一覧</p>} />
          </Routes>
        </StorageModeGate>
      </MemoryRouter>,
    );
    expect(screen.getByText(/この端末での保存方法/)).toBeTruthy();
    expect(screen.queryByText("相関図一覧")).toBeNull();
  });

  it("保存方法の選択画面から文書へ行ける", () => {
    render(
      <MemoryRouter initialEntries={["/charts"]}>
        <StorageModeGate>
          <Routes>
            <Route path="/charts" element={<p>相関図一覧</p>} />
          </Routes>
        </StorageModeGate>
      </MemoryRouter>,
    );
    const links = screen.getAllByRole("link").map((link) => link.textContent);
    expect(links).toContain("利用規約");
    expect(links).toContain("プライバシーポリシー");
  });
});
