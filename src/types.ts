/**
 * Minimal Home Assistant frontend typings used by the card.
 *
 * Hand-rolled on purpose: the community `custom-card-helpers` package is
 * stale, and the card only touches a small, stable slice of the `hass`
 * object. Keep these in sync with what the card actually reads.
 */

/** Temperature unit code used for display/native conversions. */
export type TempUnit = "C" | "F";

/** HEAT button effect variants (design prototype `heatEffect` prop). */
export type HeatEffect = "Embers + glow" | "Embers only" | "Glow only" | "Off";

/** Ember animation density (design prototype `emberIntensity` prop). */
export type EmberIntensity = "Smolder" | "Steady" | "Inferno";

/** AIR button effect variants (design prototype `airEffect` prop). */
export type AirEffect = "Streaks + glow" | "Streaks only" | "Glow only" | "Off";

/** Wind streak density (design prototype `windIntensity` prop). */
export type WindIntensity = "Breeze" | "Steady" | "Gale";

/** A single entity state from `hass.states`. */
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

/** An entity registry display entry from `hass.entities`. */
export interface EntityRegistryDisplayEntry {
  entity_id: string;
  device_id?: string;
  platform?: string;
  translation_key?: string;
  name?: string;
}

/** A device registry entry from `hass.devices`. */
export interface DeviceRegistryEntry {
  id: string;
  name?: string;
  name_by_user?: string;
  sw_version?: string;
}

/**
 * One completed/ongoing session from `session_history.attributes.sessions`
 * (the integration's `Session.as_dict()`): ISO start/stop timestamps, stop
 * absent while the session is still running.
 */
export interface SessionRecord {
  start: string;
  stop?: string | null;
}

/** One state-change record as returned by the `history/period` REST API. */
export interface HistoryStateRecord {
  state: string;
  last_changed: string;
}

/** One aggregated chart sample: ms-epoch bucket center + mean value. */
export interface SeriesPoint {
  t: number;
  v: number;
}

/** The slice of the `hass` object the card depends on. */
export interface HomeAssistant {
  states: Record<string, HassEntity>;
  entities: Record<string, EntityRegistryDisplayEntry>;
  devices: Record<string, DeviceRegistryEntry>;
  config: { unit_system: { temperature: string } };
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
  callApi<T>(method: "GET" | "POST", path: string): Promise<T>;
}

/** YAML/UI configuration accepted by `custom:storz-bickel-card`. */
export interface CardConfig {
  type: string;
  device: string;
  name?: string;
  /** HEAT button effect (default "Embers + glow"). */
  heat_effect?: HeatEffect;
  /** Ember particle density (default "Steady"). */
  ember_intensity?: EmberIntensity;
  /** AIR button effect (default "Streaks + glow"). */
  air_effect?: AirEffect;
  /** Wind streak density (default "Steady"). */
  wind_intensity?: WindIntensity;
  /** Show faint wind streaks while the pump is off (default false). */
  idle_breeze?: boolean;
}

/** Contract HA expects from a card's visual config editor. */
export interface LovelaceCardEditor extends HTMLElement {
  setConfig(config: CardConfig): void;
}

declare global {
  interface Window {
    customCards?: {
      type: string;
      name: string;
      description: string;
      preview?: boolean;
      documentationURL?: string;
    }[];
  }
}
