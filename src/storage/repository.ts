import { ApiError, notFound, validationError } from "../api/errors";
import type { DefinitionsDocumentV1 } from "./defaults";
import { definitionsCodec } from "./defaults";
import type { ChartDocumentV1 } from "./chartDocument";
import { chartDocumentCodec } from "./chartDocument";
import type { DocumentStore } from "./kv";
import { nowIso } from "./ids";
import { migrateCohabitation, type LegacyStorage } from "./migrateCohabitation";
import { readDocument } from "./versioned";
import { awaitAll } from "./awaitAll";
import { normalizeChartParents } from "./parentReferences";

export const META_KEY = "meta";
export const DEFINITIONS_KEY = "definitions";
export const chartKey = (id: string) => `chart:${id}`;
export const isChartKey = (key: string) => key.startsWith("chart:");

export const META_SCHEMA_VERSION = 1;

export interface MetaDocumentV1 {
  schemaVersion: 1;
  createdAt: string;
  lastExportedAt: string | null;
}

export const emptyMeta = (): MetaDocumentV1 => ({
  schemaVersion: META_SCHEMA_VERSION,
  createdAt: nowIso(),
  lastExportedAt: null,
});

/** 保存ドキュメントへの読み書き。API全体の順序はstore単位のキューが保証する。 */
export class Repository {
  constructor(
    private readonly store: DocumentStore,
    private readonly legacyStorage?: LegacyStorage,
  ) {}

  async meta(): Promise<MetaDocumentV1> {
    const raw = await this.store.get<unknown>(META_KEY);
    if (raw === undefined) {
      const meta = emptyMeta();
      await this.store.set(META_KEY, meta);
      return meta;
    }
    return raw as MetaDocumentV1;
  }

  async setMeta(meta: MetaDocumentV1): Promise<void> {
    await this.store.set(META_KEY, meta);
  }

  /** 定義は未作成なら既定値をシードして永続化する (初回起動時の1回だけ)。 */
  async definitions(): Promise<DefinitionsDocumentV1> {
    const raw = await this.store.get<unknown>(DEFINITIONS_KEY);
    if (raw === undefined) {
      const seeded = definitionsCodec.empty();
      await this.store.set(DEFINITIONS_KEY, seeded);
      return seeded;
    }
    return readDocument(raw, definitionsCodec, "表示設定");
  }

  async saveDefinitions(document: DefinitionsDocumentV1): Promise<void> {
    await this.store.set(DEFINITIONS_KEY, document);
  }

  async chartIds(): Promise<string[]> {
    const keys = await this.store.keys();
    return keys.filter(isChartKey).map((key) => key.slice("chart:".length));
  }

  async findChart(id: string): Promise<ChartDocumentV1 | null> {
    const raw = await this.store.get<unknown>(chartKey(id));
    if (raw === undefined) return null;
    const decoded = readDocument(raw, chartDocumentCodec, "相関図");
    const document = normalizeChartParents(decoded);
    if (document !== decoded) await this.store.set(chartKey(id), document);
    return this.legacyStorage
      ? migrateCohabitation(document, this.legacyStorage, (migrated) =>
          this.store.set(chartKey(id), migrated),
        )
      : document;
  }

  async chart(id: string): Promise<ChartDocumentV1> {
    const document = await this.findChart(id);
    if (!document) throw notFound("相関図が見つかりません");
    return document;
  }

  async allCharts(): Promise<ChartDocumentV1[]> {
    const ids = await this.chartIds();
    const documents = await awaitAll(ids.map((id) => this.findChart(id)));
    return documents.filter((item): item is ChartDocumentV1 => item !== null);
  }

  /** 保存のたびに updatedAt を進める (PHP 版の UPDATE charts SET updated_at)。 */
  async saveChart(document: ChartDocumentV1): Promise<ChartDocumentV1> {
    const saved = { ...document, updatedAt: nowIso() };
    await this.store.set(chartKey(saved.id), saved);
    return saved;
  }

  async deleteChart(id: string): Promise<void> {
    await this.store.del(chartKey(id));
  }

  async replaceAll(
    entries: readonly (readonly [string, unknown])[],
  ): Promise<void> {
    await this.store.replaceAll(entries);
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }
}

export { ApiError, notFound, validationError };
