/**
 * Pure view model — a 1:1 port of the design prototype's `renderVals()`
 * (docs/design/vaporizer-card-final.dc.html lines 372–640).
 *
 * Every style object below is transcribed verbatim from the prototype so the
 * rendered inline CSS is identical; when the design is revised, diff this file
 * against the prototype's `renderVals()`. Deliberate generalizations only:
 *
 * - Internal math runs in the integration's native unit with the climate
 *   entity's min/max range (the prototype hardcoded °F and 104–446).
 * - `temp`/`target` may be undefined (entity unavailable) — LCD digits render
 *   `---` over the same 888 ghost, charts render empty, layout never shifts.
 * - Chart series and session buckets arrive from the data layer
 *   (src/history.ts, src/sessions.ts) instead of the demo generators.
 *
 * No Lit or hass imports: plain data in, plain style/string data out.
 */

import { type NiceAxis, niceAxis, smoothPathXY, toDisplayTemp } from "./format";
import type {
  AirEffect,
  EmberIntensity,
  HeatEffect,
  SeriesPoint,
  TempUnit,
  WindIntensity,
} from "./types";

/** Inline-style object rendered with Lit's `styleMap()` (camelCase keys). */
export type StyleInfo = Record<string, string | number>;

/** Effect configuration (prototype `data-props`, card config in snake_case). */
export interface EffectConfig {
  heatEffect: HeatEffect;
  emberIntensity: EmberIntensity;
  airEffect: AirEffect;
  windIntensity: WindIntensity;
  idleBreeze: boolean;
}

/** Prototype prop defaults (line 217 `data-props`). */
export const DEFAULT_EFFECTS: EffectConfig = {
  heatEffect: "Embers + glow",
  emberIntensity: "Steady",
  airEffect: "Streaks + glow",
  windIntensity: "Steady",
  idleBreeze: false,
};

/** One knob tick mark (prototype lines 449–477). */
export interface TickMark {
  label: string;
  outerStyle: StyleInfo;
  dashStyle: StyleInfo;
  innerStyle: StyleInfo;
  labelStyle: StyleInfo;
}

/** One chart Y-axis tick: label + gridline (prototype lines 519–526, 551–559). */
export interface AxisTick {
  label: string;
  labelStyle: StyleInfo;
  gridStyle: StyleInfo;
}

/** Everything the card template needs to render one frame. */
export interface ViewModelInput {
  /** Current temperature in native units, undefined when unavailable. */
  temp?: number;
  /** Target temperature in native units (pending optimistic value applied). */
  target?: number;
  /** Heater on (climate.state === "heat"). */
  heating: boolean;
  /** Pump/AIR on. */
  pump: boolean;
  /** The integration's native unit. */
  native: TempUnit;
  /** Unit selected by the °F/°C toggle. */
  display: TempUnit;
  /** Knob range in native units (climate min_temp/max_temp). */
  minT: number;
  maxT: number;
  /** Draft text while the target input is focused, else null. */
  targetDraft: string | null;
  /** Temperature history in native units, time-bucketed (src/history.ts). */
  series: SeriesPoint[];
  /** Current time, ms epoch — the chart's right edge. */
  now: number;
  /** Previous frame's chart axis, kept while data still fits (hysteresis). */
  axisHint?: NiceAxis;
  chartWindowMin: number;
  sessionWindowH: number;
  /** 48 buckets of session-minutes spanning the window (src/sessions.ts). */
  sessionBuckets: number[];
  /** Total sessions in the window. */
  sessionCount: number;
  effects: EffectConfig;
}

const ACCENT = "#ff6a3d";

/** Prototype lines 383 / 412: animation density per intensity setting. */
const EMBER_CONF: Record<string, { n: number; dur: number }> = {
  Smolder: { n: 5, dur: 3.6 },
  Steady: { n: 9, dur: 2.4 },
  Inferno: { n: 16, dur: 1.3 },
};
const WIND_CONF: Record<string, { n: number; dur: number }> = {
  Breeze: { n: 4, dur: 3.4 },
  Steady: { n: 7, dur: 2.2 },
  Gale: { n: 12, dur: 1.25 },
};

/** Prototype line 377: shared HEAT/AIR button base style. */
const BIG_BTN: StyleInfo = {
  border: "none",
  borderRadius: "100px",
  padding: "16px 0",
  fontSize: "14px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  cursor: "pointer",
  fontFamily: "'Inter',sans-serif",
};

