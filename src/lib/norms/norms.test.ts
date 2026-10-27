import { describe, expect, it } from "vitest";
import type { Metric } from "@/lib/metrics/types";
import { compareMetric, NORMS, referenceRange, type NormsFile } from "@/lib/norms";
import { demoReferenceBand } from "@/lib/norms/demo";
import DEMO from "@/lib/norms/demo-references.json";

const score = (value: number, worse: Metric["worse"] = "higher"): Metric => ({ key: "timeA", label: "Part A time", value, unit: "ms", kind: "score", worse });

/** TEST FIXTURE ONLY — made-up numbers to exercise the math. Never used by the app. */
const FIXTURE: NormsFile = {
  schema: 1,
  policy: "test",
  tasks: {
    "trail-making": {
      status: "published",
      note: "",
      metrics: { timeA: { citation: "Test fixture (not real data)", administration: "test", bands: [{ ageMin: 8, ageMax: 9, mean: 20000, sd: 5000, n: 100 }] } },
      groups: { adhd: { timeA: { citation: "Test fixture (not real data)", administration: "test", bands: [{ ageMin: 8, ageMax: 9, mean: 26000, sd: 7000, n: 50 }] } } },
    },
  },
};

describe("norms", () => {
  it("shipping norms are placeholders only (no invented values)", () => {
    for (const t of Object.values(NORMS.tasks)) {
      expect(t.status).toBe("placeholder");
      expect(Object.keys(t.metrics)).toHaveLength(0);
      for (const g of Object.values(t.groups ?? {})) expect(Object.keys(g)).toHaveLength(0);
    }
    expect(compareMetric("trail-making", score(30000), 9).status).toBe("placeholder");
    expect(referenceRange("trail-making", "timeA", "adhd", 9).status).toBe("unavailable");
  });

  it("reference ranges come from the published entry's age band", () => {
    expect(referenceRange("trail-making", "timeA", "typical", 9, FIXTURE)).toMatchObject({ status: "available", band: { mean: 20000, sd: 5000 } });
    expect(referenceRange("trail-making", "timeA", "adhd", 9, FIXTURE)).toMatchObject({ status: "available", band: { mean: 26000, sd: 7000 } });
    expect(referenceRange("trail-making", "timeA", "adhd", 12, FIXTURE).status).toBe("unavailable");
    expect(referenceRange("trail-making", "timeA", "autism", 9, FIXTURE).status).toBe("unavailable");
  });

  it("fictional demo ranges are flagged and never feed z-scores or flags", () => {
    expect(DEMO.fictional).toBe(true);
    expect(demoReferenceBand("trail-making", "timeB", "adhd", 9)).toMatchObject({ ageMin: 9, ageMax: 10 });
    expect(referenceRange("trail-making", "timeB", "adhd", 9).status).toBe("unavailable");
    expect(compareMetric("trail-making", score(30000), 9).status).toBe("placeholder");
  });

  it("process metrics are always exploratory", () => {
    const m: Metric = { key: "hesitations", label: "", value: 3, unit: "count", kind: "process" };
    expect(compareMetric("trail-making", m, 9, FIXTURE)).toMatchObject({ status: "exploratory" });
  });

  it("computes z, percentile and > 1.5 SD flags in the worse direction", () => {
    const slow = compareMetric("trail-making", score(30000), 9, FIXTURE);
    expect(slow).toMatchObject({ status: "compared", z: 2, flag: true });
    if (slow.status === "compared") expect(slow.percentile).toBeCloseTo(97.7, 1);

    const fast = compareMetric("trail-making", score(10000), 9, FIXTURE);
    expect(fast).toMatchObject({ z: -2, flag: false }); // better than average is not flagged

    const borderline = compareMetric("trail-making", score(27000), 9, FIXTURE);
    expect(borderline).toMatchObject({ z: 1.4, flag: false });

    expect(compareMetric("trail-making", score(30000), 12, FIXTURE).status).toBe("no_band");
  });
});
