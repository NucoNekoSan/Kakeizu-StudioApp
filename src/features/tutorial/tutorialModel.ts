export type TutorialChapterId =
  "intro" | "family" | "layout" | "output" | "data";
export type TutorialStepKind = "explanation" | "action" | "simulation";
export type TutorialAction =
  | "chart-created"
  | "self-created"
  | "person-edited"
  | "partner-created"
  | "child-created"
  | "node-arranged"
  | "single-self-cohabitation-created"
  | "multi-cohabitation-created"
  | "cohabitation-label-created"
  | "overview-previewed"
  | "file-exported"
  | "json-exported"
  | "backup-exported"
  | "simulation-completed";

export interface TutorialStep {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly route:
    | "charts"
    | "editor"
    | "settings"
    | "file-import"
    | "data-management"
    | "help";
  readonly target: string;
  readonly kind: TutorialStepKind;
  readonly required?: boolean;
  readonly action?: TutorialAction;
  readonly simulationLabel?: string;
}
export interface TutorialChapter {
  readonly id: TutorialChapterId;
  readonly title: string;
  readonly summary: string;
  readonly minutes: number;
  readonly steps: readonly TutorialStep[];
}

export const TUTORIAL_VERSION = 4;
export const TUTORIAL_STORAGE_KEY = `kakeizu:tutorial:v${TUTORIAL_VERSION}`;
export const PREVIOUS_TUTORIAL_STORAGE_KEY = "kakeizu:tutorial:v3";
export const LEGACY_TUTORIAL_STORAGE_KEY = "kakeizu:tutorial:v2";
export const TUTORIAL_LATER_KEY = `kakeizu:tutorial-later:v${TUTORIAL_VERSION}`;
export interface TutorialProgress {
  readonly version: typeof TUTORIAL_VERSION;
  readonly completedChapters: readonly TutorialChapterId[];
  readonly completedStepIds: readonly string[];
  readonly skippedRequiredStepIds: readonly string[];
  readonly activeChapterId: TutorialChapterId | null;
  readonly activeStepIndex: number;
  readonly paused?: boolean;
  readonly practiceChartId: string | null;
  readonly practiceChartKept: boolean;
  readonly promptDisabled: boolean;
  readonly upgradedFromV2: boolean;
}
export const emptyTutorialProgress = (): TutorialProgress => ({
  version: TUTORIAL_VERSION,
  completedChapters: [],
  completedStepIds: [],
  skippedRequiredStepIds: [],
  activeChapterId: null,
  activeStepIndex: 0,
  paused: false,
  practiceChartId: null,
  practiceChartKept: false,
  promptDisabled: false,
  upgradedFromV2: false,
});

