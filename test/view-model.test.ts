import { describe, expect, it } from "bun:test";
import {
  buildViewModel,
  DEFAULT_EFFECTS,
  emberStyles,
  knobRotation,
  tickMarks,
  type ViewModelInput,
  windStreakStyles,
} from "../src/view-model";

/** Fixed "now" so time-based chart math is deterministic. */
const NOW = Date.parse("2026-07-11T12:00:00Z");

/** Turn plain values into series points spaced one minute apart, ending now. */
function seriesPoints(values: number[]): { t: number; v: number }[] {
  return values.map((v, i) => ({ t: NOW - (values.length - 1 - i) * 60_000, v }));
}

/** The prototype's initial state (lines 220–227) expressed as card input. */
function prototypeInput(overrides: Partial<ViewModelInput> = {}): ViewModelInput {
  return {
    temp: 158,
    target: 185,
    heating: true,
    pump: false,
    native: "F",
    display: "F",
    minT: 104,
    maxT: 446,
    targetDraft: null,
    series: seriesPoints([140, 142, 145, 148, 150, 152, 154, 155, 156, 157, 158]),
    now: NOW,
    chartWindowMin: 30,
    sessionWindowH: 24,
    sessionBuckets: new Array(48).fill(0),
    sessionCount: 0,
    effects: DEFAULT_EFFECTS,
    ...overrides,
  };
}

describe("emberStyles (prototype lines 384–401)", () => {
  it("matches the prototype's deterministic particle parameters", () => {
    const embers = emberStyles(DEFAULT_EFFECTS, true, false);
    expect(embers.length).toBe(9); // Steady
    // i=0: left 6%, size 2px, dur 2.4*(0.7+0/100)=1.68s, delay -0.00s
    expect(embers[0]?.left).toBe("6%");
    expect(embers[0]?.width).toBe("2px");
    expect(embers[0]?.animation).toBe("emberRise 1.68s ease-out infinite");
    // i=1: left 47%, size 3px, dur 2.4*0.84=2.02s, delay -0.83*2.016=-1.67s
    expect(embers[1]?.left).toBe("47%");
    expect(embers[1]?.width).toBe("3px");
    expect(embers[1]?.animation).toBe("emberRise 2.02s ease-out infinite");
    expect(embers[1]?.animationDelay).toBe("-1.67s");
  });

  it("calms to 1.6× duration while holding at target", () => {
    const holding = emberStyles(DEFAULT_EFFECTS, true, true);
    expect(holding[0]?.animation).toBe("emberRise 2.69s ease-out infinite"); // 1.68*1.6
  });

  it("respects intensity and effect settings", () => {
    expect(emberStyles({ ...DEFAULT_EFFECTS, emberIntensity: "Smolder" }, true, false).length).toBe(
      5,
    );
    expect(emberStyles({ ...DEFAULT_EFFECTS, emberIntensity: "Inferno" }, true, false).length).toBe(
      16,
    );
    expect(emberStyles({ ...DEFAULT_EFFECTS, heatEffect: "Glow only" }, true, false)).toEqual([]);
    expect(emberStyles({ ...DEFAULT_EFFECTS, heatEffect: "Off" }, true, false)).toEqual([]);
    expect(emberStyles(DEFAULT_EFFECTS, false, false)).toEqual([]);
  });
});

