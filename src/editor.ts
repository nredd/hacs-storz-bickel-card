/**
 * `<storz-bickel-card-editor>` — visual config editor for the card.
 *
 * A single `<ha-form>` (provided by the HA frontend at runtime) with a device
 * selector scoped to the integration, an optional name, and the five effect
 * options ported from the design prototype's props (heat/ember, air/wind,
 * idle breeze).
 */

import { html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { ensureFonts } from "./fonts";
import type {
  AirEffect,
  CardConfig,
  EmberIntensity,
  HeatEffect,
  HomeAssistant,
  WindIntensity,
} from "./types";
import { DEFAULT_EFFECTS } from "./view-model";

const HEAT_EFFECTS: HeatEffect[] = ["Embers + glow", "Embers only", "Glow only", "Off"];
const EMBER_INTENSITIES: EmberIntensity[] = ["Smolder", "Steady", "Inferno"];
const AIR_EFFECTS: AirEffect[] = ["Streaks + glow", "Streaks only", "Glow only", "Off"];
const WIND_INTENSITIES: WindIntensity[] = ["Breeze", "Steady", "Gale"];

function selectOptions(options: string[]) {
  return options.map((option) => ({ value: option, label: option }));
}

const SCHEMA = [
  {
    name: "device",
    required: true,
    selector: { device: { integration: "storz_bickel" } },
  },
  { name: "name", selector: { text: {} } },
  {
    name: "heat_effect",
    selector: { select: { mode: "dropdown", options: selectOptions(HEAT_EFFECTS) } },
  },
  {
    name: "ember_intensity",
    selector: { select: { mode: "dropdown", options: selectOptions(EMBER_INTENSITIES) } },
  },
  {
    name: "air_effect",
    selector: { select: { mode: "dropdown", options: selectOptions(AIR_EFFECTS) } },
  },
  {
    name: "wind_intensity",
    selector: { select: { mode: "dropdown", options: selectOptions(WIND_INTENSITIES) } },
  },
  { name: "idle_breeze", selector: { boolean: {} } },
];

const LABELS: Record<string, string> = {
  device: "Device",
  name: "Name (optional)",
  heat_effect: "HEAT button effect",
  ember_intensity: "Ember intensity",
  air_effect: "AIR button effect",
  wind_intensity: "Wind intensity",
  idle_breeze: "Idle breeze while pump is off",
};

/** Visual editor backing `getConfigElement()`. */
export class StorzBickelCardEditor extends LitElement {
  /** The Home Assistant state object, set by the editor host. */
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config?: CardConfig;

  override connectedCallback(): void {
    super.connectedCallback();
    ensureFonts();
  }

  /** Lovelace: store the configuration being edited. */
  setConfig(config: CardConfig): void {
    this.config = config;
  }

  private get formData(): Record<string, unknown> {
    return {
      device: this.config?.device ?? "",
      name: this.config?.name,
      heat_effect: this.config?.heat_effect ?? DEFAULT_EFFECTS.heatEffect,
      ember_intensity: this.config?.ember_intensity ?? DEFAULT_EFFECTS.emberIntensity,
      air_effect: this.config?.air_effect ?? DEFAULT_EFFECTS.airEffect,
      wind_intensity: this.config?.wind_intensity ?? DEFAULT_EFFECTS.windIntensity,
      idle_breeze: this.config?.idle_breeze ?? DEFAULT_EFFECTS.idleBreeze,
    };
  }

  private handleValueChanged(event: CustomEvent<{ value: Record<string, unknown> }>): void {
    event.stopPropagation();
    if (!this.config) {
      return;
    }
    const value = event.detail.value;
    const config: CardConfig = {
      type: this.config.type,
      device: typeof value.device === "string" ? value.device : "",
    };
    if (typeof value.name === "string" && value.name !== "") {
      config.name = value.name;
    }
    const heatEffect = value.heat_effect as HeatEffect;
    if (HEAT_EFFECTS.includes(heatEffect) && heatEffect !== DEFAULT_EFFECTS.heatEffect) {
      config.heat_effect = heatEffect;
    }
    const emberIntensity = value.ember_intensity as EmberIntensity;
    if (
      EMBER_INTENSITIES.includes(emberIntensity) &&
      emberIntensity !== DEFAULT_EFFECTS.emberIntensity
    ) {
      config.ember_intensity = emberIntensity;
    }
    const airEffect = value.air_effect as AirEffect;
    if (AIR_EFFECTS.includes(airEffect) && airEffect !== DEFAULT_EFFECTS.airEffect) {
      config.air_effect = airEffect;
    }
    const windIntensity = value.wind_intensity as WindIntensity;
    if (
      WIND_INTENSITIES.includes(windIntensity) &&
      windIntensity !== DEFAULT_EFFECTS.windIntensity
    ) {
      config.wind_intensity = windIntensity;
    }
    if (value.idle_breeze === true) {
      config.idle_breeze = true;
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
