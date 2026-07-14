import { beforeEach, describe, expect, test } from "bun:test";
// Side-effect import: defines the custom elements and registers the card.
import "../src/storz-bickel-card";
import type { StorzBickelCard } from "../src/storz-bickel-card";
import type { CardConfig } from "../src/types";
import { CRAFTY_DEVICE, type FakeHass, makeHass, VOLCANO_DEVICE } from "./fixtures";

function config(device: string, overrides: Partial<CardConfig> = {}): CardConfig {
  return { type: "custom:storz-bickel-card", device, ...overrides };
}

async function renderCard(hass: FakeHass, cardConfig: CardConfig): Promise<StorzBickelCard> {
  const card = document.createElement("storz-bickel-card") as StorzBickelCard;
  card.setConfig(cardConfig);
  card.hass = hass;
  document.body.appendChild(card);
  await card.updateComplete;
  return card;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shadowText(card: StorzBickelCard, selector: string): string | undefined {
  return card.shadowRoot?.querySelector(selector)?.textContent?.trim();
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("setConfig", () => {
  test("throws when device is missing", () => {
    const card = document.createElement("storz-bickel-card") as StorzBickelCard;
    expect(() => card.setConfig({ type: "custom:storz-bickel-card", device: "" })).toThrow(
      /device/,
    );
  });
});

describe("prototype structure", () => {
  test("renders the fixed-width scale stage inside the viewport", async () => {
    const card = await renderCard(makeHass(), config(VOLCANO_DEVICE));
    const stage = card.shadowRoot?.querySelector(".scale-stage") as HTMLElement;
    expect(stage).not.toBeNull();
    expect(stage.getAttribute("style")).toContain("width:1328px");
    expect(stage.getAttribute("style")).toContain("scale(1)");
    expect(card.shadowRoot?.querySelector(".scale-viewport")).not.toBeNull();
  });

  test("renders the DSEG7 LCD with 888 ghosts and the current/target digits", async () => {
    const card = await renderCard(makeHass(), config(VOLCANO_DEVICE));
    const shadow = card.shadowRoot;
    const ghosts = [...(shadow?.querySelectorAll("div") ?? [])].filter(
      (el) => el.textContent?.trim() === "888",
    );
    expect(ghosts.length).toBe(2);
    // Fixture: native °C, current 184, target 195.
    const text = shadow?.textContent ?? "";
    expect(text).toContain("184");
    expect(text).toContain("195");
  });

  test("renders 25 knob ticks with 5 labeled majors from the climate range", async () => {
    const card = await renderCard(makeHass(), config(VOLCANO_DEVICE));
    const knob = card.shadowRoot?.querySelector(".knob");
    const labels = [...(knob?.querySelectorAll("span") ?? [])]
      .map((el) => el.textContent?.trim())
      .filter((label) => label);
    expect(labels).toEqual(["40°C", "88°C", "135°C", "183°C", "230°C"]);
  });

  test("shows dashes in the LCD when the climate readings are missing", async () => {
    const hass = makeHass();
    const climate = hass.states["climate.renamed_by_user"];
    if (climate) {
      climate.attributes.current_temperature = undefined;
      climate.attributes.temperature = undefined;
    }
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    const text = card.shadowRoot?.textContent ?? "";
    expect(text).toContain("---");
  });

  test("reports full-width grid options and a fallback card size", async () => {
    const card = await renderCard(makeHass(), config(VOLCANO_DEVICE));
    expect(card.getGridOptions()).toEqual({ columns: "full" });
    expect(card.getCardSize()).toBe(14);
  });

  test("shows a message when the device has no entities", async () => {
    const card = await renderCard(makeHass(), config("missing-device"));
    expect(card.shadowRoot?.textContent).toContain("Device entities not found");
  });

  test("injects the bundled fonts into document.head", async () => {
    await renderCard(makeHass(), config(VOLCANO_DEVICE));
    expect(document.getElementById("storz-bickel-card-fonts")).not.toBeNull();
  });
});

describe("header", () => {
  test("device name prefers the user-assigned name, config name wins overall", async () => {
    const crafty = await renderCard(makeHass(), config(CRAFTY_DEVICE));
    expect(crafty.shadowRoot?.textContent).toContain("My Crafty");

    document.body.innerHTML = "";
    const named = await renderCard(makeHass(), config(CRAFTY_DEVICE, { name: "Bedside" }));
    expect(named.shadowRoot?.textContent).toContain("Bedside");
  });

  test("connection pill flips to Offline when the sensor is off", async () => {
    const hass = makeHass();
    const connection = hass.states["binary_sensor.volcano_connection"];
    if (connection) {
      connection.state = "off";
    }
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    expect(card.shadowRoot?.textContent).toContain("Offline");
  });

  test("no battery chip is rendered (not part of the design)", async () => {
    const card = await renderCard(makeHass(), config(CRAFTY_DEVICE));
    expect(card.shadowRoot?.textContent).not.toContain("87%");
  });
});

describe("heat and pump controls", () => {
  test("HEAT toggle sets hvac mode off when heating", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    (card.shadowRoot?.querySelector(".heat-btn") as HTMLButtonElement).click();
    expect(hass.serviceCalls).toEqual([
      {
        domain: "climate",
        service: "set_hvac_mode",
        data: { entity_id: "climate.renamed_by_user", hvac_mode: "off" },
      },
    ]);
  });

  test("AIR toggle turns the pump switch on", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    (card.shadowRoot?.querySelector(".air-btn") as HTMLButtonElement).click();
    expect(hass.serviceCalls).toEqual([
      {
        domain: "switch",
        service: "turn_on",
        data: { entity_id: "switch.volcano_pump" },
      },
    ]);
  });

  test("AIR button is inert without a pump entity (Crafty)", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(CRAFTY_DEVICE));
    const air = card.shadowRoot?.querySelector(".air-btn") as HTMLButtonElement;
    expect(air).not.toBeNull();
    expect(air.getAttribute("style")).toContain("pointer-events:none");
    air.click();
    expect(hass.serviceCalls).toHaveLength(0);
  });
});

