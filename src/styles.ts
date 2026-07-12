/** Styles for the main card element (subcomponents style their own shadow roots). */

import { css } from "lit";

export const cardStyles = css`
  :host {
    --sb-heat: var(--sb-color-heating, #ff9800);
    --sb-ready: var(--sb-color-ready, #4caf50);
  }

  ha-card {
    padding: 16px;
  }

  .body {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    gap: 16px;
    transition: opacity 0.3s ease;
  }

  .body.disconnected .grid {
    opacity: 0.45;
    pointer-events: none;
  }

  /* ---- header ---------------------------------------------------------- */

  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .titles {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .kicker {
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--secondary-text-color);
  }

  .name {
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--primary-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: none;
  }

  .connection-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 100px;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: var(--secondary-background-color, rgba(127, 127, 127, 0.12));
    color: var(--secondary-text-color);
  }

  .connection-chip::before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }

  .connection-chip.on {
    color: var(--sb-ready);
    background: color-mix(in srgb, var(--sb-ready) 16%, transparent);
  }

  .connection-chip.off {
    color: var(--error-color, #f44336);
    background: color-mix(in srgb, var(--error-color, #f44336) 16%, transparent);
    animation: sb-blink 1.6s ease-in-out infinite;
  }

  @keyframes sb-blink {
    50% {
      opacity: 0.5;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .connection-chip.off {
      animation: none;
    }
  }

  .battery {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    border-radius: 12px;
    background: var(--secondary-background-color, rgba(127, 127, 127, 0.12));
    color: var(--secondary-text-color);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }

  /* ---- layout ------------------------------------------------------------ */

  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }

  @container (max-width: 640px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }

  .left-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    background: var(--secondary-background-color, rgba(127, 127, 127, 0.06));
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.15));
    border-radius: 10px;
    padding: 24px;
  }

  .right-col {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .panel {
    background: var(--secondary-background-color, rgba(127, 127, 127, 0.06));
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.15));
    border-radius: 10px;
    padding: 18px 20px;
  }

  .panel-title {
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--secondary-text-color);
    margin-bottom: 10px;
  }

  /* ---- readout + status label -------------------------------------------- */

  .status-label {
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--secondary-text-color);
  }

  /* ---- stepper ------------------------------------------------------------ */

  .stepper {
    display: flex;
    align-items: center;
    gap: 16px;
    background: var(--card-background-color, rgba(0, 0, 0, 0.2));
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.15));
    border-radius: 100px;
    padding: 6px;
  }

  .step {
    width: 44px;
    height: 44px;
    flex: none;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.15));
    border-radius: 50%;
    background: var(--secondary-background-color, rgba(127, 127, 127, 0.12));
    color: var(--primary-text-color);
    font-size: 1.2rem;
    line-height: 1;
    cursor: pointer;
    transition: transform 0.1s ease;
  }

  .step:active {
    transform: scale(0.92);
  }

  .step:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .stepper-value {
    min-width: 96px;
    text-align: center;
  }

  .stepper-value span {
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary-text-color);
    font-variant-numeric: tabular-nums;
  }

  .step-caption {
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    color: var(--secondary-text-color);
  }

  /* ---- preset chips ---------------------------------------------------- */

  .presets {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .preset {
    padding: 7px 16px;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
    border-radius: 18px;
    background: transparent;
    color: var(--primary-text-color);
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition:
      background 0.2s ease,
      color 0.2s ease,
      border-color 0.2s ease,
      transform 0.1s ease;
  }

  .preset:active {
    transform: scale(0.95);
  }

  .preset.active {
    border-color: transparent;
    background: var(--sb-heat);
    color: #fff;
  }

  /* ---- HEAT / AIR toggle row --------------------------------------------- */

  .toggle-row {
    display: flex;
    gap: 12px;
    width: 100%;
  }

  .heat-btn,
  .air-btn {
    flex: 1;
    padding: 12px 16px;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
    border-radius: 100px;
    background: transparent;
    color: var(--primary-text-color);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    cursor: pointer;
    transition:
      background 0.25s ease,
      color 0.25s ease,
      box-shadow 0.25s ease,
      transform 0.1s ease;
  }

  .heat-btn:active,
  .air-btn:active {
    transform: scale(0.97);
  }

  .heat-btn.on {
    border-color: transparent;
    background: var(--sb-heat);
    color: #1a1207;
    box-shadow: 0 0 14px color-mix(in srgb, var(--sb-heat) 60%, transparent);
  }

  .air-btn.on {
    border-color: transparent;
    background: var(--primary-color, #03a9f4);
    color: #fff;
  }

  /* ---- session panel ----------------------------------------------------- */

  .session-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .session-timer {
    font-size: 1.8rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--primary-text-color);
  }

  .sessions-today {
    text-align: center;
  }

  .sessions-today-count {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--primary-text-color);
  }

  .sessions-today-label {
    font-size: 0.7rem;
    color: var(--secondary-text-color);
  }

  /* ---- device info + settings --------------------------------------------- */

  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    font-size: 0.9rem;
    color: var(--primary-text-color);
    border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.1));
  }

  .info-row:first-of-type {
    border-top: none;
  }

  .info-row select {
    background: var(--card-background-color, rgba(0, 0, 0, 0.2));
    color: var(--primary-text-color);
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }

  details.settings {
    border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.15));
    padding-top: 4px;
  }

  summary {
    padding: 8px 0;
    font-size: 0.9rem;
    color: var(--secondary-text-color);
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  summary::before {
    content: "▸";
    transition: transform 0.2s ease;
  }

  details[open] summary::before {
    transform: rotate(90deg);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    font-size: 0.9rem;
    color: var(--primary-text-color);
  }

  .row label {
    flex: 1;
  }

  .row .value {
    min-width: 3.5em;
    text-align: right;
    color: var(--secondary-text-color);
    font-variant-numeric: tabular-nums;
  }

  input[type="range"] {
    flex: 2;
    accent-color: var(--sb-heat);
  }

  input[type="checkbox"] {
    width: 20px;
    height: 20px;
    accent-color: var(--sb-heat);
  }
`;
