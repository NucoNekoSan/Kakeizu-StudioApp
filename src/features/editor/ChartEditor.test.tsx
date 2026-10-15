// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Node } from "@xyflow/react";
import type { FamilyNodeData } from "../../familyGraph";
import { api } from "../../api";
import { saveJsonFile } from "../../storage/fileIo";
import ChartEditor from "./ChartEditor";

vi.mock("../../api", async () => {
  const { createLocalApi } = await import("../../storage/localApi");
  const { createMemoryStore } = await import("../../storage/kv");
  const { ApiError } = await import("../../api/errors");
  return { api: createLocalApi(createMemoryStore()), ApiError };
});
vi.mock("../../storage/fileIo", () => ({
  saveJsonFile: vi.fn(async () => true),
  prepareFileSave: vi.fn(async () => ({ save: vi.fn() })),
}));
vi.mock("@xyflow/react", async () => {
  const actual =
    await vi.importActual<typeof import("@xyflow/react")>("@xyflow/react");
  return {
    ...actual,
    ReactFlow: ({
      nodes,
      onNodeClick,
    }: {
      nodes: Node<FamilyNodeData>[];
      onNodeClick: (event: unknown, node: Node<FamilyNodeData>) => void;
    }) => (
      <div className="react-flow__viewport">
        {nodes
          .filter((node) => node.type === "family")
          .map((node) => (
            <button
              key={node.id}
              onClick={() => onNodeClick(null, node)}
              aria-label="人物を選択"
            >
              {node.data.memo}
            </button>
          ))}
      </div>
    ),
  };
});

