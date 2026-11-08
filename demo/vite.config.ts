import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { content } from "./content-plugin.ts";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The site consumes the library from source, so the playground always runs the code in this repo.
// retrypilot has no runtime dependencies, so the aliases are all the site needs.
export default defineConfig({
  root: r("."),
  base: "./",
  plugins: [react(), content()],
  resolve: {
    alias: [
      { find: /^retrypilot$/, replacement: r("../src/index.ts") },
      { find: /^retrypilot\/http$/, replacement: r("../src/http.ts") },
      { find: /^retrypilot\/node$/, replacement: r("../src/node.ts") },
      { find: /^retrypilot\/testing$/, replacement: r("../src/testing.ts") },
    ],
  },
  server: { fs: { allow: [r("..")] } },
  build: { outDir: r("dist"), emptyOutDir: true },
});
