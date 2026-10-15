// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeStorageMode } from "../../storage/storageMode";
import { api, ApiError } from "../../api";
import {
  emptyTutorialProgress,
  TUTORIAL_LATER_KEY,
  TUTORIAL_STORAGE_KEY,
} from "./tutorialModel";
import TutorialPage from "./TutorialPage";
import { useTutorial } from "./tutorialContext";
import TutorialProvider from "./TutorialProvider";

vi.mock("../../api", async () => ({
  api: {
    chart: vi.fn(),
    createChart: vi.fn(),
    deleteChart: vi.fn(),
    createBackup: vi.fn(),
    markExported: vi.fn(),
    backupStatus: vi.fn(async () => ({
      chartCount: 0,
      lastExportedAt: null,
      daysSinceExport: null,
    })),
  },
  ApiError: (await import("../../api/errors")).ApiError,
}));

function PracticeRoute() {
  const tutorial = useTutorial();
  const location = useLocation();
  return (
    <>
      <div data-tutorial-target="charts-heading">一覧</div>
      <button
        data-tutorial-target="create-chart"
        onClick={() => tutorial.reportAction("chart-created", "practice-id")}
      >
        練習相関図を作成
      </button>
      <button
        data-tutorial-target="cohabitation"
        onClick={() =>
          tutorial.reportAction(
            "single-self-cohabitation-created",
            "practice-id",
          )
        }
      >
        本人の同居輪を作成
      </button>
      <button
        onClick={() =>
          tutorial.reportAction("single-self-cohabitation-created", "other-id")
        }
      >
        別の相関図で同居輪を作成
      </button>
      <span data-testid="location">{location.pathname}</span>
    </>
  );
}

