import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Los de integración necesitan PostgreSQL: van en `npm run test:integration`.
    exclude: [...configDefaults.exclude, "src/**/*.int.test.ts"],
  },
});
