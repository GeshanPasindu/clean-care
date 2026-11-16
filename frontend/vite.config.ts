import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@mui\/icons-material\/([A-Z][A-Za-z0-9]*)$/,
        replacement: fileURLToPath(
          new URL(
            "./node_modules/@mui/icons-material/esm/$1.js",
            import.meta.url,
          ),
        ),
      },
    ],
  },
  server: {
    port: 3000,
    strictPort: true,
  },
});
