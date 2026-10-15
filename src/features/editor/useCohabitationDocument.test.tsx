// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import type { ChartDetail } from "../../types";
import { emptyCohabitationDocument } from "../../cohabitation";
import { useCohabitationDocument } from "./useCohabitationDocument";
vi.mock("../../api", () => ({ api: { updateCohabitation: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const detail: ChartDetail = {
  id: "one",
  title: "家族",
  updatedAt: "",
  nodes: [],
  edges: [],
  relationships: [],
  genders: [],
  cohabitation: emptyCohabitationDocument(),
};
const label = { id: "label", x: 1, y: 2, fontSize: 20 };
function wrapper() {
  const client = new QueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
describe("useCohabitationDocument", () => {
  it("hydrates and persists through the API, including final deletion", async () => {
    vi.mocked(api.updateCohabitation).mockImplementation(
      async (_, cohabitation) => ({ ...detail, cohabitation }),
    );
    const { result } = renderHook(
      () => useCohabitationDocument("one", detail),
      { wrapper: wrapper() },
    );
    act(() => result.current.setCohabitationLabels([label]));
    await waitFor(() => expect(result.current.isDirty).toBe(false));
    expect(api.updateCohabitation).toHaveBeenLastCalledWith("one", {
      ...emptyCohabitationDocument(),
      labels: [label],
    });
    act(() => result.current.setCohabitationLabels([]));
    await waitFor(() => expect(result.current.isDirty).toBe(false));
    expect(api.updateCohabitation).toHaveBeenLastCalledWith(
      "one",
      emptyCohabitationDocument(),
    );
  });
  it("keeps dirty data on failure and retries on flush", async () => {
    vi.mocked(api.updateCohabitation).mockRejectedValueOnce(
      new Error("quota exceeded"),
    );
    const { result } = renderHook(
      () => useCohabitationDocument("one", detail),
      { wrapper: wrapper() },
    );
    act(() => result.current.setCohabitationLabels([label]));
    await waitFor(() => expect(result.current.storageError).toBe(true));
    expect(result.current.isDirty).toBe(true);
    expect(result.current.cohabitationLabels).toEqual([label]);
    vi.mocked(api.updateCohabitation).mockResolvedValue({
      ...detail,
      cohabitation: { ...emptyCohabitationDocument(), labels: [label] },
    });
    await act(() => result.current.flushAndWait());
    expect(result.current.isDirty).toBe(false);
  });
  it("does not replace a newer draft with an older save response", async () => {
    const completions: ((value: ChartDetail) => void)[] = [];
    vi.mocked(api.updateCohabitation).mockImplementation(
      () => new Promise((resolve) => completions.push(resolve)),
    );
    const { result } = renderHook(
      () => useCohabitationDocument("one", detail),
      { wrapper: wrapper() },
    );
    act(() => result.current.setCohabitationLabels([label]));
    await waitFor(() => expect(completions).toHaveLength(1));
    act(() => result.current.setCohabitationLabels([{ ...label, x: 99 }]));
    await waitFor(() => expect(completions).toHaveLength(2));
    await act(async () =>
      completions[0]({
        ...detail,
        cohabitation: { ...emptyCohabitationDocument(), labels: [label] },
      }),
    );
    expect(result.current.cohabitationLabels[0].x).toBe(99);
    expect(result.current.isDirty).toBe(true);
    await act(async () =>
      completions[1]({
        ...detail,
        cohabitation: {
          ...emptyCohabitationDocument(),
          labels: [{ ...label, x: 99 }],
        },
      }),
    );
    expect(result.current.isDirty).toBe(false);
  });
  it("clears an old document error when a newer snapshot succeeds", async () => {
    let rejectFirst!: (error: Error) => void,
      resolveSecond!: (value: ChartDetail) => void;
    vi.mocked(api.updateCohabitation)
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );
    const { result } = renderHook(
      () => useCohabitationDocument("one", detail),
      { wrapper: wrapper() },
    );
    act(() => result.current.setCohabitationLabels([label]));
    await waitFor(() => expect(api.updateCohabitation).toHaveBeenCalledOnce());
    const latest = { ...label, x: 99 };
    act(() => result.current.setCohabitationLabels([latest]));
    await waitFor(() =>
      expect(api.updateCohabitation).toHaveBeenCalledTimes(2),
    );
    await act(async () => {
      rejectFirst(new Error("old"));
      resolveSecond({
        ...detail,
        cohabitation: { ...emptyCohabitationDocument(), labels: [latest] },
      });
    });
    await act(() => result.current.flushAndWait());
    expect(result.current.storageError).toBe(false);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.cohabitationLabels).toEqual([latest]);
  });
});