function renderTutorial(initialEntry = "/tutorial") {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <TutorialProvider>
          <Routes>
            <Route path="/tutorial" element={<TutorialPage />} />
            <Route path="/charts" element={<PracticeRoute />} />
            <Route path="/charts/:id" element={<PracticeRoute />} />
          </Routes>
        </TutorialProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderFirstVisit() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/charts"]}>
        <TutorialProvider>
          <Routes>
            <Route path="/charts" element={<PracticeRoute />} />
            <Route path="/tutorial" element={<TutorialPage />} />
          </Routes>
        </TutorialProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("全体チュートリアル", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("章を開始し、実操作の完了を検知して次へ進む", async () => {
    writeStorageMode("persistent");
    renderTutorial();
    const firstChapter = screen
      .getByRole("heading", { name: "はじめに" })
      .closest("article")!;
    fireEvent.click(
      within(firstChapter).getByRole("button", { name: "次に進む" }),
    );

    expect(
      await screen.findByRole("heading", { name: "相関図一覧と保存方法" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /次へ/ }));
    expect(
      await screen.findByRole("heading", {
        name: "練習用の相関図を作りましょう",
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "練習相関図を作成" }));

    await vi.waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(
        "/charts/practice-id",
      ),
    );
    const saved = JSON.parse(localStorage.getItem(TUTORIAL_STORAGE_KEY)!);
    expect(saved.practiceChartId).toBe("practice-id");
    expect(saved.activeStepIndex).toBe(2);
    expect(saved.completedStepIds).toContain("create-practice-chart");
  });

  it("任意の章を途中で終了し、通常使用後も同じステップから再開できる", async () => {
    writeStorageMode("persistent");
    vi.mocked(api.chart).mockResolvedValue({
      id: "practice-id",
      title: "練習用相関図",
      nodes: [],
      edges: [],
    } as unknown as Awaited<ReturnType<typeof api.chart>>);
    localStorage.setItem(
      TUTORIAL_STORAGE_KEY,
      JSON.stringify({
        version: 4,
        completedChapters: [],
        completedStepIds: ["arrange-node"],
        skippedRequiredStepIds: [],
        activeChapterId: "layout",
        activeStepIndex: 1,
        practiceChartId: "practice-id",
        practiceChartKept: false,
        promptDisabled: false,
        upgradedFromV2: false,
      }),
    );
    renderTutorial("/charts/practice-id");
    expect(
      await screen.findByRole("heading", {
        name: "本人だけを同居輪で囲みましょう",
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("チュートリアルを終了して通常使用"));
    expect(screen.getByTestId("location").textContent).toBe("/charts");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(JSON.parse(localStorage.getItem(TUTORIAL_STORAGE_KEY)!).paused).toBe(
      true,
    );

    cleanup();
    renderTutorial("/charts");
    expect(screen.queryByRole("dialog")).toBeNull();
    cleanup();
    renderTutorial("/tutorial");
    const layoutChapter = screen
      .getByRole("heading", { name: "配置と表現" })
      .closest("article")!;
    fireEvent.click(
      within(layoutChapter).getByRole("button", { name: "再開" }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "本人だけを同居輪で囲みましょう",
      }),
    ).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(TUTORIAL_STORAGE_KEY)!).paused).toBe(
      false,
    );
  });

  it("実操作直後に終了しても予約されたステップ移動を実行しない", async () => {
    writeStorageMode("persistent");
    renderTutorial();
    const introChapter = screen
      .getByRole("heading", { name: "はじめに" })
      .closest("article")!;
    fireEvent.click(
      within(introChapter).getByRole("button", { name: "次に進む" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /次へ/ }));
    fireEvent.click(screen.getByRole("button", { name: "練習相関図を作成" }));
    fireEvent.click(screen.getByText("チュートリアルを終了して通常使用"));
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(screen.getByTestId("location").textContent).toBe("/charts");
    expect(screen.queryByRole("dialog")).toBeNull();
    const saved = JSON.parse(localStorage.getItem(TUTORIAL_STORAGE_KEY)!);
    expect(saved.paused).toBe(true);
    expect(saved.activeStepIndex).toBe(2);
    expect(saved.practiceChartId).toBe("practice-id");
  });

  it("停止後は未完了の別の章も任意に開始できる", async () => {
    writeStorageMode("persistent");
    localStorage.setItem(
      TUTORIAL_STORAGE_KEY,
      JSON.stringify({
        version: 4,
        completedChapters: [],
        completedStepIds: [],
        skippedRequiredStepIds: [],
        activeChapterId: "layout",
        activeStepIndex: 1,
        paused: true,
        practiceChartId: "practice-id",
        practiceChartKept: false,
        promptDisabled: false,
        upgradedFromV2: false,
      }),
    );
    renderTutorial("/tutorial");
    const introChapter = screen
      .getByRole("heading", { name: "はじめに" })
      .closest("article")!;
    fireEvent.click(
      within(introChapter).getByRole("button", { name: "次に進む" }),
    );
    expect(
      await screen.findByRole("heading", { name: "相関図一覧と保存方法" }),
    ).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem(TUTORIAL_STORAGE_KEY)!);
    expect(saved.activeChapterId).toBe("intro");
    expect(saved.activeStepIndex).toBe(0);
    expect(saved.paused).toBe(false);
  });

  it("初回の開始確認を後回しにすると、そのセッションでは再表示しない", async () => {
    writeStorageMode("persistent");
    renderFirstVisit();
    expect(
      await screen.findByRole("heading", {
        name: "Kakeizu Studio の使い方を練習しますか？",
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "後で" }));
    expect(sessionStorage.getItem(TUTORIAL_LATER_KEY)).toBe("true");
    expect(
      screen.queryByRole("heading", {
        name: "Kakeizu Studio の使い方を練習しますか？",
      }),
    ).toBeNull();
  });

  it("相関図作成をスキップした場合は練習用データを自動作成する", async () => {
    writeStorageMode("persistent");
    vi.mocked(api.createChart).mockResolvedValue({
      id: "auto-practice",
      title: "練習用相関図",
      nodeCount: 0,
      updatedAt: "2026-09-24T00:00:00.000Z",
    });
    renderTutorial();
    const firstChapter = screen
      .getByRole("heading", { name: "はじめに" })
      .closest("article")!;
    fireEvent.click(
      within(firstChapter).getByRole("button", { name: "次に進む" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /次へ/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "未習得としてスキップ" }),
    );
    await vi.waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(
        "/charts/auto-practice",
      ),
    );
    expect(api.createChart).toHaveBeenCalledWith("練習用相関図");
  });

  it("今後表示しない選択を進捗に保存する", async () => {
    writeStorageMode("persistent");
    renderFirstVisit();
    fireEvent.click(
      await screen.findByRole("button", { name: "今後表示しない" }),
    );
    const saved = JSON.parse(localStorage.getItem(TUTORIAL_STORAGE_KEY)!);
    expect(saved.promptDisabled).toBe(true);
  });

  it("練習用相関図の本人単独の同居輪でのみ次へ進む", async () => {
    writeStorageMode("persistent");
    localStorage.setItem(
      TUTORIAL_STORAGE_KEY,
      JSON.stringify({
        version: 4,
        completedChapters: [],
        completedStepIds: ["arrange-node"],
        skippedRequiredStepIds: [],
        activeChapterId: "layout",
        activeStepIndex: 1,
        practiceChartId: "practice-id",
        practiceChartKept: false,
        promptDisabled: false,
        upgradedFromV2: false,
      }),
    );
    renderTutorial("/charts/practice-id");

    expect(
      await screen.findByRole("heading", {
        name: "本人だけを同居輪で囲みましょう",
      }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "別の相関図で同居輪を作成" }),
    );
    expect(
      screen.getByRole("heading", {
        name: "本人だけを同居輪で囲みましょう",
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "本人の同居輪を作成" }));
    expect(
      await screen.findByRole("heading", {
        name: "複数の人物も同居輪で囲めます",
      }),
    ).toBeTruthy();
  });
});