let chartId: string;
beforeEach(async () => {
  await api.clearAllData();
  const chart = await api.createChart("家族");
  chartId = chart.id;
  const relationships = await api.relationships(),
    genders = await api.genders();
  await api.createNode(chartId, {
    relationshipId: relationships[0].id,
    genderId: genders[0].id,
    anchorNodeId: null,
    parentNodeId1: null,
    parentNodeId2: null,
    placementDirection: null,
    connectionDirection: null,
    divorced: false,
    memo: "元のメモ",
    fontSize: 16,
    relationshipFontSize: 17,
    scale: 1,
    x: 20,
    y: 30,
  });
});
afterEach(async () => {
  cleanup();
  await Promise.resolve();
  await api.charts();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
function SwitchChart({ id }: { id: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(`/charts/${id}`)}>別の図へ</button>;
}
function openEditor(otherId?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/charts/${chartId}`]}>
        {otherId && <SwitchChart id={otherId} />}
        <Routes>
          <Route path="/charts/:id" element={<ChartEditor />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const exportButton = () =>
  screen.getByRole("button", {
    name: "表示中の相関図をJSONファイルに書き出す",
  });

describe("ChartEditor persistence integration", () => {
  it("exports the newest memo and title immediately after editing", async () => {
    openEditor();
    fireEvent.click(await screen.findByRole("button", { name: "人物を選択" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^メモ/ }), {
      target: { value: "出力直前の編集" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "相関図タイトル" }), {
      target: { value: "新しい題名" },
    });
    fireEvent.click(exportButton());
    await waitFor(() => expect(saveJsonFile).toHaveBeenCalledOnce());
    const backup = JSON.parse(vi.mocked(saveJsonFile).mock.calls[0][1]);
    expect(backup.charts[0]).toMatchObject({
      title: "新しい題名",
      nodes: [{ memo: "出力直前の編集" }],
    });
  });
  it("persists a title reverted while an earlier save is pending", async () => {
    const realUpdate = api.updateChart;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const update = vi
      .spyOn(api, "updateChart")
      .mockImplementationOnce(async (...args) => {
        await gate;
        return realUpdate(...args);
      });
    openEditor();
    const title = await screen.findByRole("textbox", {
      name: "相関図タイトル",
    });
    fireEvent.change(title, { target: { value: "保存中の題名" } });
    fireEvent.blur(title);
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    fireEvent.change(title, { target: { value: "家族" } });
    fireEvent.click(exportButton());
    expect(saveJsonFile).not.toHaveBeenCalled();
    await act(async () => release());
    await waitFor(() => expect(saveJsonFile).toHaveBeenCalledOnce());
    expect(title).toHaveValue("家族");
    expect((await api.chart(chartId)).title).toBe("家族");
    expect(
      JSON.parse(vi.mocked(saveJsonFile).mock.calls[0][1]).charts[0].title,
    ).toBe("家族");
  });
  it("exports without another edit after a failed write is replaced by a successful newer draft", async () => {
    let fail!: (error: Error) => void;
    const gate = new Promise<never>((_, reject) => {
      fail = reject;
    });
    const update = vi
      .spyOn(api, "updateNode")
      .mockImplementationOnce(() => gate);
    openEditor();
    fireEvent.click(await screen.findByRole("button", { name: "人物を選択" }));
    const memo = screen.getByRole("textbox", { name: /^メモ/ });
    fireEvent.change(memo, { target: { value: "先の編集" } });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    fireEvent.change(memo, { target: { value: "最新の編集" } });
    fireEvent.click(exportButton());
    await act(async () => {
      await Promise.resolve();
      fail(new Error("先行保存失敗"));
    });
    await waitFor(() => expect(saveJsonFile).toHaveBeenCalledOnce());
    expect(
      JSON.parse(vi.mocked(saveJsonFile).mock.calls[0][1]).charts[0].nodes[0]
        .memo,
    ).toBe("最新の編集");
    await screen.findByText("保存済み");
    expect(screen.queryByText("保存失敗")).toBeNull();
    fireEvent.click(exportButton());
    await waitFor(() => expect(saveJsonFile).toHaveBeenCalledTimes(2));
  });
  it("keeps the latest draft and blocks output when both overlapping saves fail", async () => {
    let fail!: (error: Error) => void;
    const gate = new Promise<never>((_, reject) => {
      fail = reject;
    });
    const update = vi
      .spyOn(api, "updateNode")
      .mockImplementationOnce(() => gate)
      .mockRejectedValueOnce(new Error("最新保存失敗"));
    openEditor();
    fireEvent.click(await screen.findByRole("button", { name: "人物を選択" }));
    const memo = screen.getByRole("textbox", { name: /^メモ/ });
    fireEvent.change(memo, { target: { value: "先の編集" } });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    fireEvent.change(memo, { target: { value: "保持する最新編集" } });
    fireEvent.click(exportButton());
    await act(async () => {
      await Promise.resolve();
      fail(new Error("先行保存失敗"));
    });
    await screen.findByText(/JSONファイルを書き出せませんでした/);
    expect(saveJsonFile).not.toHaveBeenCalled();
    expect(memo).toHaveValue("保持する最新編集");
    expect(screen.getByText("保存失敗")).toBeTruthy();
  });
  it("keeps a newer draft when an older save finishes, and waits for all saves", async () => {
    const realUpdate = api.updateNode;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const update = vi
      .spyOn(api, "updateNode")
      .mockImplementationOnce(async (...args) => {
        await gate;
        return realUpdate(...args);
      });
    openEditor();
    fireEvent.click(await screen.findByRole("button", { name: "人物を選択" }));
    const memo = screen.getByRole("textbox", { name: /^メモ/ });
    fireEvent.change(memo, { target: { value: "先の編集" } });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    fireEvent.change(memo, { target: { value: "後の編集" } });
    fireEvent.click(exportButton());
    expect(saveJsonFile).not.toHaveBeenCalled();
    await act(async () => release());
    await waitFor(() => expect(saveJsonFile).toHaveBeenCalledOnce());
    expect(memo).toHaveValue("後の編集");
    expect(
      JSON.parse(vi.mocked(saveJsonFile).mock.calls[0][1]).charts[0].nodes[0]
        .memo,
    ).toBe("後の編集");
  });
  it("retains the draft and stops export on save failure, then allows retry", async () => {
    vi.spyOn(api, "updateNode").mockRejectedValueOnce(new Error("保存不可"));
    openEditor();
    fireEvent.click(await screen.findByRole("button", { name: "人物を選択" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^メモ/ }), {
      target: { value: "未保存の内容" },
    });
    fireEvent.click(exportButton());
    await screen.findByText(/JSONファイルを書き出せませんでした/);
    expect(saveJsonFile).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: /^メモ/ })).toHaveValue(
      "未保存の内容",
    );
    fireEvent.click(exportButton());
    await waitFor(() => expect(saveJsonFile).toHaveBeenCalledOnce());
  });
  it("isolates drafts and title state when switching charts", async () => {
    const other = await api.createChart("別の家族");
    openEditor(other.id);
    fireEvent.click(await screen.findByRole("button", { name: "人物を選択" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^メモ/ }), {
      target: { value: "移動前の編集" },
    });
    fireEvent.click(screen.getByRole("button", { name: "別の図へ" }));
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "相関図タイトル" }),
      ).toHaveValue("別の家族"),
    );
    await waitFor(async () =>
      expect((await api.chart(chartId)).nodes[0].memo).toBe("移動前の編集"),
    );
    expect((await api.chart(other.id)).nodes).toEqual([]);
    expect(screen.queryByRole("button", { name: "人物を選択" })).toBeNull();
  });
  it("makes cohabitation tools exclusive and protects text inputs from Delete", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    openEditor();
    await screen.findByRole("button", { name: "人物を選択" });
    fireEvent.click(screen.getByRole("button", { name: "同居輪" }));
    fireEvent.click(screen.getByRole("button", { name: "同居文字" }));
    expect(screen.getByRole("button", { name: "同居輪" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "同居文字" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /本人/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "選択した人物を同居輪で囲む" }),
    );
    fireEvent.keyDown(screen.getByRole("textbox", { name: "相関図タイトル" }), {
      key: "Delete",
    });
    expect(window.confirm).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Delete" });
    expect(window.confirm).toHaveBeenCalledOnce();
    await waitFor(async () =>
      expect((await api.chart(chartId)).cohabitation?.cohabitations).toEqual(
        [],
      ),
    );
  });
  it("persists a new cohabitation group and includes it in JSON", async () => {
    openEditor();
    await screen.findByRole("button", { name: "人物を選択" });
    fireEvent.click(screen.getByRole("checkbox", { name: /本人/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "選択した人物を同居輪で囲む" }),
    );
    fireEvent.click(exportButton());
    await waitFor(() => expect(saveJsonFile).toHaveBeenCalledOnce());
    const group = JSON.parse(vi.mocked(saveJsonFile).mock.calls[0][1]).charts[0]
      .cohabitation.cohabitations[0];
    expect(group.nodeIds).toHaveLength(1);
    expect((await api.chart(chartId)).cohabitation?.cohabitations).toHaveLength(
      1,
    );
  });
});
