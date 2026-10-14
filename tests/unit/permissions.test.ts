import { readdirSync, readFileSync } from "node:fs";
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
    // The newest migration that sets the allowed list (the table's check constraint).
    const dir = "supabase/migrations";
    const lists = readdirSync(dir)
      .sort()
      .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
      .map((sql) =>
        sql.match(/gym_role_permissions_permission_check check \(permission in \(([\s\S]*?)\)\)/)?.[1] ??
        sql.match(/create table public\.gym_role_permissions[\s\S]*?permission in \(([\s\S]*?)\)\),/)?.[1],
      )
      .filter(Boolean);
    const dbKeys = [...lists.at(-1)!.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
    expect(PERMISSIONS.map((p) => p.key).sort()).toEqual(dbKeys);
  });

  it("has no duplicates", () => {
    expect(new Set(PERMISSIONS.map((p) => p.key)).size).toBe(PERMISSIONS.length);
  });
});
