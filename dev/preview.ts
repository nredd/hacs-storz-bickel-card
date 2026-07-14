/**
 * Standalone mock preview: the real card wired to a simulated Volcano, for
 * pixel comparison against docs/design/vaporizer-card-final.dc.html without a
 * Home Assistant instance. Served at http://localhost:5000/preview by
 * script/dev-server.ts; never part of the release bundle.
 *
 * Ports the prototype's simulator: the 1 Hz heat loop (lines 232–242) and
 * `seedHistory()` demo backlog (lines 246–269). `callService` mutates the
 * mock state so every control on the card works. Native unit is °F with a
 * 104–446 climate range so the rendered numbers match the prototype exactly.
 */

import "../src/storz-bickel-card";
import type { StorzBickelCard } from "../src/storz-bickel-card";
import type { HassEntity, HistoryStateRecord, HomeAssistant } from "../src/types";

const DEVICE_ID = "mock-volcano";

/**
 * Session semantics mirror the integration's SessionTracker: a window opens
 * on the heater's rising edge and survives heater-off periods shorter than
 * the grace timeout — the session start (and thus the card's timer) must NOT
 * reset on a quick HEAT off/on toggle. Only after grace expires does the
 * window finalize, and only qualifying windows (≥ min duration) are recorded.
 */
const GRACE_MS = 900_000; // SESSION_HEATER_OFF_TIMEOUT_SECONDS
const MIN_SESSION_MS = 120_000; // SESSION_MIN_DURATION_SECONDS

interface MockState {
  temp: number;
  target: number;
  heating: boolean;
  pump: boolean;
  autoShutoffMin: number;
  pumpFailsafeSec: number;
  sessionStart?: string;
  heaterOffSince?: string;
  sessions: { start: string; stop?: string }[];
  history: number[]; // 1 sample/sec, newest last
}

/** Prototype `seedHistory` (lines 246–269): 240 min of plausible backlog. */
function seedHistory(endTemp: number): number[] {
  const total = 240 * 60;
  const pts = new Array<number>(total);
  let temp = 78;
  const sched = [
    { start: total - 13500, end: total - 11700, tgt: 356 },
    { start: total - 9200, end: total - 7700, tgt: 370 },
    { start: total - 3900, end: total - 2600, tgt: 392 },
  ];
  for (let i = 0; i < total; i++) {
    let tgt = 78;
    for (const w of sched) {
      if (i >= w.start && i < w.end) {
        tgt = w.tgt;
      }
    }
    if (temp < tgt) {
      temp = Math.min(tgt, temp + 0.4);
    } else if (temp > tgt) {
      temp = Math.max(tgt, temp - (temp - 78) * 0.0012);
    }
    pts[i] = +temp.toFixed(1);
  }
  const rampLen = 600;
  const from = pts[total - rampLen - 1] ?? 78;
  for (let i = 0; i < rampLen; i++) {
    const f = (i + 1) / rampLen;
    pts[total - rampLen + i] = +(from + (endTemp - from) * f).toFixed(1);
  }
  return pts;
}

/** A couple of days of demo session records for the bar chart. */
function seedSessions(now: number): { start: string; stop?: string }[] {
  const sessions: { start: string; stop?: string }[] = [];
  const starts = [2, 5, 9, 14, 22, 27, 33, 41, 46];
  for (const hoursAgo of starts) {
    const start = now - hoursAgo * 3_600_000;
    const minutes = 4 + ((hoursAgo * 7) % 14);
    sessions.push({
      start: new Date(start).toISOString(),
      stop: new Date(start + minutes * 60_000).toISOString(),
    });
  }
  return sessions;
}

const mock: MockState = {
  temp: 158,
  target: 185,
  heating: true,
  pump: false,
  autoShutoffMin: 30,
  pumpFailsafeSec: 30,
  sessionStart: new Date(Date.now() - 754_000).toISOString(),
  sessions: seedSessions(Date.now()),
  history: seedHistory(158),
};

