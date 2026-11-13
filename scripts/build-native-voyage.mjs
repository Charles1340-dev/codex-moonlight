import { build } from "vite";
import react from "@vitejs/plugin-react";

await build({
  configFile: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "dist/client/native-voyage",
    lib: {
      entry: "src/native-voyage.jsx",
      name: "MoonlightVoyage",
      formats: ["iife"],
      fileName: () => "intro.js",
      cssFileName: "intro",
    },
  },
});