describe("stepper", () => {
  test("rapid taps debounce into a single set_temperature call", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    card.debounceMs = 20;
    const plus = card.shadowRoot?.querySelector(".step.plus") as HTMLButtonElement;

    plus.click();
    plus.click();
    plus.click();
    expect(hass.serviceCalls).toHaveLength(0);

    await sleep(60);
    // Fixture target 195 °C; three +5 °C card-local steps land on 210.
    expect(hass.serviceCalls).toEqual([
      {
        domain: "climate",
        service: "set_temperature",
        data: { entity_id: "climate.renamed_by_user", temperature: 210 },
      },
    ]);
  });

  test("steps clamp to the climate entity's max", async () => {
    const hass = makeHass();
    const climate = hass.states["climate.renamed_by_user"];
    if (climate) {
      climate.attributes.temperature = 230;
    }
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    card.debounceMs = 20;
    (card.shadowRoot?.querySelector(".step.plus") as HTMLButtonElement).click();
    await sleep(60);
    expect(hass.serviceCalls[0]?.data.temperature).toBe(230);
  });

  test("changing the temp step select changes the stepper caption", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    expect(card.shadowRoot?.textContent).toContain("5° INCREMENT"); // °C default
    const select = card.shadowRoot?.querySelector(".temp-step") as HTMLSelectElement;
    select.value = "2";
    select.dispatchEvent(new Event("change"));
    await card.updateComplete;
    expect(card.shadowRoot?.textContent).toContain("2° INCREMENT");
    expect(hass.serviceCalls).toHaveLength(0); // card-local, no service call
  });
});

describe("target input", () => {
  test("typed target commits immediately on blur", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    const input = card.shadowRoot?.querySelector("input") as HTMLInputElement;
    input.dispatchEvent(new Event("focus"));
    input.value = "200";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new Event("blur"));
    expect(hass.serviceCalls).toEqual([
      {
        domain: "climate",
        service: "set_temperature",
        data: { entity_id: "climate.renamed_by_user", temperature: 200 },
      },
    ]);
  });

  test("commits clamp to the climate range", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    const input = card.shadowRoot?.querySelector("input") as HTMLInputElement;
    input.dispatchEvent(new Event("focus"));
    input.value = "999";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new Event("blur"));
    expect(hass.serviceCalls[0]?.data.temperature).toBe(230);
  });

  test("Escape cancels the draft without a service call", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    const input = card.shadowRoot?.querySelector("input") as HTMLInputElement;
    input.dispatchEvent(new Event("focus"));
    input.value = "222";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    input.dispatchEvent(new Event("blur"));
    expect(hass.serviceCalls).toHaveLength(0);
  });

  test("garbage input is discarded", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    const input = card.shadowRoot?.querySelector("input") as HTMLInputElement;
    input.dispatchEvent(new Event("focus"));
    input.value = "hot please";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new Event("blur"));
    expect(hass.serviceCalls).toHaveLength(0);
  });
});

