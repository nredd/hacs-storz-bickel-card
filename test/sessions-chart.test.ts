import { beforeEach, describe, expect, test } from "bun:test";
import "../src/sessions-chart";
import type { SbSessionsChart } from "../src/sessions-chart";

async function renderChart(dailyCounts: Record<string, number>): Promise<SbSessionsChart> {
  const el = document.createElement("sb-sessions-chart") as SbSessionsChart;
  el.dailyCounts = dailyCounts;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("sb-sessions-chart", () => {
  test("shows an empty state with no data", async () => {
    const el = await renderChart({});
    expect(el.shadowRoot?.querySelector(".empty")).not.toBeNull();
    expect(el.shadowRoot?.querySelector(".bars")).toBeNull();
  });

  test("renders one bar per day, sorted chronologically", async () => {
    const el = await renderChart({ "2026-07-08": 2, "2026-07-06": 1, "2026-07-07": 0 });
    const cols = el.shadowRoot?.querySelectorAll(".bar-col");
    expect(cols?.length).toBe(3);
    expect(cols?.[0]?.getAttribute("title")).toContain("2026-07-06");
    expect(cols?.[2]?.getAttribute("title")).toContain("2026-07-08");
  });

  test("totals the header count across all days", async () => {
    const el = await renderChart({ "2026-07-08": 2, "2026-07-07": 3 });
    expect(el.shadowRoot?.querySelector(".title")?.textContent).toContain("5 total");
  });

  test("highlights today's bar and marks zero-count bars", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const el = await renderChart({ [today]: 2, "2020-01-01": 0 });
    const bars = [...(el.shadowRoot?.querySelectorAll(".bar") ?? [])];
    const todayBar = bars.find((bar) => bar.classList.contains("today"));
    const zeroBar = bars.find((bar) => bar.classList.contains("zero"));
    expect(todayBar).toBeDefined();
    expect(zeroBar).toBeDefined();
    expect(todayBar).not.toBe(zeroBar);
  });
});
