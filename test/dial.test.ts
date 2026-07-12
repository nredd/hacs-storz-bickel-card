import { beforeEach, describe, expect, test } from "bun:test";
import "../src/dial";
import type { SbTempDial } from "../src/dial";

async function renderDial(props: Partial<SbTempDial>): Promise<SbTempDial> {
  const dial = document.createElement("sb-temp-dial") as SbTempDial;
  Object.assign(dial, props);
  document.body.appendChild(dial);
  await dial.updateComplete;
  return dial;
}

/** 280x280 square centered at (140, 140), matching the dial's rendered size. */
function mockContainerRect(dial: SbTempDial): HTMLElement {
  const container = dial.shadowRoot?.querySelector(".dial") as HTMLElement;
  container.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 280, height: 280, right: 280, bottom: 280 }) as DOMRect;
  return container;
}

/** A pointer event landing `angleDeg` degrees around the dial's center (0deg = due right). */
function pointerAt(
  type: string,
  angleDeg: number,
  opts: { pointerId?: number; radius?: number } = {},
): PointerEvent {
  const rad = (angleDeg * Math.PI) / 180;
  const radius = opts.radius ?? 100;
  return new PointerEvent(type, {
    clientX: 140 + radius * Math.cos(rad),
    clientY: 140 + radius * Math.sin(rad),
    pointerId: opts.pointerId ?? 1,
    bubbles: true,
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
  // happy-dom elements don't implement pointer capture; stub it so the
  // handlers (which call it unconditionally) don't throw.
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
});

describe("sb-temp-dial", () => {
  test("renders 25 ticks with 5 labeled majors", async () => {
    const dial = await renderDial({ min: 40, max: 230, unit: "°C" });
    const ticks = dial.shadowRoot?.querySelectorAll(".tick");
    expect(ticks?.length).toBe(25);
    const majors = dial.shadowRoot?.querySelectorAll(".dash.major");
    expect(majors?.length).toBe(5);
  });

  test("major tick labels span min to max", async () => {
    const dial = await renderDial({ min: 40, max: 230, unit: "°C" });
    const labels = Array.from(dial.shadowRoot?.querySelectorAll(".tick-label span") ?? []).map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(["40°C", "88°C", "135°C", "183°C", "230°C"]);
  });

  test("knob rotation reflects the target fraction", async () => {
    const dial = await renderDial({ min: 40, max: 230, target: 40, active: true });
    const face = dial.shadowRoot?.querySelector(".knob-face") as HTMLElement;
    expect(face.style.transform).toBe("rotate(-150deg)");

    dial.target = 230;
    await dial.updateComplete;
    expect(face.style.transform).toBe("rotate(150deg)");
  });

  test("shows an em-dash for the current readout when disabled", async () => {
    const dial = await renderDial({ current: 185, disabled: true });
    const current = dial.shadowRoot?.querySelector(".current");
    expect(current?.textContent).toBe("—");
  });

  test("off mode is used when inactive, even with current/target set", async () => {
    const dial = await renderDial({ current: 100, target: 180, active: false });
    expect(dial.shadowRoot?.querySelector(".dial.off")).not.toBeNull();
  });
});

describe("sb-temp-dial pointer drag", () => {
  test("pointerdown at the dial's midpoint angle (0deg) emits dial-drag with the mid value", async () => {
    const dial = await renderDial({ min: 40, max: 230, target: 40, active: true });
    const container = mockContainerRect(dial);
    const values: number[] = [];
    dial.addEventListener("dial-drag", (event) => {
      values.push((event as CustomEvent<{ value: number }>).detail.value);
    });

    container.dispatchEvent(pointerAt("pointerdown", 0));
    // min=40, max=230, mid-angle (0deg) -> fraction 0.5 -> 40 + 0.5*190 = 135.
    expect(values).toEqual([135]);
  });

  test("pointermove while dragging emits further dial-drag events", async () => {
    const dial = await renderDial({ min: 40, max: 230, target: 40, active: true });
    const container = mockContainerRect(dial);
    const values: number[] = [];
    dial.addEventListener("dial-drag", (event) => {
      values.push((event as CustomEvent<{ value: number }>).detail.value);
    });

    container.dispatchEvent(pointerAt("pointerdown", 0));
    // One tick step (12.5deg) further around the ring -> 40 + (162.5/300)*190 ~= 142.92 -> 143.
    container.dispatchEvent(pointerAt("pointermove", 12.5));
    expect(values).toEqual([135, 143]);
  });

  test("pointermove before any pointerdown does not emit (dragging guard)", async () => {
    const dial = await renderDial({ min: 40, max: 230, target: 40, active: true });
    const container = mockContainerRect(dial);
    const values: number[] = [];
    dial.addEventListener("dial-drag", (event) => {
      values.push((event as CustomEvent<{ value: number }>).detail.value);
    });

    container.dispatchEvent(pointerAt("pointermove", 0));
    expect(values).toEqual([]);
  });

  test("pointerup stops dragging so a later pointermove does not emit", async () => {
    const dial = await renderDial({ min: 40, max: 230, target: 40, active: true });
    const container = mockContainerRect(dial);
    const values: number[] = [];
    dial.addEventListener("dial-drag", (event) => {
      values.push((event as CustomEvent<{ value: number }>).detail.value);
    });

    container.dispatchEvent(pointerAt("pointerdown", 0));
    container.dispatchEvent(pointerAt("pointerup", 0));
    values.length = 0;
    container.dispatchEvent(pointerAt("pointermove", 12.5));
    expect(values).toEqual([]);
  });

  test("disabled dial ignores pointerdown entirely", async () => {
    const dial = await renderDial({ min: 40, max: 230, target: 40, active: true, disabled: true });
    const container = mockContainerRect(dial);
    const values: number[] = [];
    dial.addEventListener("dial-drag", (event) => {
      values.push((event as CustomEvent<{ value: number }>).detail.value);
    });

    container.dispatchEvent(pointerAt("pointerdown", 0));
    expect(values).toEqual([]);
    expect(dial.shadowRoot?.querySelector(".dial.dragging")).toBeNull();
  });

  test("dragging past the ring's physical span clamps to max", async () => {
    const dial = await renderDial({ min: 40, max: 230, target: 40, active: true });
    const container = mockContainerRect(dial);
    const values: number[] = [];
    dial.addEventListener("dial-drag", (event) => {
      values.push((event as CustomEvent<{ value: number }>).detail.value);
    });

    // 170deg is past the ring's +150deg endpoint but still within atan2's
    // native (-180, 180] range, so it doesn't hit the wraparound branch.
    container.dispatchEvent(pointerAt("pointerdown", 170));
    expect(values).toEqual([230]);
  });

  test("dragging into the wraparound region (raw angle < startAngle) also clamps to max", async () => {
    const dial = await renderDial({ min: 40, max: 230, target: 40, active: true });
    const container = mockContainerRect(dial);
    const values: number[] = [];
    dial.addEventListener("dial-drag", (event) => {
      values.push((event as CustomEvent<{ value: number }>).detail.value);
    });

    // -170deg: atan2 reports -170, which is < START_ANGLE (-150), so
    // angleFromPointer takes the "+= 360" branch before clamping.
    container.dispatchEvent(pointerAt("pointerdown", -170));
    expect(values).toEqual([230]);
  });
});
