// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "../../App";
import { createIndexedDbStore } from "../../storage/kv";
import { resetStoreCache } from "../../storage/localApi";
import { writeStorageMode } from "../../storage/storageMode";

vi.mock("../../storage/kv", async (original) => ({
  ...(await original<typeof import("../../storage/kv")>()),
  createIndexedDbStore: vi.fn(),
}));
vi.mock("../tutorial/TutorialProvider", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
// An unresolved lazy module reproduces a cold/slow editor chunk without timers.
vi.mock("../editor/ChartEditor", () => new Promise(() => {}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetStoreCache();
  vi.mocked(createIndexedDbStore).mockReset();
  vi.mocked(createIndexedDbStore).mockRejectedValue(
    new Error("storage blocked"),
  );
});
afterEach(() => {
  cleanup();
  resetStoreCache();
});

const guarded = () => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};
function renderApp() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false, staleTime: 20_000, gcTime: 0 },
          },
        })
      }
    >
      <MemoryRouter initialEntries={["/charts"]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it.each(["session", "persistent"] as const)(
  "%s: 実際のAppのlazyエディターが保留中でも作成直後から保護を維持する",
  async (mode) => {
    writeStorageMode(mode);
    const view = renderApp();
    expect(guarded()).toBe(false);
    fireEvent.click(
      await screen.findByRole("button", { name: "新しい相関図" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "タイトル" }), {
      target: { value: "読み込み中も守る" },
    });
    fireEvent.click(screen.getByRole("button", { name: "作成する" }));
    await screen.findByText("エディターを読み込んでいます");
    expect(screen.queryByText(/一時利用モードです/)).toBeNull();
    await waitFor(() => expect(guarded()).toBe(true));
    view.unmount();
    expect(guarded()).toBe(false);
  },
);

it("保存方法を選ぶ前にはストアを初期化しない", async () => {
  renderApp();
  await screen.findByRole("heading", {
    name: "この端末での保存方法を選んでください",
  });
  expect(createIndexedDbStore).not.toHaveBeenCalled();
  expect(guarded()).toBe(false);
});
