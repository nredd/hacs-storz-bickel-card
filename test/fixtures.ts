/** Shared fake `hass` objects mirroring the integration's entity layout. */

import type { HassEntity, HomeAssistant } from "../src/types";

export const VOLCANO_DEVICE = "device-volcano";
export const CRAFTY_DEVICE = "device-crafty";

interface ServiceCall {
  domain: string;
  service: string;
  data: Record<string, unknown>;
}

export interface FakeHass extends HomeAssistant {
  serviceCalls: ServiceCall[];
  /** Canned response for the next `callApi` call, settable by tests. */
  apiResponses: Record<string, unknown>;
}

function entity(entityId: string, state: string, attributes: Record<string, unknown> = {}) {
  return { entity_id: entityId, state, attributes } satisfies HassEntity;
}

function registryEntry(entityId: string, deviceId: string, translationKey: string) {
  return {
    entity_id: entityId,
    device_id: deviceId,
    platform: "storz_bickel",
    translation_key: translationKey,
  };
}

/**
 * A hass with a Volcano (pump, no battery, renamed climate entity) and a
 * Crafty (battery + boost + vibration, no pump).
 */
export function makeHass(): FakeHass {
  const serviceCalls: ServiceCall[] = [];
  const apiResponses: Record<string, unknown> = {};
  return {
    serviceCalls,
    apiResponses,
    config: { unit_system: { temperature: "°C" } },
    devices: {
      [VOLCANO_DEVICE]: { id: VOLCANO_DEVICE, name: "Volcano Hybrid", sw_version: "1.2.3" },
      [CRAFTY_DEVICE]: { id: CRAFTY_DEVICE, name: "Crafty", name_by_user: "My Crafty" },
    },
    entities: {
      // Volcano — climate deliberately renamed to prove registry-based lookup.
      "climate.renamed_by_user": registryEntry("climate.renamed_by_user", VOLCANO_DEVICE, "heater"),
      "sensor.volcano_temperature": registryEntry(
        "sensor.volcano_temperature",
        VOLCANO_DEVICE,
        "temperature",
      ),
      "switch.volcano_pump": registryEntry("switch.volcano_pump", VOLCANO_DEVICE, "pump"),
      "switch.volcano_auto_shutoff": registryEntry(
        "switch.volcano_auto_shutoff",
        VOLCANO_DEVICE,
        "auto_shutoff_enabled",
      ),
      "binary_sensor.volcano_connection": registryEntry(
        "binary_sensor.volcano_connection",
        VOLCANO_DEVICE,
        "connection",
      ),
      "number.volcano_led_brightness": registryEntry(
        "number.volcano_led_brightness",
        VOLCANO_DEVICE,
        "led_brightness",
      ),
      "number.volcano_auto_shutoff_minutes": registryEntry(
        "number.volcano_auto_shutoff_minutes",
        VOLCANO_DEVICE,
        "auto_shutoff_minutes",
      ),
      "number.volcano_pump_failsafe_seconds": registryEntry(
        "number.volcano_pump_failsafe_seconds",
        VOLCANO_DEVICE,
        "pump_failsafe_seconds",
      ),
      "number.volcano_pump_cooldown_seconds": registryEntry(
        "number.volcano_pump_cooldown_seconds",
        VOLCANO_DEVICE,
        "pump_cooldown_seconds",
      ),
      "number.volcano_temp_step": registryEntry(
        "number.volcano_temp_step",
        VOLCANO_DEVICE,
        "temp_step",
      ),
      "sensor.volcano_current_session_start": registryEntry(
        "sensor.volcano_current_session_start",
        VOLCANO_DEVICE,
        "current_session_start",
      ),
      "sensor.volcano_session_history": registryEntry(
        "sensor.volcano_session_history",
        VOLCANO_DEVICE,
        "session_history",
      ),
      "sensor.volcano_total_sessions": registryEntry(
        "sensor.volcano_total_sessions",
        VOLCANO_DEVICE,
        "total_sessions",
      ),
      "sensor.volcano_favorite_temperature": registryEntry(
        "sensor.volcano_favorite_temperature",
        VOLCANO_DEVICE,
        "favorite_temperature",
      ),
      "sensor.volcano_total_runtime": registryEntry(
        "sensor.volcano_total_runtime",
        VOLCANO_DEVICE,
        "total_runtime",
      ),
      // Foreign-platform entity on the same device must be ignored.
      "sensor.volcano_battery_foreign": {
        entity_id: "sensor.volcano_battery_foreign",
        device_id: VOLCANO_DEVICE,
        platform: "template",
        translation_key: "battery",
      },
      // Crafty — battery + boost + vibration, no pump.
      "climate.crafty_heater": registryEntry("climate.crafty_heater", CRAFTY_DEVICE, "heater"),
      "sensor.crafty_battery": registryEntry("sensor.crafty_battery", CRAFTY_DEVICE, "battery"),
      "switch.crafty_vibration": registryEntry(
        "switch.crafty_vibration",
        CRAFTY_DEVICE,
        "vibration",
      ),
      "number.crafty_boost": registryEntry(
        "number.crafty_boost",
        CRAFTY_DEVICE,
        "boost_temperature",
      ),
      "binary_sensor.crafty_connection": registryEntry(
        "binary_sensor.crafty_connection",
        CRAFTY_DEVICE,
        "connection",
      ),
    },
    states: {
      "climate.renamed_by_user": entity("climate.renamed_by_user", "heat", {
        current_temperature: 184,
        temperature: 195,
        min_temp: 40,
        max_temp: 230,
        target_temp_step: 1,
        hvac_action: "heating",
      }),
      "sensor.volcano_temperature": entity("sensor.volcano_temperature", "184"),
      "switch.volcano_pump": entity("switch.volcano_pump", "off"),
      "switch.volcano_auto_shutoff": entity("switch.volcano_auto_shutoff", "on"),
      "binary_sensor.volcano_connection": entity("binary_sensor.volcano_connection", "on"),
      "number.volcano_led_brightness": entity("number.volcano_led_brightness", "70", {
        min: 0,
        max: 100,
        step: 1,
      }),
      "number.volcano_auto_shutoff_minutes": entity("number.volcano_auto_shutoff_minutes", "30", {
        min: 0,
        max: 720,
        step: 1,
      }),
      "number.volcano_pump_failsafe_seconds": entity("number.volcano_pump_failsafe_seconds", "45", {
        min: 1,
        max: 600,
        step: 1,
      }),
      "number.volcano_pump_cooldown_seconds": entity("number.volcano_pump_cooldown_seconds", "5", {
        min: 1,
        max: 300,
        step: 1,
      }),
      "number.volcano_temp_step": entity("number.volcano_temp_step", "1", {
        min: 0.5,
        max: 5,
        step: 0.5,
      }),
      "sensor.volcano_current_session_start": entity(
        "sensor.volcano_current_session_start",
        "2026-07-09T14:30:00+00:00",
      ),
      "sensor.volcano_session_history": entity("sensor.volcano_session_history", "6", {
        sessions: [],
        daily_counts: { "2026-07-09": 3, "2026-07-08": 2, "2026-07-07": 1 },
      }),
      "sensor.volcano_total_sessions": entity("sensor.volcano_total_sessions", "6"),
      "sensor.volcano_favorite_temperature": entity("sensor.volcano_favorite_temperature", "185"),
      "sensor.volcano_total_runtime": entity("sensor.volcano_total_runtime", "2217.2"),
      "climate.crafty_heater": entity("climate.crafty_heater", "off", {
        current_temperature: 21,
        temperature: 180,
        min_temp: 40,
        max_temp: 210,
        target_temp_step: 1,
        hvac_action: "off",
      }),
      "sensor.crafty_battery": entity("sensor.crafty_battery", "87"),
      "switch.crafty_vibration": entity("switch.crafty_vibration", "on"),
      "number.crafty_boost": entity("number.crafty_boost", "15", { min: 0, max: 30, step: 1 }),
      "binary_sensor.crafty_connection": entity("binary_sensor.crafty_connection", "on"),
    },
    callService(domain, service, data = {}) {
      serviceCalls.push({ domain, service, data });
      return Promise.resolve();
    },
    callApi<T>(_method: "GET" | "POST", path: string): Promise<T> {
      return Promise.resolve((apiResponses[path] ?? []) as T);
    },
  };
}
