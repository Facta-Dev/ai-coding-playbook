// <app> — the renderer entry point.
//
// React mounts here and nowhere else; the composition root (App) owns the
// wiring, this file owns only the DOM hand-off and the two stylesheets.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "../ui-kit/theme.css";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("renderer: the #root element is missing from index.html.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
