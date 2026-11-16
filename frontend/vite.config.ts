// <app> - Vite build config for the web SPA. The app entry is index.html at
// the repository root; src/main.tsx is the composition root.
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
});
