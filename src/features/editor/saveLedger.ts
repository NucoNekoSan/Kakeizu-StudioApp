export interface SaveChange {
  target: string;
  fields: readonly string[];
}

interface Attempt {
  revision: number;
  changes: readonly SaveChange[];
}

/** Only a later write of the same field can supersede its pending error. */
export class SaveLedger {
  private revision = 0;
  private targets = new Map<
    string,
    Map<string, { revision: number; error: unknown }>
  >();

  begin(change: SaveChange | readonly SaveChange[]): Attempt {
    const changes = "target" in change ? [change] : change;
    const revision = ++this.revision;
    for (const { target, fields } of changes) {
      const entries = this.targets.get(target) ?? new Map();
      for (const field of fields) entries.set(field, { revision, error: null });
      this.targets.set(target, entries);
    }
    return { revision, changes };
  }

  settle(attempt: Attempt, error: unknown = null): void {
    for (const { target, fields } of attempt.changes) {
      const entries = this.targets.get(target);
      if (!entries) continue;
      for (const field of fields) {
        if (entries.get(field)?.revision !== attempt.revision) continue;
        if (error !== null)
          entries.set(field, { revision: attempt.revision, error });
        else entries.delete(field);
      }
      if (!entries.size) this.targets.delete(target);
    }
  }

  errorFor(target?: string): unknown {
    const targets = target ? [this.targets.get(target)] : this.targets.values();
    for (const entries of targets) {
      for (const entry of entries?.values() ?? [])
        if (entry.error !== null) return entry.error;
    }
    return null;
  }

  forget(target: string): void {
    this.targets.delete(target);
  }
}

export const saveTarget = {
  title: (chartId: string) => `chart:${chartId}:title`,
  node: (chartId: string, nodeId: string) => `chart:${chartId}:node:${nodeId}`,
  cohabitation: (chartId: string) => `chart:${chartId}:cohabitation`,
  frame: (chartId: string) => `chart:${chartId}:frame`,
  create: (chartId: string) => `chart:${chartId}:create`,
};
