import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { highestRole, PERMISSIONS, rolesLabel } from "@gymos/shared";

describe("roles", () => {
  it("picks the highest role, like the database", () => {
    expect(highestRole(["trainer", "staff"])).toBe("staff");
    expect(highestRole(["member", "trainer"])).toBe("trainer");
    expect(highestRole(["owner", "trainer"])).toBe("owner");
    expect(highestRole([])).toBe("member");
  });

  it("labels main role first, then extras in rank order", () => {
    expect(rolesLabel("owner", ["trainer"])).toBe("Owner + Trainer");
    expect(rolesLabel("trainer", ["admin", "staff", "trainer"])).toBe("Trainer + Admin + Staff");
    expect(rolesLabel("member")).toBe("Member");
  });
});

describe("permission list", () => {
  it("matches the database's list exactly", () => {
    const sql = readFileSync("supabase/migrations/20261030000000_roles_permissions.sql", "utf8");
    const grid = sql.match(/create table public\.gym_role_permissions[\s\S]*?permission in \(([\s\S]*?)\)\),/)![1];
    const dbKeys = [...grid.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
    expect(PERMISSIONS.map((p) => p.key).sort()).toEqual(dbKeys);
  });

  it("has no duplicates", () => {
    expect(new Set(PERMISSIONS.map((p) => p.key)).size).toBe(PERMISSIONS.length);
  });
});