/** Prototype lines 384–401: rising ember particles on the HEAT button. */
export function emberStyles(
  effects: EffectConfig,
  heating: boolean,
  holding: boolean,
): StyleInfo[] {
  const wantEmbers = effects.heatEffect === "Embers + glow" || effects.heatEffect === "Embers only";
  const emberConf = EMBER_CONF[effects.emberIntensity] ?? { n: 9, dur: 2.4 };
  const embers: StyleInfo[] = [];
  if (wantEmbers && heating) {
    const calm = holding ? 1.6 : 1; // settle down once target is reached
    for (let i = 0; i < emberConf.n; i++) {
      const left = 6 + ((i * 41) % 88);
      const size = 2 + ((i * 13) % 3);
      const dur = emberConf.dur * calm * (0.7 + ((i * 59) % 45) / 100);
      const delay = -(((i * 83) % 100) / 100) * dur;
      embers.push({
        position: "absolute",
        bottom: "-6px",
        left: `${left}%`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: "rgba(255,236,200,0.9)",
        boxShadow: "0 0 6px rgba(255,220,160,0.8)",
        animation: `emberRise ${dur.toFixed(2)}s ease-out infinite`,
        animationDelay: `${delay.toFixed(2)}s`,
        pointerEvents: "none",
      });
    }
  }
  return embers;
}

/** Prototype lines 413–430: horizontal wind streaks on the AIR button. */
export function windStreakStyles(effects: EffectConfig, pump: boolean): StyleInfo[] {
  const wantStreaks =
    effects.airEffect === "Streaks + glow" || effects.airEffect === "Streaks only";
  const showStreaks = wantStreaks && (pump || effects.idleBreeze);
  const conf = WIND_CONF[effects.windIntensity] ?? { n: 7, dur: 2.2 };
  const windStreaks: StyleInfo[] = [];
  if (showStreaks) {
    for (let i = 0; i < conf.n; i++) {
      const top = 12 + ((i * 37) % 74);
      const dur = conf.dur * (0.7 + ((i * 53) % 40) / 100);
      const delay = -(((i * 71) % 100) / 100) * dur;
      const w = 26 + ((i * 29) % 36);
      windStreaks.push({
        position: "absolute",
        top: `${top}%`,
        left: "-70px",
        width: `${w}px`,
        height: "2px",
        borderRadius: "2px",
        background: pump
          ? "linear-gradient(90deg, rgba(26,18,7,0), rgba(26,18,7,0.45), rgba(26,18,7,0))"
          : "linear-gradient(90deg, rgba(255,106,61,0), rgba(255,106,61,0.35), rgba(255,106,61,0))",
        animation: `windDrift ${dur.toFixed(2)}s linear infinite`,
        animationDelay: `${delay.toFixed(2)}s`,
        pointerEvents: "none",
      });
    }
  }
  return windStreaks;
}

/** Prototype lines 449–477: knob tick marks with edge-clearance label layout. */
export function tickMarks(minT: number, maxT: number, native: TempUnit, display: TempUnit) {
  const sweep = 300;
  const startA = -150;
  const marks: TickMark[] = [];
  for (let a = -150; a <= 150; a += 12.5) {
    const isMajor = (a + 150) % 75 === 0;
    const outerStyle: StyleInfo = {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: 0,
      height: 0,
      transform: `translate(-50%,-50%) rotate(${a}deg)`,
    };
    if (!isMajor) {
      marks.push({
        label: "",
        outerStyle,
        dashStyle: {
          position: "absolute",
          left: "-0.5px",
          top: "-124px",
          width: "1px",
          height: "7px",
          borderRadius: "0.5px",
          background: "rgba(255,255,255,0.22)",
        },
        innerStyle: { display: "none" },
        labelStyle: {},
      });
      continue;
    }
    const tNative = minT + ((a - startA) / sweep) * (maxT - minT);
    const label = `${toDisplayTemp(tNative, native, display)}°${display}`;
    const rad = (a * Math.PI) / 180;
    // Push the label center out so its nearest EDGE keeps constant clearance
    // from the tick, accounting for the label's width/height at this angle
    // (like a real printed dial face).
    const halfW = label.length * 3.1;
    const halfH = 5;
    const rc = 134 + halfW * Math.abs(Math.sin(rad)) + halfH * Math.abs(Math.cos(rad));
    marks.push({
      label,
      outerStyle,
      dashStyle: {
        position: "absolute",
        left: "-1px",
        top: "-128px",
        width: "2px",
        height: "13px",
        borderRadius: "1px",
        background: "rgba(255,255,255,0.55)",
      },
      innerStyle: {
        position: "absolute",
        left: 0,
        top: `${-rc}px`,
        display: "flex",
        transform: `translate(-50%,-50%) rotate(${-a}deg)`,
      },
      labelStyle: {
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: "10px",
        color: "#6b6459",
        whiteSpace: "nowrap",
      },
    });
  }
  return marks;
}

