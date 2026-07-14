/**
 * Entity discovery for a configured device.
 *
 * The card is configured with a device registry id only; every entity id is
 * derived from `hass.entities` by matching the integration platform and each
 * entity's `translation_key` (which the integration sets equal to its entity
 * description key). Registry lookups survive user entity renames, and a
 * missing key doubles as capability detection — e.g. no `pump` entity means
 * the device has no pump and the card hides that control.
 */

import { INTEGRATION_DOMAIN } from "./const";
import type { HomeAssistant } from "./types";

/** Entity ids resolved for one device; absent keys mean absent capabilities. */
export interface DeviceEntityIds {
  climate?: string;
  temperature?: string;
  pump?: string;
  vibration?: string;
  autoShutoffEnabled?: string;
  battery?: string;
  connection?: string;
  ledBrightness?: string;
  autoShutoffMinutes?: string;
  boostTemperature?: string;
  currentSessionStart?: string;
  currentSessionDuration?: string;
  sessionHistory?: string;
  totalSessions?: string;
  favoriteTemperature?: string;
  totalRuntime?: string;
  bleFirmwareVersion?: string;
  pumpFailsafeSeconds?: string;
  pumpCooldownSeconds?: string;
  tempStep?: string;
}

/** Resolve the integration's entity ids for `deviceId` from the registry. */
export function deviceEntities(hass: HomeAssistant, deviceId: string): DeviceEntityIds {
  const entries = Object.values(hass.entities).filter(
    (entry) => entry.device_id === deviceId && entry.platform === INTEGRATION_DOMAIN,
  );
  const find = (domain: string, key: string): string | undefined =>
    entries.find(
      (entry) => entry.entity_id.startsWith(`${domain}.`) && entry.translation_key === key,
    )?.entity_id;

  return {
    climate: find("climate", "heater"),
    temperature: find("sensor", "temperature"),
    pump: find("switch", "pump"),
    vibration: find("switch", "vibration"),
    autoShutoffEnabled: find("switch", "auto_shutoff_enabled"),
    battery: find("sensor", "battery"),
    connection: find("binary_sensor", "connection"),
    ledBrightness: find("number", "led_brightness"),
    autoShutoffMinutes: find("number", "auto_shutoff_minutes"),
    boostTemperature: find("number", "boost_temperature"),
    currentSessionStart: find("sensor", "current_session_start"),
    currentSessionDuration: find("sensor", "current_session_duration"),
    sessionHistory: find("sensor", "session_history"),
    totalSessions: find("sensor", "total_sessions"),
    favoriteTemperature: find("sensor", "favorite_temperature"),
    totalRuntime: find("sensor", "total_runtime"),
    bleFirmwareVersion: find("sensor", "ble_firmware_version"),
    pumpFailsafeSeconds: find("number", "pump_failsafe_seconds"),
    pumpCooldownSeconds: find("number", "pump_cooldown_seconds"),
    tempStep: find("number", "temp_step"),
  };
}
