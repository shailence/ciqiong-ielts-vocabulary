import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";

export default defineConfig({
  root: "github-src",
  base: "/ciqiong-ielts-vocabulary/",
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  publicDir: "../public",
  build: { outDir: "../github-pages", emptyOutDir: true, assetsDir: "." },
});