/** Prototype lines 445–448: pointer angle for a target temperature. */
export function knobRotation(target: number | undefined, minT: number, maxT: number): number {
  const sweep = 300;
  const startA = -150;
  const targetPct = target === undefined ? 0 : (target - minT) / (maxT - minT);
  return startA + Math.max(0, Math.min(1, targetPct)) * sweep;
}

/** The full render frame; field names match the prototype's `v` object. */
export function buildViewModel(input: ViewModelInput) {
  const s = input;
  const progress =
    s.temp === undefined || s.target === undefined || s.target <= 0
      ? 0
      : Math.max(0, Math.min(1, s.temp / s.target));
  const holding = s.heating && s.temp !== undefined && s.target !== undefined && s.temp >= s.target;

  // HEAT button (prototype lines 378–405)
  const wantHeatGlow =
    s.effects.heatEffect === "Embers + glow" || s.effects.heatEffect === "Glow only";
  const embers = emberStyles(s.effects, s.heating, holding);
  const heatBtnStyle: StyleInfo = s.heating
    ? {
        ...BIG_BTN,
        flex: "1 1 0",
        background: ACCENT,
        color: "#1a1207",
        boxShadow: "0 6px 20px rgba(255,106,61,0.45)",
        position: "relative",
        overflow: "hidden",
        animation: wantHeatGlow && !holding ? "pulseGlow 2s ease-in-out infinite" : "none",
      }
    : {
        ...BIG_BTN,
        flex: "1 1 0",
        background: "#242019",
        color: "#e8e2d4",
        position: "relative",
        overflow: "hidden",
      };
  const heatLabelStyle: StyleInfo = { position: "relative" };

  // AIR button (prototype lines 406–439)
  const wantGlow = s.effects.airEffect === "Streaks + glow" || s.effects.airEffect === "Glow only";
  const windStreaks = windStreakStyles(s.effects, s.pump);
  const pumpBtnBigStyle: StyleInfo = s.pump
    ? {
        ...BIG_BTN,
        flex: "1 1 0",
        background: ACCENT,
        color: "#1a1207",
        boxShadow: "0 6px 20px rgba(255,106,61,0.45)",
        position: "relative",
        overflow: "hidden",
        animation: wantGlow ? "airBreathe 2.2s ease-in-out infinite" : "none",
      }
    : {
        ...BIG_BTN,
        flex: "1 1 0",
        background: "#242019",
        color: "#e8e2d4",
        border: "1px solid rgba(255,255,255,0.1)",
        position: "relative",
        overflow: "hidden",
      };
  const pumpLabelStyle: StyleInfo = {
    position: "relative",
    letterSpacing: s.pump ? "0.26em" : "0.08em",
    marginRight: s.pump ? "-0.26em" : "-0.08em",
    transition:
      "letter-spacing 0.6s cubic-bezier(0.22,1,0.36,1), margin-right 0.6s cubic-bezier(0.22,1,0.36,1)",
  };

  // °F/°C toggle (prototype lines 441–443)
  const unitBase: StyleInfo = {
    border: "none",
    padding: "8px 12px",
    fontSize: "12px",
    fontFamily: "'JetBrains Mono',monospace",
    cursor: "pointer",
  };
  const unitFStyle: StyleInfo =
    s.display === "F"
      ? { ...unitBase, background: ACCENT, color: "#1a1207" }
      : { ...unitBase, background: "#242019", color: "#a39a8c" };
  const unitCStyle: StyleInfo =
    s.display === "C"
      ? { ...unitBase, background: ACCENT, color: "#1a1207" }
      : { ...unitBase, background: "#242019", color: "#a39a8c" };

  // Knob (prototype lines 445–491)
  const rotation = knobRotation(s.target, s.minT, s.maxT);
  const marks = tickMarks(s.minT, s.maxT, s.native, s.display);
  const knobWrapperStyle: StyleInfo = {
    width: "190px",
    height: "190px",
    borderRadius: "50%",
    position: "relative",
    background: "#0e0c09",
    boxShadow: "0 16px 34px rgba(0,0,0,0.55), 0 3px 6px rgba(0,0,0,0.4)",
  };
  const knobStyle: StyleInfo = {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    background: "radial-gradient(circle at 50% 30%, #433c31 0%, #211d17 58%, #16130e 100%)",
    position: "absolute",
    inset: 0,
    transform: `rotate(${rotation}deg)`,
    transition: "transform 0.6s ease",
  };
  const knobOverlayStyle: StyleInfo = {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    pointerEvents: "none",
    boxShadow:
      "inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 3px 5px rgba(255,255,255,0.05), inset 0 -12px 24px rgba(0,0,0,0.5)",
  };

  // Header heat LEDs (prototype lines 493–498)
  const litCount = Math.round(progress * 5);
  const ledStyles: StyleInfo[] = [0, 1, 2, 3, 4].map((i) => ({
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    background: i < litCount ? ACCENT : "#2a2620",
    boxShadow: i < litCount ? "0 0 8px rgba(255,106,61,0.8)" : "none",
  }));

  // Session bars (prototype lines 506–535, demo generator replaced by data)
  const buckets = s.sessionBuckets;
  const maxBucket = Math.max(...buckets, 1);
  const sessionAxis = niceAxis(0, maxBucket);
  const sAxisMax = sessionAxis.niceHi;
  const sessionYTicks: AxisTick[] = sessionAxis.ticks.map((t) => {
    const top = (1 - t / sAxisMax) * 70;
    return {
      label: String(t),
      labelStyle: {
        position: "absolute",
        top: `${top}px`,
        right: "4px",
        transform: "translateY(-50%)",
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: "9px",
        color: "#6b6459",
      },
      gridStyle: {
        position: "absolute",
        left: 0,
        right: 0,
        top: `${top}px`,
        height: "1px",
        background: "rgba(255,255,255,0.05)",
      },
    };
  });
  const sessionBars: StyleInfo[] = buckets.map((val, i) => {
    const isNow = i === buckets.length - 1;
    const h = val === 0 ? 3 : Math.max(6, (val / sAxisMax) * 100);
    return {
      flex: 1,
      height: `${h}%`,
      borderRadius: "2px",
      background: val === 0 ? "#242019" : isNow ? ACCENT : "#c85a35",
      boxShadow: val > 0 && isNow ? "0 0 8px rgba(255,106,61,0.6)" : "none",
    };
  });

  // Live temperature chart (prototype lines 544–566, with a time-based x
  // axis over src/history.ts's stable time buckets instead of the
  // prototype's index-based mapping — same styling, smoother live motion)
  const series = s.series;
  const windowMs = s.chartWindowMin * 60_000;
  let livePath = "";
  let liveAreaPath = "";
  let yTicks: AxisTick[] = [];
  let liveDotStyle: StyleInfo = { display: "none" };
  let chartAxis: NiceAxis | undefined;
  if (series.length > 0) {
    const values = series.map((point) => point.v);
    const dataLo = Math.min(...values);
    const dataHi = Math.max(...values);
    const pad = Math.max(4, (dataHi - dataLo) * 0.15);
    // Axis hysteresis: keep the previous bounds while the data still fits
    // (and the axis isn't grossly oversized for it) so the grid doesn't
    // twitch on every sample.
    const hint = s.axisHint;
    const keepHint =
      hint !== undefined &&
      dataLo >= hint.niceLo &&
      dataHi <= hint.niceHi &&
      hint.niceHi - hint.niceLo <= 2 * (dataHi - dataLo + 2 * pad);
    const axis = keepHint ? hint : niceAxis(dataLo - pad, dataHi + pad);
    chartAxis = axis;
    const aMin = axis.niceLo;
    const aMax = axis.niceHi;
    // Time-based x: a sample's position depends only on its timestamp, so
    // the trace pans left smoothly as `now` advances instead of reflowing.
    const xFor = (t: number) =>
      Math.min(560, Math.max(0, ((t - (s.now - windowMs)) / windowMs) * 560));
    const yFor = (v: number) => 110 - ((v - aMin) / (aMax - aMin)) * 110;
    const pts: [number, number][] = series.map((point) => [xFor(point.t), yFor(point.v)]);
    // Extend-to-now: the trace always meets the live dot at the right edge.
    const last = pts[pts.length - 1];
    if (last && last[0] < 560) {
      pts.push([560, last[1]]);
    }
    livePath = smoothPathXY(pts);
    liveAreaPath = livePath ? `${livePath} L560,110 L0,110 Z` : "";
    yTicks = axis.ticks.map((t) => {
      const frac = (t - aMin) / (aMax - aMin);
      const top = (1 - frac) * 110;
      return {
        label: `${toDisplayTemp(t, s.native, s.display)}°`,
        labelStyle: {
          position: "absolute",
          top: `${top}px`,
          right: "6px",
          transform: "translateY(-50%)",
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: "9px",
          color: "#6b6459",
          whiteSpace: "nowrap",
        },
        gridStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          top: `${top}px`,
          height: "1px",
          background: "rgba(255,255,255,0.05)",
        },
      };
    });
    const lastVal = values[values.length - 1] ?? 0;
    const lastFrac = (lastVal - aMin) / (aMax - aMin);
    liveDotStyle = {
      position: "absolute",
      top: `${(1 - lastFrac) * 110}px`,
      right: "0",
      transform: "translate(50%,-50%)",
      width: "9px",
      height: "9px",
      borderRadius: "50%",
      background: "#ff6a3d",
      boxShadow: "0 0 0 3px rgba(255,106,61,0.18), 0 0 10px rgba(255,106,61,0.7)",
      // Not in the static design (invisible there): glides the dot between
      // 1 Hz samples instead of stepping.
      transition: "top 1s linear",
    };
  }

  // Axis captions (prototype lines 567–574)
  const cw = s.chartWindowMin;
  const chartXTicks = [
    `−${cw} min`,
    `−${Math.round((cw * 2) / 3)}`,
    `−${Math.round(cw / 3)}`,
    "now",
  ];
  const sw = s.sessionWindowH;
  const sessionXTicks = [
    `−${sw}h`,
    `−${Math.round((sw * 3) / 4)}h`,
    `−${Math.round(sw / 2)}h`,
    `−${Math.round(sw / 4)}h`,
    "now",
  ];
  const sessionWindowLabel = `${sw}h`;

  // LCD target line (prototype lines 576–585)
  const targetLineStyle: StyleInfo = {
    position: "relative",
    fontFamily: "'DSEG7 Classic',monospace",
    fontSize: "46px",
    fontWeight: 400,
    letterSpacing: "0.01em",
    marginTop: "4px",
    lineHeight: 1,
  };
  const targetGhostStyle: StyleInfo = {
    color: s.heating ? "rgba(242,237,228,0.08)" : "rgba(58,53,44,0.35)",
  };
  const targetDigitsStyle: StyleInfo = {
    position: "absolute",
    inset: 0,
    textAlign: "right",
    color: s.heating ? "#f2ede4" : "#3a352c",
    textShadow: s.heating ? "0 0 12px rgba(255,255,255,0.25)" : "none",
  };

  // Display strings (prototype lines 587–598; `---`/`—` when data missing)
  const dTemp = s.temp === undefined ? undefined : toDisplayTemp(s.temp, s.native, s.display);
  const dTarget = s.target === undefined ? undefined : toDisplayTemp(s.target, s.native, s.display);
  const tempNum = dTemp === undefined ? "---" : String(dTemp);
  const targetNum = dTarget === undefined ? "---" : String(dTarget);
  const tempDisplay = dTemp === undefined ? "—" : `${dTemp}°${s.display}`;
  const targetDisplay = dTarget === undefined ? "—" : `${dTarget}°${s.display}`;
  const targetFieldValue = s.targetDraft != null ? s.targetDraft : targetDisplay;

  // Select field chrome (prototype line 635)
  const fieldStyle: StyleInfo = {
    background: "#242019",
    color: "#f2ede4",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "7px",
    padding: "5px 10px",
    fontSize: "12px",
    fontFamily: "'JetBrains Mono',monospace",
    cursor: "pointer",
  };

  return {
    tempNum,
    targetNum,
    tempDisplay,
    targetDisplay,
    targetFieldValue,
    embers,
    heatBtnStyle,
    heatLabelStyle,
    windStreaks,
    pumpBtnBigStyle,
    pumpLabelStyle,
    unitFStyle,
    unitCStyle,
    tickMarks: marks,
    knobWrapperStyle,
    knobStyle,
    knobOverlayStyle,
    ledStyles,
    sessionBars,
    sessionYTicks,
    sessionCount: s.sessionCount,
    sessionXTicks,
    sessionWindowLabel,
    livePath,
    liveAreaPath,
    yTicks,
    liveDotStyle,
    chartAxis,
    chartXTicks,
    targetLineStyle,
    targetGhostStyle,
    targetDigitsStyle,
    fieldStyle,
    chartWindowOptions: [5, 10, 30, 60, 120, 180, 240].map((m) => ({
      value: m,
      label: `${m} min`,
    })),
    sessionWindowOptions: [6, 12, 24, 36, 48, 72].map((h) => ({ value: h, label: `${h} h` })),
  };
}

/** The card's render frame type. */
export type ViewModel = ReturnType<typeof buildViewModel>;
