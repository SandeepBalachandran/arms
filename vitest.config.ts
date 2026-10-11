import { defineConfig } from "vitest/config";

// npm test          → everything
// npm run test:unit → shared logic only (no network)
// npm run test:db   → database rules, against the Supabase project in
//                     apps/web/.env.local, using a throwaway gym (tests/db/setup.ts)
export default defineConfig({
  test: {
    // DB test files share one gym and its accounts, so files run one at a
    // time (this only works at the top level, not per project).
    fileParallelism: false,
    projects: [
      {
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          globalSetup: ["tests/db/setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
