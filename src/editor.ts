/**
 * `<storz-bickel-card-editor>` — visual config editor for the card.
 *
 * A single `<ha-form>` (provided by the HA frontend at runtime) with a device
 * selector scoped to the integration, an optional name, and three optional
 * preset temperature boxes that flatten to/from the card's `presets` array.
 */

import { html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import type { CardConfig, HomeAssistant } from "./types";

const PRESET_FIELDS = ["preset_1", "preset_2", "preset_3"] as const;

const SCHEMA = [
  {
    name: "device",
    required: true,
    selector: { device: { integration: "storz_bickel" } },
  },
  { name: "name", selector: { text: {} } },
  ...PRESET_FIELDS.map((name) => ({
    name,
    selector: { number: { mode: "box", step: 1 } },
  })),
];

const LABELS: Record<string, string> = {
  device: "Device",
  name: "Name (optional)",
  preset_1: "Preset 1",
  preset_2: "Preset 2",
  preset_3: "Preset 3",
};

/** Visual editor backing `getConfigElement()`. */
export class StorzBickelCardEditor extends LitElement {
  /** The Home Assistant state object, set by the editor host. */
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config?: CardConfig;

  /** Lovelace: store the configuration being edited. */
  setConfig(config: CardConfig): void {
    this.config = config;
  }

  private get formData(): Record<string, unknown> {
    const presets = this.config?.presets ?? [];
    return {
      device: this.config?.device ?? "",
      name: this.config?.name,
      preset_1: presets[0],
      preset_2: presets[1],
      preset_3: presets[2],
    };
  }

  private handleValueChanged(event: CustomEvent<{ value: Record<string, unknown> }>): void {
    event.stopPropagation();
    if (!this.config) {
      return;
    }
    const value = event.detail.value;
    const presets = PRESET_FIELDS.map((field) => value[field]).filter(
      (preset): preset is number => typeof preset === "number" && Number.isFinite(preset),
    );
    const config: CardConfig = {
      type: this.config.type,
      device: typeof value.device === "string" ? value.device : "",
    };
    if (typeof value.name === "string" && value.name !== "") {
      config.name = value.name;
    }
    if (presets.length > 0) {
      config.presets = presets;
    }
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }),
    );
  }

  protected override render() {
    if (!this.config) {
      return nothing;
    }
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this.formData}
        .schema=${SCHEMA}
        .computeLabel=${(schema: { name: string }) => LABELS[schema.name] ?? schema.name}
        @value-changed=${this.handleValueChanged}
      ></ha-form>
    `;
  }
}