describe("練習用相関図の読み込みエラー", () => {
  const replacement = {
    id: "replacement",
    title: "練習用相関図",
    nodeCount: 0,
    updatedAt: "2026-10-15T00:00:00Z",
  };
  function openPausedChapter() {
    writeStorageMode("persistent");
    const saved = {
      ...emptyTutorialProgress(),
      activeChapterId: "layout",
      activeStepIndex: 1,
      paused: true,
      practiceChartId: "practice-id",
      practiceChartKept: true,
      completedStepIds: ["arrange-node"],
    };
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(saved));
    renderTutorial();
    const chapter = screen
      .getByRole("heading", { name: "配置と表現" })
      .closest("article")!;
    fireEvent.click(within(chapter).getByRole("button", { name: "再開" }));
    return saved;
  }
  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.resetAllMocks();
  });

  it.each([
    new ApiError(500, "DOCUMENT_CORRUPTED", "保存データが壊れています"),
    new ApiError(409, "DOCUMENT_TOO_NEW", "新しいバージョンのデータです"),
    new DOMException("読み込みが拒否されました", "SecurityError"),
    new Error("ストレージを読み込めません"),
  ])("%s の場合は再作成せず進捗を保持する", async (error) => {
    vi.mocked(api.chart).mockRejectedValue(error);
    vi.mocked(api.createChart).mockResolvedValue(replacement);
    const saved = openPausedChapter();
    expect(
      await screen.findByText(/^チュートリアルを開始できませんでした。/),
    ).toBeTruthy();
    expect(api.createChart).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(TUTORIAL_STORAGE_KEY)!)).toEqual(
      saved,
    );
    expect(api.chart).toHaveBeenCalledWith("practice-id");
  });

  it("NOT_FOUND の場合だけ相関図を作り直して元のステップを再開する", async () => {
    vi.mocked(api.chart).mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "削除済みです"),
    );
    vi.mocked(api.createChart).mockResolvedValue(replacement);
    openPausedChapter();
    await vi.waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(
        "/charts/replacement",
      ),
    );
    expect(api.createChart).toHaveBeenCalledExactlyOnceWith("練習用相関図");
    expect(
      JSON.parse(localStorage.getItem(TUTORIAL_STORAGE_KEY)!),
    ).toMatchObject({
      practiceChartId: "replacement",
      practiceChartKept: false,
      activeChapterId: "layout",
      activeStepIndex: 1,
      paused: false,
      completedStepIds: ["arrange-node"],
    });
  });

  it("読み込める相関図は再作成せずに再利用する", async () => {
    vi.mocked(api.chart).mockResolvedValue({
      id: "practice-id",
      title: "練習用相関図",
      nodes: [],
      edges: [],
      relationships: [],
      genders: [],
      updatedAt: replacement.updatedAt,
      cohabitation: { version: 1, cohabitations: [], labels: [] },
    });
    openPausedChapter();
    await vi.waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(
        "/charts/practice-id",
      ),
    );
    expect(api.createChart).not.toHaveBeenCalled();
    expect(
      JSON.parse(localStorage.getItem(TUTORIAL_STORAGE_KEY)!),
    ).toMatchObject({
      practiceChartId: "practice-id",
      practiceChartKept: true,
      activeStepIndex: 1,
      paused: false,
    });
  });
});
