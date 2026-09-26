import { createRoot } from "react-dom/client";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/readex-pro/500.css";
import "@fontsource/readex-pro/700.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/screens.css";
import "./styles/player.css";
import { App } from "./App";
import { SessionProvider } from "./state/session";
import { initRouter } from "./nav/router";
import { registerRemoteKeys } from "./platform";

initRouter();
registerRemoteKeys();

createRoot(document.getElementById("root")!).render(
  <SessionProvider>
    <App />
  </SessionProvider>,
);
