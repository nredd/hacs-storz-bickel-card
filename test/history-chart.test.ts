import { beforeEach, describe, expect, test } from "bun:test";
import "../src/history-chart";
import type { SbHistoryChart } from "../src/history-chart";
import type { HistoryStateRecord, HomeAssistant } from "../src/types";

function fakeHass(series: HistoryStateRecord[]): HomeAssistant {
  return {
    states: {},
    entities: {},
    devices: {},
    config: { unit_system: { temperature: "°F" } },
    callService: () => Promise.resolve(),
    callApi: <T>() => Promise.resolve([series] as T),
  };
}

/** A hass whose callApi rejects, exercising the refresh() catch branch. */
function failingHass(): HomeAssistant {
  return {
    states: {},
    entities: {},
    devices: {},
    config: { unit_system: { temperature: "°F" } },
    callService: () => Promise.resolve(),
    callApi: () => Promise.reject(new Error("network error")),
  };
}

/** A hass that returns a different series per entity id, for refetch tests. */
function multiEntityHass(seriesByEntity: Record<string, HistoryStateRecord[]>): HomeAssistant {
  return {
    states: {},
    entities: {},
    devices: {},
    config: { unit_system: { temperature: "°F" } },
    callService: () => Promise.resolve(),
    callApi: <T>(_method: "GET" | "POST", path: string): Promise<T> => {
      const entityId = Object.keys(seriesByEntity).find((id) => path.includes(id));
      return Promise.resolve([entityId ? seriesByEntity[entityId] : []] as T);
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("sb-history-chart", () => {
  test("shows an empty state with fewer than two points", async () => {
    const el = document.createElement("sb-history-chart") as SbHistoryChart;
    el.hass = fakeHass([{ state: "185", last_changed: new Date().toISOString() }]);
    el.entityId = "sensor.volcano_temperature";
    document.body.appendChild(el);
    await el.updateComplete;
    await sleep(10);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector(".empty")).not.toBeNull();
  });

  test("renders a line and current-value readout with two or more points", async () => {
    const now = Date.now();
    const el = document.createElement("sb-history-chart") as SbHistoryChart;
    el.hass = fakeHass([
      { state: "180", last_changed: new Date(now - 60_000).toISOString() },
      { state: "185", last_changed: new Date(now).toISOString() },
    ]);
    el.entityId = "sensor.volcano_temperature";
    el.unit = "°F";
    document.body.appendChild(el);
    await el.updateComplete;
    await sleep(10);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector("svg path")).not.toBeNull();
    expect(el.shadowRoot?.querySelector(".current")?.textContent).toContain("185");
  });

  test("shows an empty state when the history API call fails", async () => {
    const el = document.createElement("sb-history-chart") as SbHistoryChart;
    el.hass = failingHass();
    el.entityId = "sensor.volcano_temperature";
    document.body.appendChild(el);
    await el.updateComplete;
    await sleep(10);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector(".empty")).not.toBeNull();
  });

  test("refetches and re-renders when entityId changes", async () => {
    const now = Date.now();
    const el = document.createElement("sb-history-chart") as SbHistoryChart;
    el.hass = multiEntityHass({
      "sensor.volcano_temperature": [
        { state: "180", last_changed: new Date(now - 60_000).toISOString() },
        { state: "185", last_changed: new Date(now).toISOString() },
      ],
      "sensor.crafty_temperature": [
        { state: "200", last_changed: new Date(now - 60_000).toISOString() },
        { state: "210", last_changed: new Date(now).toISOString() },
      ],
    });
    el.entityId = "sensor.volcano_temperature";
    document.body.appendChild(el);
    await el.updateComplete;
    await sleep(10);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector(".current")?.textContent).toContain("185");

    el.entityId = "sensor.crafty_temperature";
    await el.updateComplete;
    await sleep(10);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector(".current")?.textContent).toContain("210");
  });
});