describe("windStreakStyles (prototype lines 413–430)", () => {
  it("matches the prototype's deterministic streak parameters", () => {
    const streaks = windStreakStyles(DEFAULT_EFFECTS, true);
    expect(streaks.length).toBe(7); // Steady
    // i=0: top 12%, w 26px, dur 2.2*0.7=1.54s
    expect(streaks[0]?.top).toBe("12%");
    expect(streaks[0]?.width).toBe("26px");
    expect(streaks[0]?.animation).toBe("windDrift 1.54s linear infinite");
    // Pump on → dark streaks over the lit button
    expect(streaks[0]?.background).toContain("rgba(26,18,7");
  });

  it("shows orange idle-breeze streaks when the pump is off", () => {
    const idle = windStreakStyles({ ...DEFAULT_EFFECTS, idleBreeze: true }, false);
    expect(idle.length).toBe(7);
    expect(idle[0]?.background).toContain("rgba(255,106,61");
  });

  it("respects intensity and effect settings", () => {
    expect(windStreakStyles({ ...DEFAULT_EFFECTS, windIntensity: "Breeze" }, true).length).toBe(4);
    expect(windStreakStyles({ ...DEFAULT_EFFECTS, windIntensity: "Gale" }, true).length).toBe(12);
    expect(windStreakStyles({ ...DEFAULT_EFFECTS, airEffect: "Glow only" }, true)).toEqual([]);
    expect(windStreakStyles(DEFAULT_EFFECTS, false)).toEqual([]); // no pump, no idle breeze
  });
});

describe("tickMarks (prototype lines 449–477)", () => {
  it("emits 25 ticks with 5 labeled majors", () => {
    const marks = tickMarks(104, 446, "F", "F");
    expect(marks.length).toBe(25);
    const majors = marks.filter((m) => m.label !== "");
    expect(majors.map((m) => m.label)).toEqual(["104°F", "190°F", "275°F", "361°F", "446°F"]);
    // Minor ticks render a shorter, dimmer dash and no label slot
    const minor = marks[1];
    expect(minor?.dashStyle.height).toBe("7px");
    expect(minor?.innerStyle.display).toBe("none");
  });

  it("produces the same °F labels from a native-Celsius Volcano range", () => {
    const marks = tickMarks(40, 230, "C", "F");
    const majors = marks.filter((m) => m.label !== "");
    expect(majors.map((m) => m.label)).toEqual(["104°F", "190°F", "275°F", "361°F", "446°F"]);
  });

  it("relabels in Celsius without moving the ticks", () => {
    const marks = tickMarks(40, 230, "C", "C");
    const majors = marks.filter((m) => m.label !== "");
    expect(majors.map((m) => m.label)).toEqual(["40°C", "88°C", "135°C", "183°C", "230°C"]);
    expect(majors[0]?.outerStyle.transform).toBe("translate(-50%,-50%) rotate(-150deg)");
  });

  it("pushes label centers out by the edge-clearance radius", () => {
    const marks = tickMarks(104, 446, "F", "F");
    const first = marks.filter((m) => m.label !== "")[0]; // "104°F" at -150°
    // rc = 134 + 5*3.1*|sin(-150°)| + 5*|cos(-150°)| = 146.08…
    expect(String(first?.innerStyle.top)).toStartWith("-146.08");
    expect(first?.innerStyle.transform).toBe("translate(-50%,-50%) rotate(150deg)");
  });
});

describe("knobRotation (prototype lines 445–448)", () => {
  it("maps the target across the 300° sweep", () => {
    expect(knobRotation(104, 104, 446)).toBe(-150);
    expect(knobRotation(446, 104, 446)).toBe(150);
    expect(knobRotation(275, 104, 446)).toBe(0);
    expect(knobRotation(185, 40, 230)).toBeCloseTo(78.947, 3);
  });

  it("parks at the minimum when the target is unknown or out of range", () => {
    expect(knobRotation(undefined, 104, 446)).toBe(-150);
    expect(knobRotation(500, 104, 446)).toBe(150);
  });
});

