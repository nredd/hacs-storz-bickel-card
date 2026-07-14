import { describe, expect, test } from "bun:test";
import type { StorzBickelCardEditor } from "../src/editor";
import { StorzBickelCard } from "../src/storz-bickel-card";
import type { CardConfig } from "../src/types";
import { makeHass, VOLCANO_DEVICE } from "./fixtures";

async function renderEditor(config: CardConfig): Promise<StorzBickelCardEditor> {
  const editor = document.createElement("storz-bickel-card-editor") as StorzBickelCardEditor;
  editor.setConfig(config);
  document.body.appendChild(editor);
  await (editor as StorzBickelCardEditor & { updateComplete: Promise<boolean> }).updateComplete;
  return editor;
}

function emitValueChanged(editor: StorzBickelCardEditor, value: Record<string, unknown>) {
  editor.shadowRoot?.querySelector("ha-form")?.dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value },
      bubbles: true,
      composed: true,
    }),
  );
}

function captureConfig(editor: StorzBickelCardEditor): () => CardConfig | undefined {
  let received: CardConfig | undefined;
  editor.addEventListener("config-changed", (event) => {
    received = (event as CustomEvent<{ config: CardConfig }>).detail.config;
  });
  return () => received;
}

describe("getStubConfig", () => {
  test("picks the first storz_bickel device", () => {
    const stub = StorzBickelCard.getStubConfig(makeHass());
    expect(stub.device).toBe(VOLCANO_DEVICE);
  });

  test("falls back to an empty device without hass", () => {
    const stub = StorzBickelCard.getStubConfig();
    expect(stub.device).toBe("");
  });
});

describe("getConfigElement", () => {
  test("returns the editor element", () => {
    const element = StorzBickelCard.getConfigElement();
    expect(element.tagName.toLowerCase()).toBe("storz-bickel-card-editor");
  });
});

describe("editor round-trip", () => {
  test("non-default effect options are written to the config", async () => {
    const editor = await renderEditor({
      type: "custom:storz-bickel-card",
      device: VOLCANO_DEVICE,
    });
    expect(editor.shadowRoot?.querySelector("ha-form")).not.toBeNull();
    const received = captureConfig(editor);

    emitValueChanged(editor, {
      device: VOLCANO_DEVICE,
      name: "Bedside",
      heat_effect: "Glow only",
      ember_intensity: "Inferno",
      air_effect: "Streaks only",
      wind_intensity: "Gale",
      idle_breeze: true,
    });

    expect(received()).toEqual({
      type: "custom:storz-bickel-card",
      device: VOLCANO_DEVICE,
      name: "Bedside",
      heat_effect: "Glow only",
      ember_intensity: "Inferno",
      air_effect: "Streaks only",
      wind_intensity: "Gale",
      idle_breeze: true,
    });
  });

  test("defaults and empty name are omitted from the config", async () => {
    const editor = await renderEditor({
      type: "custom:storz-bickel-card",
      device: VOLCANO_DEVICE,
      heat_effect: "Off",
    });
    const received = captureConfig(editor);

    emitValueChanged(editor, {
      device: VOLCANO_DEVICE,
      name: "",
      heat_effect: "Embers + glow",
      ember_intensity: "Steady",
      air_effect: "Streaks + glow",
      wind_intensity: "Steady",
      idle_breeze: false,
    });

    expect(received()).toEqual({ type: "custom:storz-bickel-card", device: VOLCANO_DEVICE });
  });

  test("unknown effect values are dropped", async () => {
    const editor = await renderEditor({
      type: "custom:storz-bickel-card",
      device: VOLCANO_DEVICE,
    });
    const received = captureConfig(editor);
    emitValueChanged(editor, { device: VOLCANO_DEVICE, heat_effect: "Lava lamp" });
    expect(received()).toEqual({ type: "custom:storz-bickel-card", device: VOLCANO_DEVICE });
  });

  test("value-changed before setConfig is a no-op (config guard)", () => {
    const editor = document.createElement("storz-bickel-card-editor") as StorzBickelCardEditor;
    let received: CardConfig | undefined;
    editor.addEventListener("config-changed", (event) => {
      received = (event as CustomEvent<{ config: CardConfig }>).detail.config;
    });

    const handleValueChanged = (
      editor as unknown as Record<
        "handleValueChanged",
        (event: CustomEvent<{ value: Record<string, unknown> }>) => void
      >
    ).handleValueChanged.bind(editor);

    expect(() =>
      handleValueChanged(
        new CustomEvent("value-changed", { detail: { value: { device: VOLCANO_DEVICE } } }),
      ),
    ).not.toThrow();
    expect(received).toBeUndefined();
  });
});
