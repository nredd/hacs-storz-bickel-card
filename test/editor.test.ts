import { describe, expect, test } from "bun:test";
import { DEFAULT_PRESETS } from "../src/const";
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

describe("getStubConfig", () => {
  test("picks the first storz_bickel device and default presets", () => {
    const stub = StorzBickelCard.getStubConfig(makeHass());
    expect(stub.device).toBe(VOLCANO_DEVICE);
    expect(stub.presets).toEqual(DEFAULT_PRESETS);
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
  test("form values flatten back into a presets array", async () => {
    const editor = await renderEditor({
      type: "custom:storz-bickel-card",
      device: VOLCANO_DEVICE,
      presets: [175, 185],
    });
    const form = editor.shadowRoot?.querySelector("ha-form");
    expect(form).not.toBeNull();

    let received: CardConfig | undefined;
    editor.addEventListener("config-changed", (event) => {
      received = (event as CustomEvent<{ config: CardConfig }>).detail.config;
    });
    form?.dispatchEvent(
      new CustomEvent("value-changed", {
        detail: {
          value: {
            device: VOLCANO_DEVICE,
            name: "Bedside",
            preset_1: 170,
            preset_2: 190,
            preset_3: undefined,
          },
        },
        bubbles: true,
        composed: true,
      }),
    );

    expect(received).toEqual({
      type: "custom:storz-bickel-card",
      device: VOLCANO_DEVICE,
      name: "Bedside",
      presets: [170, 190],
    });
  });

  test("empty name and presets are omitted from the config", async () => {
    const editor = await renderEditor({
      type: "custom:storz-bickel-card",
      device: VOLCANO_DEVICE,
    });
    let received: CardConfig | undefined;
    editor.addEventListener("config-changed", (event) => {
      received = (event as CustomEvent<{ config: CardConfig }>).detail.config;
    });
    editor.shadowRoot?.querySelector("ha-form")?.dispatchEvent(
      new CustomEvent("value-changed", {
        detail: { value: { device: VOLCANO_DEVICE, name: "" } },
        bubbles: true,
        composed: true,
      }),
    );
    expect(received).toEqual({ type: "custom:storz-bickel-card", device: VOLCANO_DEVICE });
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