export const tutorialChapters: readonly TutorialChapter[] = [
  {
    id: "intro",
    title: "はじめに",
    minutes: 3,
    summary: "保存方法と画面構成を知り、練習用の相関図を作ります。",
    steps: [
      {
        id: "charts-overview",
        title: "相関図一覧と保存方法",
        body: "相関図は選択した保存方法に従って、この一覧に表示されます。カードを選ぶと編集画面を開けます。",
        route: "charts",
        target: "charts-heading",
        kind: "explanation",
      },
      {
        id: "create-practice-chart",
        title: "練習用の相関図を作りましょう",
        body: "「新しい相関図」を押し、分かりやすいタイトルを入力して作成してください。",
        route: "charts",
        target: "create-chart",
        kind: "action",
        required: true,
        action: "chart-created",
      },
      {
        id: "automatic-save",
        title: "変更内容は自動保存されます",
        body: "タイトルや人物を変更すると、この端末へ自動保存されます。上部の保存状態も確認してください。",
        route: "editor",
        target: "editor-basics",
        kind: "explanation",
      },
    ],
  },
  {
    id: "family",
    title: "人物と家族関係",
    minutes: 7,
    summary: "本人・配偶者・子を追加し、人物編集とつながりを練習します。",
    steps: [
      {
        id: "add-self",
        title: "本人を追加しましょう",
        body: "続柄で「本人」を選び、「自動配置して追加」を押してください。",
        route: "editor",
        target: "add-person",
        kind: "action",
        required: true,
        action: "self-created",
      },
      {
        id: "edit-self",
        title: "本人の情報を編集しましょう",
        body: "本人カードを選び、編集タブで氏名またはメモを変更して保存してください。",
        route: "editor",
        target: "edit-person",
        kind: "action",
        required: true,
        action: "person-edited",
      },
      {
        id: "add-partner",
        title: "配偶者を追加しましょう",
        body: "本人を選び、「配偶者を追加」から人物を作成してください。婚姻のつながりが自動で表示されます。",
        route: "editor",
        target: "quick-add",
        kind: "action",
        required: true,
        action: "partner-created",
      },
      {
        id: "add-child",
        title: "子を追加しましょう",
        body: "本人を選び、「子を追加」からもう一方の親に配偶者を指定して追加してください。",
        route: "editor",
        target: "quick-add",
        kind: "action",
        required: true,
        action: "child-created",
      },
      {
        id: "delete-safety",
        title: "削除は接続線にも反映されます",
        body: "人物を削除すると、その人物につながる線も削除されます。練習では場所だけ確認し、削除しません。",
        route: "editor",
        target: "edit-person",
        kind: "explanation",
      },
    ],
  },
  {
    id: "layout",
    title: "配置と表現",
    minutes: 5,
    summary: "人物の配置、同居輪、同居文字、外枠を整えます。",
    steps: [
      {
        id: "arrange-node",
        title: "人物をドラッグして配置しましょう",
        body: "人物カードを少し移動してください。選択時のハンドルから大きさも調整できます。",
        route: "editor",
        target: "canvas",
        kind: "action",
        required: true,
        action: "node-arranged",
      },
      {
        id: "single-cohabitation",
        title: "本人だけを同居輪で囲みましょう",
        body: "「同居輪」を選び、本人だけを囲んでください。1人でも同居輪を作成できます。",
        route: "editor",
        target: "cohabitation",
        kind: "action",
        required: true,
        action: "single-self-cohabitation-created",
      },
      {
        id: "multi-cohabitation",
        title: "複数の人物も同居輪で囲めます",
        body: "本人と配偶者など、2人以上を囲む同居輪を作成してください。",
        route: "editor",
        target: "cohabitation",
        kind: "action",
        required: true,
        action: "multi-cohabitation-created",
      },
      {
        id: "cohabitation-label",
        title: "同居文字を追加しましょう",
        body: "「同居文字」を選び、キャンバス上に文字を追加してください。",
        route: "editor",
        target: "cohabitation-label",
        kind: "action",
        required: true,
        action: "cohabitation-label-created",
      },
      {
        id: "frame-overview",
        title: "外枠とキャンバス表示を整えられます",
        body: "外枠では書き出す画像の横幅・縦幅と表示状態を調整できます。",
        route: "editor",
        target: "editor-export",
        kind: "explanation",
      },
    ],
  },
  {
    id: "output",
    title: "仕上げと出力",
    minutes: 3,
    summary: "全体を確認して画像・PDFとJSONを書き出し、表示設定を体験します。",
    steps: [
      {
        id: "overview-preview",
        title: "全体プレビューを確認しましょう",
        body: "全体プレビューを開き、外枠内にすべての人物が収まっていることを確認してください。確認後は「編集に戻る」で閉じます。",
        route: "editor",
        target: "editor-overview",
        kind: "action",
        required: true,
        action: "overview-previewed",
      },
      {
        id: "file-export",
        title: "ファイルを書き出しましょう",
        body: "「ファイル書き出し」から透過PNG・白背景PNG・JPEG・PDFのいずれかを選んで保存してください。対応ブラウザでは保存場所を選べます。保存をキャンセルした場合は完了になりません。",
        route: "editor",
        target: "editor-export",
        kind: "action",
        required: true,
        action: "file-exported",
      },
      {
        id: "json-export",
        title: "相関図をJSONでも保存しましょう",
        body: "JSONファイル書き出しを実行してください。このファイルから相関図を復元できます。",
        route: "editor",
        target: "editor-json-export",
        kind: "action",
        required: true,
        action: "json-exported",
      },
      {
        id: "settings-simulation",
        title: "表示設定を安全に練習します",
        body: "続柄の線と性別の色を変更する流れを模擬します。練習内容は保存されません。",
        route: "settings",
        target: "settings-heading",
        kind: "simulation",
        required: true,
        action: "simulation-completed",
        simulationLabel: "線と色の変更を模擬する",
      },
    ],
  },
  {
    id: "data",
    title: "データを守る",
    minutes: 2,
    summary: "バックアップ、読み込み、保存方法、ヘルプを確認します。",
    steps: [
      {
        id: "chart-backup",
        title: "練習用相関図をバックアップしましょう",
        body: "バックアップから練習用相関図を選び、JSONファイルへ書き出してください。",
        route: "charts",
        target: "chart-backup",
        kind: "action",
        required: true,
        action: "backup-exported",
      },
      {
        id: "import-simulation",
        title: "読み込みと置き換えを安全に練習します",
        body: "追加と置き換えの違いを模擬操作で確認します。実際のデータは変更されません。",
        route: "file-import",
        target: "file-import-heading",
        kind: "simulation",
        required: true,
        action: "simulation-completed",
        simulationLabel: "追加と置き換えを模擬する",
      },
      {
        id: "storage-simulation",
        title: "保存方法と全削除を確認します",
        body: "端末保存・一時利用と全削除の確認手順を模擬します。実際のデータは変更されません。",
        route: "data-management",
        target: "data-management-heading",
        kind: "simulation",
        required: true,
        action: "simulation-completed",
        simulationLabel: "保存方法と全削除を模擬する",
      },
      {
        id: "help",
        title: "困ったときの確認先",
        body: "詳しい使い方、問い合わせ先、利用規約とプライバシーポリシーの場所を確認します。",
        route: "help",
        target: "help-heading",
        kind: "explanation",
      },
    ],
  },
] as const;

export const chapterById = (id: TutorialChapterId) =>
  tutorialChapters.find((chapter) => chapter.id === id)!;
export const requiredStepIds = (chapter: TutorialChapter) =>
  chapter.steps.filter((step) => step.required).map((step) => step.id);
export function routeForStep(
  step: TutorialStep,
  practiceChartId: string | null,
) {
  if (step.route === "editor")
    return practiceChartId ? `/charts/${practiceChartId}` : "/tutorial";
  if (step.route === "charts") return "/charts";
  if (step.route === "settings") return "/settings";
  if (step.route === "file-import") return "/file-import";
  if (step.route === "data-management") return "/data-management";
  return "/help";
}