describe("buildViewModel", () => {
  it("reproduces the prototype's initial frame", () => {
    const v = buildViewModel(prototypeInput());
    expect(v.tempNum).toBe("158");
    expect(v.targetNum).toBe("185");
    expect(v.tempDisplay).toBe("158°F");
    expect(v.targetFieldValue).toBe("185°F");
    // progress 158/185 → litCount round(4.27)=4
    expect(v.ledStyles[3]?.background).toBe("#ff6a3d");
    expect(v.ledStyles[4]?.background).toBe("#2a2620");
    // heating, below target, Embers + glow → pulse animation
    expect(v.heatBtnStyle.animation).toBe("pulseGlow 2s ease-in-out infinite");
    expect(v.embers.length).toBe(9);
    // pump off → no streaks, tight letter-spacing
    expect(v.windStreaks).toEqual([]);
    expect(v.pumpLabelStyle.letterSpacing).toBe("0.08em");
    // °F selected
    expect(v.unitFStyle.background).toBe("#ff6a3d");
    expect(v.unitCStyle.background).toBe("#242019");
    // knob at 185°F of 104–446
    expect(String(v.knobStyle.transform)).toStartWith("rotate(-78.9");
    // axis captions
    expect(v.chartXTicks).toEqual(["−30 min", "−20", "−10", "now"]);
    expect(v.sessionXTicks).toEqual(["−24h", "−18h", "−12h", "−6h", "now"]);
    expect(v.sessionWindowLabel).toBe("24h");
    // heating LCD colors
    expect(v.targetGhostStyle.color).toBe("rgba(242,237,228,0.08)");
    expect(v.targetDigitsStyle.color).toBe("#f2ede4");
    expect(v.livePath).not.toBe("");
    expect(v.liveAreaPath).toEndWith("L560,110 L0,110 Z");
  });

  it("stops the pulse and calms embers while holding", () => {
    const v = buildViewModel(prototypeInput({ temp: 185 }));
    expect(v.heatBtnStyle.animation).toBe("none");
    expect(String(v.embers[0]?.animation)).toContain("2.69s");
  });

  it("dims the LCD and idles the HEAT button when the heater is off", () => {
    const v = buildViewModel(prototypeInput({ heating: false }));
    expect(v.heatBtnStyle.background).toBe("#242019");
    expect(v.heatBtnStyle.animation).toBeUndefined();
    expect(v.embers).toEqual([]);
    expect(v.targetGhostStyle.color).toBe("rgba(58,53,44,0.35)");
    expect(v.targetDigitsStyle.color).toBe("#3a352c");
  });

  it("animates the AIR button and spreads its label when the pump runs", () => {
    const v = buildViewModel(prototypeInput({ pump: true }));
    expect(v.pumpBtnBigStyle.animation).toBe("airBreathe 2.2s ease-in-out infinite");
    expect(v.pumpLabelStyle.letterSpacing).toBe("0.26em");
    expect(v.windStreaks.length).toBe(7);
  });

  it("degrades missing temperatures to dashes in the same slots", () => {
    const v = buildViewModel(prototypeInput({ temp: undefined, target: undefined }));
    expect(v.tempNum).toBe("---");
    expect(v.targetNum).toBe("---");
    expect(v.tempDisplay).toBe("—");
    expect(v.targetFieldValue).toBe("—");
    expect(v.ledStyles.every((led) => led.background === "#2a2620")).toBe(true);
    expect(v.knobStyle.transform).toBe("rotate(-150deg)");
  });

  it("renders an empty chart without layout inputs when history is missing", () => {
    const v = buildViewModel(prototypeInput({ series: [] }));
    expect(v.livePath).toBe("");
    expect(v.liveAreaPath).toBe("");
    expect(v.yTicks).toEqual([]);
    expect(v.liveDotStyle).toEqual({ display: "none" });
  });

  it("positions the live dot on the last sample", () => {
    const v = buildViewModel(prototypeInput({ series: seriesPoints([140, 150, 160]) }));
    // pad 4 → axis 130..170 (step 10); top = (1 - 30/40) * 110 = 27.5px
    expect(v.liveDotStyle.top).toBe("27.5px");
    expect(v.liveDotStyle.transition).toBe("top 1s linear");
    expect(v.yTicks.map((t) => t.label)).toEqual(["130°", "140°", "150°", "160°", "170°"]);
  });

  it("maps sample x-positions by timestamp, not index", () => {
    // Two samples: mid-window and now → x = 280 and 560 (30-min window).
    const v = buildViewModel(
      prototypeInput({
        series: [
          { t: NOW - 15 * 60_000, v: 150 },
          { t: NOW, v: 160 },
        ],
      }),
    );
    expect(v.livePath.startsWith("M280.0,")).toBe(true);
    expect(v.livePath.endsWith("L560.0,27.5")).toBe(true);
  });

  it("extends the trace flat to the right edge (extend-to-now)", () => {
    const v = buildViewModel(prototypeInput({ series: [{ t: NOW - 15 * 60_000, v: 150 }] }));
    // Single mid-window sample: flat segment from x=280 to the live dot at 560.
    expect(v.livePath.startsWith("M280.0,")).toBe(true);
    expect(v.livePath).toContain("560.0");
    expect(v.liveAreaPath.endsWith("L560,110 L0,110 Z")).toBe(true);
  });

  it("holds the previous axis while data still fits (hysteresis)", () => {
    const first = buildViewModel(prototypeInput({ series: seriesPoints([140, 150, 160]) }));
    expect(first.chartAxis).toEqual({ niceLo: 130, niceHi: 170, ticks: [130, 140, 150, 160, 170] });

    // Same data, hint provided → axis object is reused untouched.
    const second = buildViewModel(
      prototypeInput({ series: seriesPoints([140, 150, 160]), axisHint: first.chartAxis }),
    );
    expect(second.chartAxis).toBe(first.chartAxis);

    // Data escaping the bounds forces a refit.
    const third = buildViewModel(
      prototypeInput({ series: seriesPoints([140, 150, 175]), axisHint: first.chartAxis }),
    );
    expect(third.chartAxis).not.toBe(first.chartAxis);
    expect(third.chartAxis?.niceHi).toBeGreaterThanOrEqual(175);

    // A grossly oversized hint (stale zoomed-out axis) is also refit.
    const fourth = buildViewModel(
      prototypeInput({
        series: seriesPoints([150, 150, 150]),
        axisHint: { niceLo: 0, niceHi: 500, ticks: [0, 100, 200, 300, 400, 500] },
      }),
    );
    expect(fourth.chartAxis?.niceHi).toBeLessThan(500);
  });

  it("scales session bars against a nice axis like the prototype", () => {
    const buckets = new Array(48).fill(0);
    buckets[10] = 9;
    buckets[47] = 18;
    const v = buildViewModel(prototypeInput({ sessionBuckets: buckets, sessionCount: 2 }));
    // maxBucket 18 → axis 0..20; 18/20*100 = 90%, 9/20*100 = 45%
    expect(v.sessionBars[47]?.height).toBe("90%");
    expect(v.sessionBars[10]?.height).toBe("45%");
    expect(v.sessionBars[0]?.height).toBe("3%"); // empty-bucket stub
    // newest bucket lit accent, older buckets dimmer, zero buckets dark
    expect(v.sessionBars[47]?.background).toBe("#ff6a3d");
    expect(v.sessionBars[10]?.background).toBe("#c85a35");
    expect(v.sessionBars[0]?.background).toBe("#242019");
    expect(v.sessionYTicks.map((t) => t.label)).toEqual(["0", "5", "10", "15", "20"]);
    expect(v.sessionCount).toBe(2);
  });

  it("echoes a focused input draft verbatim", () => {
    const v = buildViewModel(prototypeInput({ targetDraft: "20" }));
    expect(v.targetFieldValue).toBe("20");
  });

  it("offers the prototype's window options", () => {
    const v = buildViewModel(prototypeInput());
    expect(v.chartWindowOptions.map((o) => o.value)).toEqual([5, 10, 30, 60, 120, 180, 240]);
    expect(v.sessionWindowOptions.map((o) => o.value)).toEqual([6, 12, 24, 36, 48, 72]);
  });
});
