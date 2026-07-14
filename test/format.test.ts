import { describe, expect, it } from "bun:test";
import {
  asNumber,
  computeScale,
  convertAbsolute,
  convertDelta,
  formatRuntime,
  formatTime,
  niceAxis,
  smoothPath,
  toDisplayTemp,
  todayIso,
  unitCode,
  viewportHeight,
} from "../src/format";

describe("asNumber", () => {
  it("parses numbers and numeric strings", () => {
    expect(asNumber(5)).toBe(5);
    expect(asNumber("5.5")).toBe(5.5);
  });

  it("rejects non-finite and non-numeric values", () => {
    expect(asNumber("unavailable")).toBeUndefined();
    expect(asNumber(Number.NaN)).toBeUndefined();
    expect(asNumber(undefined)).toBeUndefined();
    expect(asNumber(null)).toBeUndefined();
  });
});

describe("convertAbsolute / convertDelta", () => {
  it("converts absolute temperatures", () => {
    expect(convertAbsolute(0, "C", "F")).toBe(32);
    expect(convertAbsolute(212, "F", "C")).toBe(100);
    expect(convertAbsolute(185, "C", "C")).toBe(185);
  });

  it("converts temperature deltas", () => {
    expect(convertDelta(5, "C", "F")).toBe(9);
    expect(convertDelta(9, "F", "C")).toBe(5);
    expect(convertDelta(10, "F", "F")).toBe(10);
  });
});

describe("unitCode", () => {
  it("maps HA unit labels to codes", () => {
    expect(unitCode("°F")).toBe("F");
    expect(unitCode("°C")).toBe("C");
  });
});

describe("todayIso", () => {
  it("returns YYYY-MM-DD", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatTime (prototype lines 332–335)", () => {
  it("formats seconds as zero-padded MM:SS", () => {
    expect(formatTime(754)).toBe("12:34");
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(59.9)).toBe("00:59");
    expect(formatTime(3600)).toBe("60:00");
  });
});

describe("toDisplayTemp (prototype lines 336–338)", () => {
  it("matches the prototype for °F internal state", () => {
    // Prototype: toDisplayTemp(158, 'C') === Math.round((158 - 32) * 5 / 9)
    expect(toDisplayTemp(158, "F", "C")).toBe(70);
    expect(toDisplayTemp(158, "F", "F")).toBe(158);
    expect(toDisplayTemp(446, "F", "C")).toBe(230);
  });

  it("supports native-Celsius internal state", () => {
    expect(toDisplayTemp(185, "C", "F")).toBe(365);
    expect(toDisplayTemp(185.4, "C", "C")).toBe(185);
  });
});

describe("formatRuntime", () => {
  it("formats hours like the prototype's device-info row", () => {
    expect(formatRuntime(2217.2)).toBe("2,217.2");
    expect(formatRuntime(5)).toBe("5.0");
    expect(formatRuntime(0)).toBe("0.0");
  });
});

describe("niceAxis (prototype lines 340–352)", () => {
  it("rounds bounds to a 1/2/5/10 step and emits ticks", () => {
    expect(niceAxis(0, 18)).toEqual({ niceLo: 0, niceHi: 20, ticks: [0, 5, 10, 15, 20] });
    expect(niceAxis(140, 160)).toEqual({
      niceLo: 140,
      niceHi: 160,
      ticks: [140, 145, 150, 155, 160],
    });
  });

  it("handles a degenerate range like the prototype (hi = lo + 1)", () => {
    const axis = niceAxis(10, 10);
    expect(axis.niceHi).toBeGreaterThan(axis.niceLo);
    expect(axis.ticks.length).toBeGreaterThan(1);
  });
});

describe("smoothPath (prototype lines 354–370)", () => {
  it("returns empty for fewer than two points", () => {
    expect(smoothPath([], 560, 110, 0, 10)).toBe("");
    expect(smoothPath([5], 560, 110, 0, 10)).toBe("");
  });

  it("emits the prototype's midpoint-quadratic path", () => {
    expect(smoothPath([0, 10], 560, 110, 0, 10)).toBe(
      "M0.0,110.0 Q0.0,110.0 280.0,55.0 L560.0,0.0",
    );
    expect(smoothPath([0, 5, 10], 100, 100, 0, 10)).toBe(
      "M0.0,100.0 Q0.0,100.0 25.0,75.0 Q50.0,50.0 75.0,25.0 L100.0,0.0",
    );
  });
});

describe("computeScale / viewportHeight", () => {
  it("scales proportionally to the container width", () => {
    expect(computeScale(1328, 1328)).toBe(1);
    expect(computeScale(664, 1328)).toBe(0.5);
    expect(computeScale(1992, 1328)).toBe(1.5);
  });

  it("falls back to 1 before layout provides a width", () => {
    expect(computeScale(0, 1328)).toBe(1);
    expect(computeScale(-1, 1328)).toBe(1);
  });

  it("compensates transform-does-not-affect-layout", () => {
    expect(viewportHeight(1000, 0.5)).toBe(500);
    expect(viewportHeight(900, 1)).toBe(900);
  });
});
