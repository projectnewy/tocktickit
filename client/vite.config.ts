import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.test.{ts,tsx}"],
    // Lets a test read theme.css as text (?raw) to assert the focus-ring
    // rules; by default Vitest swaps CSS imports for an empty string.
    css: { include: [/theme\.css/] },
  },
});
