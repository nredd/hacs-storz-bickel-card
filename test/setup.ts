/** Registers happy-dom globals (window, document, customElements, …) for bun test. */

import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
