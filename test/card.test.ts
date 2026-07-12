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

describe("capability-driven rendering", () => {
  test("Volcano shows the AIR toggle and no battery chip", async () => {
    const card = await renderCard(makeHass(), config(VOLCANO_DEVICE));
    expect(card.shadowRoot?.querySelector(".air-btn")).not.toBeNull();
    expect(card.shadowRoot?.querySelector(".battery")).toBeNull();
  });

  test("Crafty shows the battery chip and no AIR toggle", async () => {
    const card = await renderCard(makeHass(), config(CRAFTY_DEVICE));
    expect(card.shadowRoot?.querySelector(".air-btn")).toBeNull();
    expect(card.shadowRoot?.querySelector(".battery")?.textContent).toContain("87%");
  });

  test("device name prefers the user-assigned name, config name wins overall", async () => {
    const crafty = await renderCard(makeHass(), config(CRAFTY_DEVICE));
    expect(crafty.shadowRoot?.querySelector(".name")?.textContent).toBe("My Crafty");

    document.body.innerHTML = "";
    const named = await renderCard(makeHass(), config(CRAFTY_DEVICE, { name: "Bedside" }));
    expect(named.shadowRoot?.querySelector(".name")?.textContent).toBe("Bedside");
  });

  test("disconnected device dims controls and flips the connection chip", async () => {
    const hass = makeHass();
    const connection = hass.states["binary_sensor.volcano_connection"];
    if (connection) {
      connection.state = "off";
    }
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    expect(card.shadowRoot?.querySelector(".body")?.classList.contains("disconnected")).toBe(true);
    expect(card.shadowRoot?.querySelector(".connection-chip.off")).not.toBeNull();
  });
});

describe("presets", () => {
  test("chip matching the target is active; tapping one calls set_temperature", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE, { presets: [175, 185, 195] }));
    const chips = [...(card.shadowRoot?.querySelectorAll(".preset") ?? [])];
    expect(chips).toHaveLength(3);
    // Target is 195 in the fixture.
    expect(chips[2]?.classList.contains("active")).toBe(true);

    (chips[0] as HTMLButtonElement).click();
    expect(hass.serviceCalls).toEqual([
      {
        domain: "climate",
        service: "set_temperature",
        data: { entity_id: "climate.renamed_by_user", temperature: 175 },
      },
    ]);
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
});

describe("stepper buttons", () => {
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
    // Fixture target is 195; three +1 steps land on 198.
    expect(hass.serviceCalls).toEqual([
      {
        domain: "climate",
        service: "set_temperature",
        data: { entity_id: "climate.renamed_by_user", temperature: 198 },
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
});

describe("dial drag", () => {
  test("dragging the dial debounces into a single set_temperature call", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    card.debounceMs = 20;
    card.shadowRoot
      ?.querySelector("sb-temp-dial")
      ?.dispatchEvent(
        new CustomEvent("dial-drag", { detail: { value: 200 }, bubbles: true, composed: true }),
      );
    await sleep(60);
    expect(hass.serviceCalls).toEqual([
      {
        domain: "climate",
        service: "set_temperature",
        data: { entity_id: "climate.renamed_by_user", temperature: 200 },
      },
    ]);
  });
});

describe("settings", () => {
  test("LED brightness slider change calls number.set_value", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    const slider = card.shadowRoot?.querySelector(
      "#number-volcano_led_brightness",
    ) as HTMLInputElement;
    expect(slider).not.toBeNull();
    slider.value = "40";
    slider.dispatchEvent(new Event("change"));
    expect(hass.serviceCalls).toEqual([
      {
        domain: "number",
        service: "set_value",
        data: { entity_id: "number.volcano_led_brightness", value: 40 },
      },
    ]);
  });

  test("vibration toggle flips the switch", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(CRAFTY_DEVICE));
    const toggle = card.shadowRoot?.querySelector("#vibration") as HTMLInputElement;
    toggle.dispatchEvent(new Event("change"));
    expect(hass.serviceCalls).toEqual([
      {
        domain: "switch",
        service: "turn_off",
        data: { entity_id: "switch.crafty_vibration" },
      },
    ]);
  });
});

describe("session panel", () => {
  test("shows a live elapsed-time readout while a session is open", async () => {
    const hass = makeHass();
    const start = hass.states["sensor.volcano_current_session_start"];
    if (start) {
      start.state = new Date(Date.now() - 65_000).toISOString();
    }
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    const timerText = card.shadowRoot?.querySelector(".session-timer")?.textContent?.trim();
    // ~65s elapsed -> "1:0X" (a couple seconds of slack for test execution time).
    expect(timerText).toMatch(/^1:0[3-7]$/);
  });

  test("shows a placeholder when no session is open", async () => {
    const hass = makeHass();
    const start = hass.states["sensor.volcano_current_session_start"];
    if (start) {
      start.state = "unknown";
    }
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    expect(card.shadowRoot?.querySelector(".session-timer")?.textContent?.trim()).toBe("—:—");
  });

  test("sessions-today count reflects today's bucket in daily_counts", async () => {
    const hass = makeHass();
    const history = hass.states["sensor.volcano_session_history"];
    const today = new Date().toISOString().slice(0, 10);
    if (history) {
      history.attributes.daily_counts = { [today]: 4, "2020-01-01": 9 };
    }
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    expect(card.shadowRoot?.querySelector(".sessions-today-count")?.textContent).toBe("4");
  });
});

