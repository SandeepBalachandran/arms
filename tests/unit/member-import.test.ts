import { describe, expect, it } from "vitest";
import { checkRows, parseDate, parseTable, toRawRows } from "../../apps/web/src/lib/member-import";

const PLANS = [{ id: "p1", name: "Monthly", duration_days: 30 }];

describe("reading the file", () => {
  it("reads CSV with quotes, commas and Windows line endings", () => {
    const csv = 'Name,Phone\r\n"Nair, Arjun",9988776655\r\n"Ravi ""RK"" Kumar",9876543210\r\n';
    expect(parseTable(csv)).toEqual([["Name", "Phone"], ["Nair, Arjun", "9988776655"], ['Ravi "RK" Kumar', "9876543210"]]);
  });

  it("reads tab-separated text pasted from Excel or Sheets", () => {
    expect(parseTable("Name\tMobile\nPriya\t9123456780")).toEqual([["Name", "Mobile"], ["Priya", "9123456780"]]);
  });

  it("understands common header names", () => {
    const { rows } = toRawRows([["Member Name", "WhatsApp", "Valid till"], ["Priya", "9123456780", "31/10/2026"]]);
    expect(rows[0]).toMatchObject({ Name: "Priya", Phone: "9123456780", "Paid until": "31/10/2026" });
  });

  it("explains what's missing", () => {
    expect(toRawRows([["Phone"], ["9"]]).error).toMatch(/Name column/);
    expect(toRawRows([["Name"], ["Priya"]]).error).toMatch(/Phone or Email/);
    expect(toRawRows([["Name", "Phone"]]).error).toMatch(/at least one member/);
  });
});

describe("dates as gyms write them (day first)", () => {
  it.each([
    ["2026-10-05", "2026-10-05"],
    ["05/10/2026", "2026-10-05"],
    ["5-10-26", "2026-10-05"],
    ["5 Oct 2026", "2026-10-05"],
    ["05-Oct-2026", "2026-10-05"],
    ["31/10/2026", "2026-10-31"],
  ])("%s → %s", (text, iso) => {
    expect(parseDate(text)).toBe(iso);
  });

  it.each(["31/02/2026", "13/13/2026", "yesterday", ""])("rejects %j", (text) => {
    expect(parseDate(text)).toBeNull();
  });
});

describe("checking rows", () => {
  const row = (r: Partial<Record<string, string>>) => ({ Name: "", Phone: "", Email: "", Plan: "", "Last paid on": "", "Paid until": "", Amount: "", ...r });

  it("a calendar month: paid on the 1st, valid till the 31st", () => {
    const [r] = checkRows([row({ Name: "Ravi", Phone: "9876543210", Plan: "Monthly", "Last paid on": "01/10/2026", "Paid until": "31/10/2026", Amount: "₹1,500" })], PLANS, "91");
    expect(r).toMatchObject({ problems: [], starts_on: "2026-10-01", ends_on: "2026-10-31", amount_paise: 150000, plan_id: "p1" });
  });

  it("without 'paid until', the plan length decides the end date", () => {
    const [r] = checkRows([row({ Name: "Priya", Phone: "9123456780", Plan: "monthly", "Last paid on": "05/10/2026" })], PLANS, "91");
    expect(r.ends_on).toBe("2026-11-03");
  });

  it("flags duplicates, unknown plans and bad dates", () => {
    const rows = checkRows([
      row({ Name: "A One", Phone: "9876543210" }),
      row({ Name: "A Two", Phone: "+91 98765 43210" }),
      row({ Name: "B", Email: "b@x.com", Plan: "Gold", "Last paid on": "01/10/2026" }),
      row({ Name: "Cee", Phone: "9000000001", Plan: "Monthly", "Last paid on": "10/10/2026", "Paid until": "01/10/2026" }),
    ], PLANS, "91");
    expect(rows[1].problems.join()).toMatch(/Same phone as row 2/);
    expect(rows[2].problems.join()).toMatch(/No plan called "Gold"/);
    expect(rows[3].problems.join()).toMatch(/before the last paid date/);
  });

  it("needs a phone or email", () => {
    expect(checkRows([row({ Name: "Nobody" })], PLANS, "91")[0].problems).toContain("Add a phone number or email");
  });
});