let graceTimer: ReturnType<typeof setTimeout> | undefined;

/** Grace expired: close the window; record it only if it qualifies. */
function finalizeSession(): void {
  if (mock.sessionStart && mock.heaterOffSince) {
    const startMs = Date.parse(mock.sessionStart);
    const stopMs = Date.parse(mock.heaterOffSince);
    if (stopMs - startMs >= MIN_SESSION_MS) {
      mock.sessions.push({ start: mock.sessionStart, stop: mock.heaterOffSince });
    }
  }
  mock.sessionStart = undefined;
  mock.heaterOffSince = undefined;
  commit();
}

function entity(entityId: string, state: string, attributes: Record<string, unknown> = {}) {
  return { entity_id: entityId, state, attributes } satisfies HassEntity;
}

function registryEntry(entityId: string, translationKey: string) {
  return {
    entity_id: entityId,
    device_id: DEVICE_ID,
    platform: "storz_bickel",
    translation_key: translationKey,
  };
}

function dailyCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const session of mock.sessions) {
    const day = session.start.slice(0, 10);
    counts[day] = (counts[day] ?? 0) + 1;
  }
  return counts;
}

function buildHass(): HomeAssistant {
  return {
    config: { unit_system: { temperature: "°F" } },
    devices: {
      [DEVICE_ID]: {
        id: DEVICE_ID,
        name: "Volcano Hybrid",
        name_by_user: "Bag Bertha",
        sw_version: "V01.02.00.00",
      },
    },
    entities: {
      "climate.volcano": registryEntry("climate.volcano", "heater"),
      "sensor.volcano_temperature": registryEntry("sensor.volcano_temperature", "temperature"),
      "switch.volcano_pump": registryEntry("switch.volcano_pump", "pump"),
      "binary_sensor.volcano_connection": registryEntry(
        "binary_sensor.volcano_connection",
        "connection",
      ),
      "number.volcano_auto_shutoff_minutes": registryEntry(
        "number.volcano_auto_shutoff_minutes",
        "auto_shutoff_minutes",
      ),
      "number.volcano_pump_failsafe_seconds": registryEntry(
        "number.volcano_pump_failsafe_seconds",
        "pump_failsafe_seconds",
      ),
      "sensor.volcano_current_session_start": registryEntry(
        "sensor.volcano_current_session_start",
        "current_session_start",
      ),
      "sensor.volcano_current_session_duration": registryEntry(
        "sensor.volcano_current_session_duration",
        "current_session_duration",
      ),
      "sensor.volcano_session_history": registryEntry(
        "sensor.volcano_session_history",
        "session_history",
      ),
      "sensor.volcano_total_runtime": registryEntry(
        "sensor.volcano_total_runtime",
        "total_runtime",
      ),
      "sensor.volcano_ble_firmware_version": registryEntry(
        "sensor.volcano_ble_firmware_version",
        "ble_firmware_version",
      ),
    },
    states: {
      "climate.volcano": entity("climate.volcano", mock.heating ? "heat" : "off", {
        current_temperature: mock.temp,
        temperature: mock.target,
        min_temp: 104,
        max_temp: 446,
        target_temp_step: 1,
        hvac_action: mock.heating ? (mock.temp >= mock.target ? "idle" : "heating") : "off",
      }),
      "sensor.volcano_temperature": entity("sensor.volcano_temperature", String(mock.temp)),
      "switch.volcano_pump": entity("switch.volcano_pump", mock.pump ? "on" : "off"),
      "binary_sensor.volcano_connection": entity("binary_sensor.volcano_connection", "on"),
      "number.volcano_auto_shutoff_minutes": entity(
        "number.volcano_auto_shutoff_minutes",
        String(mock.autoShutoffMin),
        { min: 0, max: 720, step: 1 },
      ),
      "number.volcano_pump_failsafe_seconds": entity(
        "number.volcano_pump_failsafe_seconds",
        String(mock.pumpFailsafeSec),
        { min: 1, max: 600, step: 1 },
      ),
      "sensor.volcano_current_session_start": entity(
        "sensor.volcano_current_session_start",
        mock.sessionStart ?? "unknown",
      ),
      "sensor.volcano_current_session_duration": entity(
        "sensor.volcano_current_session_duration",
        mock.sessionStart
          ? String(Math.round((Date.now() - Date.parse(mock.sessionStart)) / 1000))
          : "unknown",
      ),
      "sensor.volcano_session_history": entity(
        "sensor.volcano_session_history",
        String(mock.sessions.length),
        { sessions: mock.sessions, daily_counts: dailyCounts() },
      ),
      "sensor.volcano_total_runtime": entity("sensor.volcano_total_runtime", "2217.2"),
      "sensor.volcano_ble_firmware_version": entity(
        "sensor.volcano_ble_firmware_version",
        "V01.00.00.00",
      ),
    },
    callService(domain, service, data = {}) {
      if (domain === "climate" && service === "set_temperature") {
        mock.target = Math.max(104, Math.min(446, Number(data.temperature)));
      } else if (domain === "climate" && service === "set_hvac_mode") {
        const on = data.hvac_mode === "heat";
        if (on && !mock.heating) {
          if (mock.sessionStart && mock.heaterOffSince) {
            // Back on within grace: the same window resumes, start unchanged.
            clearTimeout(graceTimer);
            mock.heaterOffSince = undefined;
          } else if (!mock.sessionStart) {
            mock.sessionStart = new Date().toISOString();
          }
        }
        if (!on && mock.heating && mock.sessionStart) {
          mock.heaterOffSince = new Date().toISOString();
          clearTimeout(graceTimer);
          graceTimer = setTimeout(finalizeSession, GRACE_MS);
        }
        mock.heating = on;
      } else if (domain === "switch") {
        mock.pump = service === "turn_on";
      } else if (domain === "number" && service === "set_value") {
        const value = Number(data.value);
        if (data.entity_id === "number.volcano_auto_shutoff_minutes") {
          mock.autoShutoffMin = value;
        } else if (data.entity_id === "number.volcano_pump_failsafe_seconds") {
          mock.pumpFailsafeSec = value;
        }
      }
      commit();
      return Promise.resolve();
    },
    callApi<T>(_method: "GET" | "POST", path: string): Promise<T> {
      if (path.startsWith("history/period")) {
        const now = Date.now();
        const records: HistoryStateRecord[] = mock.history.map((value, i) => ({
          state: String(value),
          last_changed: new Date(now - (mock.history.length - 1 - i) * 1000).toISOString(),
        }));
        return Promise.resolve([records] as T);
      }
      return Promise.resolve([] as T);
    },
  };
}

const frame = document.getElementById("frame") as HTMLDivElement;
const card = document.createElement("storz-bickel-card") as StorzBickelCard;
card.setConfig({ type: "custom:storz-bickel-card", device: DEVICE_ID });

function commit(): void {
  card.hass = buildHass();
}

commit();
frame.appendChild(card);

// Prototype's 1 Hz simulator (lines 232–242): approach the target while
// heating and keep the rolling backlog.
setInterval(() => {
  if (mock.heating && mock.temp < mock.target) {
    mock.temp = Math.min(mock.target, +(mock.temp + 0.4).toFixed(1));
  }
  mock.history = mock.history.concat([mock.temp]).slice(-14_400);
  commit();
}, 1000);

// Container width slider → proportional scaling check.
const widthInput = document.getElementById("width") as HTMLInputElement;
const widthLabel = document.getElementById("width-label") as HTMLSpanElement;
function applyWidth(): void {
  frame.style.maxWidth = `${widthInput.value}px`;
  widthLabel.textContent = `${widthInput.value}px`;
}
widthInput.addEventListener("input", applyWidth);
applyWidth();
