import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/displan/",
  plugins: [react()],
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