describe("optimistic target lifecycle", () => {
  test("keeps the optimistic target after the debounce fires until HA echoes it", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    card.debounceMs = 20;
    (card.shadowRoot?.querySelector(".step.plus") as HTMLButtonElement).click();
    await sleep(60); // debounce fired, service call sent (195 + 5 = 200)
    expect(hass.serviceCalls).toHaveLength(1);
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector("input")?.value).toBe("200°C");

    // A stale hass update (target still 195) must NOT snap the UI back.
    card.hass = makeHass();
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector("input")?.value).toBe("200°C");

    // HA echoing the new target releases the optimistic value.
    const echoed = makeHass();
    const climate = echoed.states["climate.renamed_by_user"];
    if (climate) {
      climate.attributes.temperature = 200;
    }
    card.hass = echoed;
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector("input")?.value).toBe("200°C");
  });
});

describe("knob drag", () => {
  test("releasing a drag flushes the service call immediately", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    card.debounceMs = 500; // long debounce: proves the flush is the sender
    const knob = card.shadowRoot?.querySelector(".knob") as HTMLElement;
    knob.dispatchEvent(new MouseEvent("mousedown", { clientX: 0, clientY: -10 }));
    expect(hass.serviceCalls).toHaveLength(0);
    window.dispatchEvent(new Event("mouseup"));
    expect(hass.serviceCalls).toEqual([
      {
        domain: "climate",
        service: "set_temperature",
        data: { entity_id: "climate.renamed_by_user", temperature: 135 },
      },
    ]);
  });

  test("dragging debounces a snapped set_temperature call", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    card.debounceMs = 20;
    const knob = card.shadowRoot?.querySelector(".knob") as HTMLElement;
    // happy-dom rects are all zeros, so the knob center is (0,0). A pointer
    // straight up (0,-10) is angle 0 → 50% of the sweep → midpoint 135 °C.
    knob.dispatchEvent(new MouseEvent("mousedown", { clientX: 0, clientY: -10 }));
    await sleep(60);
    expect(hass.serviceCalls).toEqual([
      {
        domain: "climate",
        service: "set_temperature",
        data: { entity_id: "climate.renamed_by_user", temperature: 135 },
      },
    ]);
  });
});

describe("unit toggle", () => {
  test("°F override relabels the LCD, stepper and ticks without persisting", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    (card.shadowRoot?.querySelector(".unit-f") as HTMLButtonElement).click();
    await card.updateComplete;
    const text = card.shadowRoot?.textContent ?? "";
    // 184 °C → 363 °F, 195 °C → 383 °F
    expect(text).toContain("363");
    expect(text).toContain("383");
    expect(text).toContain("10° INCREMENT"); // °F step default
    const knob = card.shadowRoot?.querySelector(".knob");
    const labels = [...(knob?.querySelectorAll("span") ?? [])]
      .map((el) => el.textContent?.trim())
      .filter((label) => label);
    expect(labels).toEqual(["104°F", "190°F", "275°F", "361°F", "446°F"]);
    expect(hass.serviceCalls).toHaveLength(0);
  });
});

describe("session panel", () => {
  test("shows a live MM:SS readout while a session is open", async () => {
    const hass = makeHass();
    const start = hass.states["sensor.volcano_current_session_start"];
    if (start) {
      start.state = new Date(Date.now() - 65_000).toISOString();
    }
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    const timerText = shadowText(card, ".session-timer");
    // ~65s elapsed → "01:0X" with slack for test execution time.
    expect(timerText).toMatch(/^01:0[3-9]$/);
  });

  test("shows the prototype placeholder when no session is open", async () => {
    const hass = makeHass();
    const start = hass.states["sensor.volcano_current_session_start"];
    if (start) {
      start.state = "unknown";
    }
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    expect(shadowText(card, ".session-timer")).toBe("--:--");
  });

  test("sessions-today count reflects today's bucket in daily_counts", async () => {
    const hass = makeHass();
    const history = hass.states["sensor.volcano_session_history"];
    const today = new Date().toISOString().slice(0, 10);
    if (history) {
      history.attributes.daily_counts = { [today]: 4, "2020-01-01": 9 };
    }
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    expect(shadowText(card, ".sessions-today-count")).toBe("4");
  });
});

