import type { Dispatch, SetStateAction } from "react";
import type { Node } from "@xyflow/react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  FileJson,
  FileImage,
  Lasso,
  Save,
  Settings as SettingsIcon,
  Type,
  Trash2,
} from "lucide-react";
import type { ChartDetail } from "../../types";
import type { FamilyNodeData } from "../../familyGraph";
import { Logo } from "../../components/ui";
import {
  GuidanceActions,
  ResourceActions,
} from "../../components/HeaderActions";
import { getErrorMessage } from "../../domain";
import { DEFAULT_FRAME_HEIGHT, DEFAULT_FRAME_WIDTH } from "../../frameSettings";
import { FrameSettings } from "./FrameSettings";
import { writeFrameVisibility } from "./frameVisibility";
import { getPngFramePreview } from "./pngExport";
import { clampNodeToFrame, nodeSize } from "./nodeLayout";
import type { useEditorPersistence } from "./useEditorPersistence";
import type { useCohabitationActions } from "./useCohabitationActions";
import { api } from "../../api";
import { hydrateChart } from "./hydrateChart";

interface Props {
  detail: ChartDetail;
  nodes: Node<FamilyNodeData>[];
  persistence: ReturnType<typeof useEditorPersistence>;
  actions: ReturnType<typeof useCohabitationActions>;
  frameVisible: boolean;
  setFrameVisible: Dispatch<SetStateAction<boolean>>;
  isExporting: boolean;
  previewPng: () => Promise<boolean>;
  onOpenExport: () => void;
  exportCurrentChart: () => Promise<void>;
  isJsonExporting: boolean;
}
export function EditorToolbar({
  detail,
  nodes,
  persistence,
  actions,
  frameVisible,
  setFrameVisible,
  isExporting,
  previewPng,
  onOpenExport,
  exportCurrentChart,
  isJsonExporting,
}: Props) {
  const nav = useNavigate();
  const {
    frame,
    titleValue,
    onTitleChange,
    saveTitle,
    saveState,
    flushAndWait,
  } = persistence;
  const {
    lassoMode,
    labelMode,
    setLassoMode,
    setLabelMode,
    selectedCohabitation,
    requestDeleteCohabitation,
  } = actions;
  return (
    <header className="editor-topbar">
      <div className="editor-heading" data-tutorial-target="editor-basics">
        <button
          className="icon"
          onClick={() => nav("/charts")}
          aria-label="一覧へ戻る"
          data-tooltip="相関図一覧へ戻る"
        >
          <ArrowLeft />
        </button>
        <Logo />
        <span className="top-divider" />
        <input
          className="title-input"
          aria-label="相関図タイトル"
          value={titleValue}
          onChange={(event) => onTitleChange(event.target.value)}
          onBlur={() => {
            void saveTitle().catch(() => undefined);
          }}
        />
        <div
          className={`save-state ${saveState}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <Save size={14} />
          {saveState === "saving"
            ? "保存中"
            : saveState === "error"
              ? "保存失敗"
              : "保存済み"}
        </div>
      </div>
      <GuidanceActions showContact />
      <div className="editor-actions">
        <div className="editor-action-group" role="group" aria-label="同居編集">
          <button
            className={`button ${lassoMode ? "active" : ""}`}
            data-tutorial-target="cohabitation"
            onClick={() => {
              setLassoMode((active) => !active);
              setLabelMode(false);
            }}
            aria-pressed={lassoMode}
            aria-label="同居輪"
            data-tooltip="同居輪を作成"
          >
            <Lasso size={17} />
            <span className="button-label">同居輪</span>
          </button>
          <button
            className={`button ${labelMode ? "active" : ""}`}
            data-tutorial-target="cohabitation-label"
            onClick={() => {
              setLabelMode((active) => !active);
              setLassoMode(false);
            }}
            aria-pressed={labelMode}
            aria-label="同居文字"
            data-tooltip="同居文字を追加"
          >
            <Type size={17} aria-hidden="true" />
            <span className="button-label">同居文字</span>
          </button>
          {selectedCohabitation && (
            <button
              className="button danger"
              onClick={requestDeleteCohabitation}
              aria-label="同居輪を削除"
              data-tooltip="選択中の同居輪を削除"
            >
              <Trash2 size={17} aria-hidden="true" />
              <span className="button-label">同居輪を削除</span>
            </button>
          )}
        </div>
        <div
          className="editor-action-group"
          role="group"
          aria-label="外枠とファイル書き出し"
          data-tutorial-target="editor-export"
        >
          <FrameSettings
            visible={frameVisible}
            width={detail.frameWidth ?? DEFAULT_FRAME_WIDTH}
            height={detail.frameHeight ?? DEFAULT_FRAME_HEIGHT}
            isSaving={frame.isPending}
            error={frame.error ? getErrorMessage(frame.error) : ""}
            willMove={(width, height) => {
              const bounds = getPngFramePreview(nodes, width, height);
              return nodes.some((node) => {
                const position = clampNodeToFrame(
                  node.position,
                  nodeSize(node),
                  bounds,
                );
                return (
                  position.x !== node.position.x ||
                  position.y !== node.position.y
                );
              });
            }}
            onApply={async (visible, width, height) => {
              frame.reset();
              if (
                width !== (detail?.frameWidth ?? DEFAULT_FRAME_WIDTH) ||
                height !== (detail?.frameHeight ?? DEFAULT_FRAME_HEIGHT)
              ) {
                await flushAndWait();
                const savedNodes = hydrateChart(
                  await api.chart(detail.id),
                ).nodes;
                const bounds = getPngFramePreview(savedNodes, width, height);
                const layouts = savedNodes.map((node) => ({
                  id: node.id,
                  scale: node.data.scale,
                  ...clampNodeToFrame(node.position, nodeSize(node), bounds),
                }));
                await frame.mutateAsync({ width, height, layouts });
              }
              writeFrameVisibility(visible);
              setFrameVisible(visible);
            }}
          />
          <button
            className="button"
            data-tutorial-target="editor-overview"
            onClick={previewPng}
            disabled={isExporting || frame.isPending}
            aria-label="全体プレビュー"
            data-tooltip="全体プレビュー"
          >
            <FileImage size={17} aria-hidden="true" />
            <span className="button-label">
              {isExporting ? "作成中…" : "全体プレビュー"}
            </span>
          </button>
          <button
            className="button primary"
            data-tutorial-target="editor-export"
            onClick={onOpenExport}
            disabled={isExporting || frame.isPending}
            aria-label="ファイル書き出し"
            data-tooltip="画像・PDFを書き出す"
          >
            <Download size={17} />
            <span className="button-label">
              {isExporting ? "作成中…" : "ファイル書き出し"}
            </span>
          </button>
        </div>
        <div
          className="editor-action-group"
          role="group"
          aria-label="データと設定"
        >
          <button
            className="button"
            data-tutorial-target="editor-json-export"
            onClick={() => void exportCurrentChart()}
            disabled={isJsonExporting}
            aria-label="表示中の相関図をJSONファイルに書き出す"
            data-tooltip="JSONファイル書き出し"
          >
            <FileJson size={17} aria-hidden="true" />
            <span className="button-label">
              {isJsonExporting ? "書き出し中…" : "JSONファイル書き出し"}
            </span>
          </button>
          <ResourceActions showContact={false} backupMode="none" />
          <button
            className="button"
            onClick={() => nav("/settings")}
            aria-label="表示設定"
            data-tooltip="表示設定"
          >
            <SettingsIcon size={17} />
            <span className="button-label">表示設定</span>
          </button>
        </div>
      </div>
    </header>
  );
}
