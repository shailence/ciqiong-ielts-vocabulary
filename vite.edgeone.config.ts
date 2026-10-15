import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";

export default defineConfig({
  root: "github-src",
  base: "/",
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  publicDir: "../public",
  build: {
    outDir: "../dist-edgeone",
    emptyOutDir: true,
    assetsDir: "assets",
  },
});
