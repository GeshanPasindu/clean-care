import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      env: { VITE_API_URL: "http://localhost:4000/api/" },
      restoreMocks: true,
    },
  }),
);