describe("sessions chart", () => {
  test("buckets the session records into 48 bars and counts the window", async () => {
    const hass = makeHass();
    const history = hass.states["sensor.volcano_session_history"];
    if (history) {
      history.attributes.sessions = [
        {
          start: new Date(Date.now() - 30 * 60_000).toISOString(),
          stop: new Date(Date.now() - 20 * 60_000).toISOString(),
        },
        {
          start: new Date(Date.now() - 3 * 3_600_000).toISOString(),
          stop: new Date(Date.now() - 3 * 3_600_000 + 12 * 60_000).toISOString(),
        },
      ];
    }
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    expect(card.shadowRoot?.textContent).toContain("2 total");
    expect(card.shadowRoot?.textContent).toContain("24h");
    const barsRow = [...(card.shadowRoot?.querySelectorAll("div") ?? [])].find((el) =>
      el.getAttribute("style")?.includes("align-items:flex-end"),
    );
    expect(barsRow?.children.length).toBe(48);
  });

  test("changing the window re-buckets", async () => {
    const card = await renderCard(makeHass(), config(VOLCANO_DEVICE));
    const select = card.shadowRoot?.querySelector(".session-window") as HTMLSelectElement;
    select.value = "6";
    select.dispatchEvent(new Event("change"));
    await card.updateComplete;
    expect(card.shadowRoot?.textContent).toContain("6h");
  });
});

describe("temperature chart", () => {
  test("renders the live path from fetched history", async () => {
    const hass = makeHass();
    const now = Date.now();
    hass.apiResponses["history/period"] = [
      [
        { state: "150", last_changed: new Date(now - 20 * 60_000).toISOString() },
        { state: "170", last_changed: new Date(now - 10 * 60_000).toISOString() },
        { state: "184", last_changed: new Date(now - 60_000).toISOString() },
      ],
    ];
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    await sleep(0);
    await card.updateComplete;
    const paths = [...(card.shadowRoot?.querySelectorAll("path") ?? [])];
    expect(paths.length).toBe(2);
    const d = paths[1]?.getAttribute("d") ?? "";
    // Time-based x: the oldest sample (20 of 30 min ago) sits ~1/3 in
    // (x ≈ 186.7, ± half a bucket), and extend-to-now reaches the right edge.
    expect(d).toMatch(/^M18[0-9]/);
    expect(d).toContain("L560.0");
    expect(card.shadowRoot?.textContent).toContain("−30 min");
  });

  test("changing the chart window updates the x-axis captions", async () => {
    const card = await renderCard(makeHass(), config(VOLCANO_DEVICE));
    const select = card.shadowRoot?.querySelector(".chart-window") as HTMLSelectElement;
    select.value = "60";
    select.dispatchEvent(new Event("change"));
    await card.updateComplete;
    expect(card.shadowRoot?.textContent).toContain("−60 min");
  });
});

describe("device info", () => {
  test("shows runtime, firmware and dashes for missing values", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    const text = card.shadowRoot?.textContent ?? "";
    expect(text).toContain("2,217.2 h");
    expect(text).toContain("1.2.3");
    // No BLE firmware sensor in the Volcano fixture → em-dash slot remains.
    expect(text).toContain("Bluetooth firmware");
    expect(text).toContain("—");
  });

  test("auto shutoff and pump failsafe selects write number.set_value", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    const selects = [...(card.shadowRoot?.querySelectorAll("select") ?? [])] as HTMLSelectElement[];
    // Order: chart window, session window, auto shutoff, pump failsafe, temp step.
    const failsafe = selects[3] as HTMLSelectElement;
    expect(failsafe.querySelector("option[selected]")?.getAttribute("value")).toBe("45");
    failsafe.value = "90";
    failsafe.dispatchEvent(new Event("change"));
    expect(hass.serviceCalls).toEqual([
      {
        domain: "number",
        service: "set_value",
        data: { entity_id: "number.volcano_pump_failsafe_seconds", value: 90 },
      },
    ]);
  });
});

describe("card metadata", () => {
  test("registers in window.customCards once", () => {
    const entries = (window.customCards ?? []).filter((card) => card.type === "storz-bickel-card");
    expect(entries).toHaveLength(1);
  });
});
