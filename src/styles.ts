/**
 * Card stylesheet: the design prototype's `<helmet>` CSS (lines 15–25)
 * transcribed verbatim, plus the scale-wrapper rules. Everything else the
 * prototype styles inline stays inline in the card template — keep it there
 * so the template diffs 1:1 against the prototype markup.
 */

import { css } from "lit";

export const cardStyles = css`
  :host {
    display: block;
  }

  /* The prototype's dark shell IS the visible card; keep ha-card invisible. */
  ha-card {
    padding: 0;
    background: none;
    border: none;
    box-shadow: none;
  }

  /* Prototype line 16 (body): font stack inherited by the whole template. */
  .scale-stage {
    font-family: "Inter", system-ui, sans-serif;
    transform-origin: top left;
  }

  .scale-viewport {
    overflow: hidden;
  }

  /* Prototype lines 17–24, verbatim. */
  @keyframes pulseGlow {
    0%,
    100% {
      box-shadow: 0 0 20px 0px rgba(255, 106, 61, 0.25);
    }
    50% {
      box-shadow: 0 0 42px 8px rgba(255, 106, 61, 0.55);
    }
  }
  @keyframes windDrift {
    0% {
      transform: translateX(0);
      opacity: 0;
    }
    12% {
      opacity: 1;
    }
    80% {
      opacity: 1;
    }
    100% {
      transform: translateX(340px);
      opacity: 0;
    }
  }
  @keyframes airBreathe {
    0%,
    100% {
      box-shadow: 0 6px 20px rgba(255, 106, 61, 0.45);
    }
    50% {
      box-shadow:
        0 6px 34px rgba(255, 106, 61, 0.8),
        0 0 18px rgba(255, 106, 61, 0.35);
    }
  }
  @keyframes emberRise {
    0% {
      transform: translateY(0) scale(1);
      opacity: 0;
    }
    18% {
      opacity: 1;
    }
    100% {
      transform: translateY(-56px) scale(0.4);
      opacity: 0;
    }
  }
  .hover-lift {
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease;
  }
  .hover-lift:hover {
    transform: translateY(-1px);
  }
  .tick {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
  }
  .tick-inner {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
`;
