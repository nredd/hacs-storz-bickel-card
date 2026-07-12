import { beforeEach, describe, expect, test } from "bun:test";
import "../src/seven-segment";
import type { SbSevenSegment } from "../src/seven-segment";

async function renderReadout(props: Partial<SbSevenSegment>): Promise<SbSevenSegment> {
  const el = document.createElement("sb-seven-segment") as SbSevenSegment;
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("sb-seven-segment", () => {
  test("renders rounded current and target digits", async () => {
    const el = await renderReadout({ current: 184.6, target: 195.2, unit: "F" });
    expect(el.shadowRoot?.querySelector(".lit.current")?.textContent).toContain("185");
    expect(el.shadowRoot?.querySelector(".lit.target")?.textContent).toContain("195");
  });

  test("hides the target line when showTarget is false", async () => {
    const el = await renderReadout({ current: 184, target: 195, showTarget: false });
    expect(el.shadowRoot?.querySelector(".lit.target")).toBeNull();
  });

  test("clicking the inactive unit button emits unit-change", async () => {
    const el = await renderReadout({ unit: "F" });
    let detail: { unit: string } | undefined;
    el.addEventListener("unit-change", (event) => {
      detail = (event as CustomEvent<{ unit: string }>).detail;
    });
    const buttons = el.shadowRoot?.querySelectorAll(".unit-toggle button");
    (buttons?.[1] as HTMLButtonElement).click();
    expect(detail).toEqual({ unit: "C" });
  });

  test("clicking the already-active unit button does not emit", async () => {
    const el = await renderReadout({ unit: "F" });
    let emitted = false;
    el.addEventListener("unit-change", () => {
      emitted = true;
    });
    const buttons = el.shadowRoot?.querySelectorAll(".unit-toggle button");
    (buttons?.[0] as HTMLButtonElement).click();
    expect(emitted).toBe(false);
  });
});
