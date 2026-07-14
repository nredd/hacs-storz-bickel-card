import { describe, expect, test } from "bun:test";
import { deviceEntities } from "../src/entities";
import { CRAFTY_DEVICE, makeHass, VOLCANO_DEVICE } from "./fixtures";

describe("deviceEntities", () => {
  test("resolves Volcano entities, including a renamed climate entity", () => {
    const ids = deviceEntities(makeHass(), VOLCANO_DEVICE);
    expect(ids.climate).toBe("climate.renamed_by_user");
    expect(ids.pump).toBe("switch.volcano_pump");
    expect(ids.autoShutoffEnabled).toBe("switch.volcano_auto_shutoff");
    expect(ids.connection).toBe("binary_sensor.volcano_connection");
    expect(ids.ledBrightness).toBe("number.volcano_led_brightness");
    expect(ids.autoShutoffMinutes).toBe("number.volcano_auto_shutoff_minutes");
  });

  test("resolves session and device-info entities", () => {
    const ids = deviceEntities(makeHass(), VOLCANO_DEVICE);
    expect(ids.currentSessionStart).toBe("sensor.volcano_current_session_start");
    expect(ids.currentSessionDuration).toBe("sensor.volcano_current_session_duration");
    expect(ids.sessionHistory).toBe("sensor.volcano_session_history");
    expect(ids.totalSessions).toBe("sensor.volcano_total_sessions");
    expect(ids.favoriteTemperature).toBe("sensor.volcano_favorite_temperature");
    expect(ids.totalRuntime).toBe("sensor.volcano_total_runtime");
    expect(ids.pumpFailsafeSeconds).toBe("number.volcano_pump_failsafe_seconds");
    expect(ids.pumpCooldownSeconds).toBe("number.volcano_pump_cooldown_seconds");
    expect(ids.tempStep).toBe("number.volcano_temp_step");
  });

  test("capability detection: Volcano has no battery, boost, or vibration", () => {
    const ids = deviceEntities(makeHass(), VOLCANO_DEVICE);
    expect(ids.battery).toBeUndefined();
    expect(ids.boostTemperature).toBeUndefined();
    expect(ids.vibration).toBeUndefined();
  });

  test("capability detection: Crafty has battery/boost/vibration but no pump", () => {
    const ids = deviceEntities(makeHass(), CRAFTY_DEVICE);
    expect(ids.climate).toBe("climate.crafty_heater");
    expect(ids.battery).toBe("sensor.crafty_battery");
    expect(ids.boostTemperature).toBe("number.crafty_boost");
    expect(ids.vibration).toBe("switch.crafty_vibration");
    expect(ids.pump).toBeUndefined();
  });

  test("ignores same-device entities from other integrations", () => {
    // sensor.volcano_battery_foreign has translation_key "battery" but
    // platform "template"; it must not be picked up.
    const ids = deviceEntities(makeHass(), VOLCANO_DEVICE);
    expect(ids.battery).toBeUndefined();
  });

  test("returns nothing for an unknown device", () => {
    const ids = deviceEntities(makeHass(), "device-unknown");
    expect(Object.values(ids).every((id) => id === undefined)).toBe(true);
  });
});
