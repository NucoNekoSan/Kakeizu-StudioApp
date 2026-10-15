import { describe, expect, it } from "vitest";
import { SaveLedger } from "./saveLedger";

describe("SaveLedger", () => {
  it("ignores an older failure after a successful replacement", () => {
    const ledger = new SaveLedger();
    const first = ledger.begin({ target: "node", fields: ["memo"] });
    const latest = ledger.begin({ target: "node", fields: ["memo"] });
    ledger.settle(latest);
    ledger.settle(first, new Error("old failure"));
    expect(ledger.errorFor()).toBeNull();
  });
  it("clears only the fields actually saved by a later update", () => {
    const ledger = new SaveLedger(),
      failure = new Error("failed memo and size");
    ledger.settle(
      ledger.begin({ target: "node", fields: ["memo", "fontSize"] }),
      failure,
    );
    ledger.settle(ledger.begin({ target: "node", fields: ["fontSize"] }));
    expect(ledger.errorFor("node")).toBe(failure);
    ledger.settle(ledger.begin({ target: "node", fields: ["memo"] }));
    expect(ledger.errorFor()).toBeNull();
  });
  it("keeps failures of another node or document", () => {
    const ledger = new SaveLedger(),
      failure = new Error("failed");
    ledger.settle(
      ledger.begin({ target: "first-node", fields: ["memo"] }),
      failure,
    );
    ledger.settle(ledger.begin({ target: "second-node", fields: ["memo"] }));
    ledger.settle(ledger.begin({ target: "title", fields: ["title"] }));
    expect(ledger.errorFor()).toBe(failure);
    expect(ledger.errorFor("second-node")).toBeNull();
  });
  it("keeps the latest failure when both attempts fail", () => {
    const ledger = new SaveLedger(),
      latestError = new Error("latest");
    const old = ledger.begin({ target: "title", fields: ["title"] });
    const latest = ledger.begin({ target: "title", fields: ["title"] });
    ledger.settle(latest, latestError);
    ledger.settle(old, new Error("old"));
    expect(ledger.errorFor()).toBe(latestError);
  });
  it("accounts for the individual node fields in a frame operation", () => {
    const ledger = new SaveLedger(),
      failure = new Error("frame failed");
    ledger.settle(
      ledger.begin([
        { target: "frame", fields: ["width"] },
        { target: "node", fields: ["x", "y"] },
      ]),
      failure,
    );
    ledger.settle(ledger.begin({ target: "node", fields: ["x", "y"] }));
    expect(ledger.errorFor("node")).toBeNull();
    expect(ledger.errorFor("frame")).toBe(failure);
  });
  it("forgets canceled targets without restoring their late errors", () => {
    const ledger = new SaveLedger();
    const attempt = ledger.begin({ target: "deleted-node", fields: ["memo"] });
    ledger.forget("deleted-node");
    ledger.settle(attempt, new Error("old write"));
    expect(ledger.errorFor()).toBeNull();
  });
});