describe("sessions chart wiring", () => {
  test("passes the session_history sensor's daily_counts through to sb-sessions-chart", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    const chart = card.shadowRoot?.querySelector("sb-sessions-chart") as
      | (HTMLElement & { dailyCounts: Record<string, number> })
      | null;
    expect(chart?.dailyCounts).toEqual({ "2026-07-09": 3, "2026-07-08": 2, "2026-07-07": 1 });
  });
});

describe("device info panel", () => {
  test("shows total runtime and firmware version", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    const rows = [...(card.shadowRoot?.querySelectorAll(".info-row") ?? [])].map(
      (row) => row.textContent,
    );
    expect(rows.some((text) => text?.includes("Total runtime") && text.includes("2217.2 h"))).toBe(
      true,
    );
    expect(rows.some((text) => text?.includes("Firmware") && text.includes("1.2.3"))).toBe(true);
  });

  test("shows Bluetooth firmware when available", async () => {
    const hass = makeHass();
    hass.entities["sensor.volcano_ble_firmware_version"] = {
      entity_id: "sensor.volcano_ble_firmware_version",
      device_id: VOLCANO_DEVICE,
      platform: "storz_bickel",
      translation_key: "ble_firmware_version",
    };
    hass.states["sensor.volcano_ble_firmware_version"] = {
      entity_id: "sensor.volcano_ble_firmware_version",
      state: "1.4.2",
      attributes: {},
    };
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    const rows = [...(card.shadowRoot?.querySelectorAll(".info-row") ?? [])].map(
      (row) => row.textContent,
    );
    expect(
      rows.some((text) => text?.includes("Bluetooth firmware") && text.includes("1.4.2")),
    ).toBe(true);
  });

  test("hides Bluetooth firmware when the sensor is unavailable", async () => {
    const hass = makeHass();
    hass.entities["sensor.volcano_ble_firmware_version"] = {
      entity_id: "sensor.volcano_ble_firmware_version",
      device_id: VOLCANO_DEVICE,
      platform: "storz_bickel",
      translation_key: "ble_firmware_version",
    };
    hass.states["sensor.volcano_ble_firmware_version"] = {
      entity_id: "sensor.volcano_ble_firmware_version",
      state: "unavailable",
      attributes: {},
    };
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    const rows = [...(card.shadowRoot?.querySelectorAll(".info-row") ?? [])].map(
      (row) => row.textContent,
    );
    expect(rows.some((text) => text?.includes("Bluetooth firmware"))).toBe(false);
  });

  test("pump failsafe dropdown reflects the current value and writes on change", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    const selects = [
      ...(card.shadowRoot?.querySelectorAll(".panel select") ?? []),
    ] as HTMLSelectElement[];
    // Render order: auto shutoff, pump failsafe, pump cooldown, temp step.
    const failsafeSelect = selects[1] as HTMLSelectElement;
    expect(failsafeSelect.querySelector("option[selected]")?.getAttribute("value")).toBe("45");

    failsafeSelect.value = "90";
    failsafeSelect.dispatchEvent(new Event("change"));
    expect(hass.serviceCalls).toEqual([
      {
        domain: "number",
        service: "set_value",
        data: { entity_id: "number.volcano_pump_failsafe_seconds", value: 90 },
      },
    ]);
  });

  test("temp step dropdown reflects the current value and writes on change", async () => {
    const hass = makeHass();
    const card = await renderCard(hass, config(VOLCANO_DEVICE));
    const selects = [
      ...(card.shadowRoot?.querySelectorAll(".panel select") ?? []),
    ] as HTMLSelectElement[];
    const tempStepSelect = selects[3] as HTMLSelectElement;
    expect(tempStepSelect.querySelector("option[selected]")?.getAttribute("value")).toBe("1");

    tempStepSelect.value = "2.5";
    tempStepSelect.dispatchEvent(new Event("change"));
    expect(hass.serviceCalls).toEqual([
      {
        domain: "number",
        service: "set_value",
        data: { entity_id: "number.volcano_temp_step", value: 2.5 },
      },
    ]);
  });
});

describe("card metadata", () => {
  test("registers in window.customCards once", () => {
    const entries = (window.customCards ?? []).filter((card) => card.type === "storz-bickel-card");
    expect(entries).toHaveLength(1);
  });

  test("getCardSize and getGridOptions report sizing", async () => {
    const card = await renderCard(makeHass(), config(VOLCANO_DEVICE));
    expect(card.getCardSize()).toBeGreaterThan(0);
    expect(card.getGridOptions().min_columns).toBeGreaterThan(0);
  });
});
