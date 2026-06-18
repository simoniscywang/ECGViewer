import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@ecgviewer/config": path.resolve(
        __dirname,
        "../../packages/config/src/index.ts",
      ),
      "@ecgviewer/ecg": path.resolve(
        __dirname,
        "../../packages/ecg/src/index.ts",
      ),
      "@ecgviewer/fhir": path.resolve(
        __dirname,
        "../../packages/fhir/src/index.ts",
      ),
    },
  },
  test: {
    environment: "node",
  },
});
