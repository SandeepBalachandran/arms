import { internationalPhone } from "@gymos/shared";

// Bulk member import: parsing and row checks shared by the preview (browser)
// and the import action (server re-checks every row).

export const IMPORT_COLUMNS = ["Name", "Phone", "Email", "Plan", "Last paid on", "Paid until", "Amount"] as const;
export const IMPORT_BATCH = 25;
export const IMPORT_MAX_ROWS = 2000;

export type RawRow = Record<(typeof IMPORT_COLUMNS)[number], string>;

export type ImportPlan = { id: string; name: string; duration_days: number };

export type CheckedRow = {
  line: number; // row number in the file, for messages
  full_name: string;
  phone: string; // as typed (stored on the profile)
  intl_phone: string | null; // digits with country code (the login)
  email: string;
  plan_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
  amount_paise: number | null;
  problems: string[];
};

// RFC 4180-ish CSV, plus tab-separated text pasted from Excel or Sheets.
export function parseTable(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.slice(0, clean.indexOf("\n") >>> 0);
  const sep = firstLine.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

// Maps header names (any case, a few common synonyms) to our columns.
const HEADER_ALIASES: Record<string, (typeof IMPORT_COLUMNS)[number]> = {
  name: "Name", "full name": "Name", "member name": "Name", member: "Name",
  phone: "Phone", mobile: "Phone", "phone number": "Phone", "mobile number": "Phone", whatsapp: "Phone",
  email: "Email", "email address": "Email", "e-mail": "Email",
  plan: "Plan", package: "Plan", membership: "Plan",
  "last paid on": "Last paid on", "last paid": "Last paid on", "paid on": "Last paid on", "start date": "Last paid on", "starts on": "Last paid on", from: "Last paid on",
  "paid until": "Paid until", "end date": "Paid until", "ends on": "Paid until", "valid till": "Paid until", "valid until": "Paid until", "expiry": "Paid until", to: "Paid until",
  amount: "Amount", "amount paid": "Amount", fee: "Amount", fees: "Amount", paid: "Amount",
};

export function toRawRows(table: string[][]): { rows: RawRow[]; error?: string } {
  if (table.length < 2) return { rows: [], error: "The file needs a header row and at least one member." };
  const header = table[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()]);
  if (!header.includes("Name")) return { rows: [], error: "Couldn't find a Name column. Start from the template." };
  if (!header.includes("Phone") && !header.includes("Email")) {
    return { rows: [], error: "Add a Phone or Email column so members can be told apart." };
  }
  if (table.length - 1 > IMPORT_MAX_ROWS) return { rows: [], error: `Import at most ${IMPORT_MAX_ROWS} members at a time.` };
  const rows = table.slice(1).map((cells) => {
    const row = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c, ""])) as RawRow;
    header.forEach((col, i) => { if (col) row[col] = (cells[i] ?? "").trim(); });
    return row;
  });
  return { rows };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// Dates as gyms write them: 2026-10-05, 05/10/2026, 5-10-26, 5 Oct 2026, 05-Oct-2026.
// Numeric dates are day first (India).
export function parseDate(text: string): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  let y: number, m: number, d: number;
  let match = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) [y, m, d] = [+match[1], +match[2], +match[3]];
  else if ((match = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) [d, m, y] = [+match[1], +match[2], +match[3]];
  else if ((match = t.match(/^(\d{1,2})[\s-]([a-z]{3})[a-z]*[\s-,]+(\d{2}|\d{4})$/)) && MONTHS.includes(match[2])) {
    [d, m, y] = [+match[1], MONTHS.indexOf(match[2]) + 1, +match[3]];
  } else return null;
  if (y < 100) y += 2000;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function checkRows(rows: RawRow[], plans: ImportPlan[], countryCode: string): CheckedRow[] {
  const byName = new Map(plans.map((p) => [p.name.trim().toLowerCase(), p]));
  const seen = new Map<string, number>();

  return rows.map((r, i) => {
    const line = i + 2; // header is line 1
    const problems: string[] = [];
    const full_name = r.Name.replace(/\s+/g, " ").trim();
    if (full_name.length < 2) problems.push("Name is missing");
    if (full_name.length > 80) problems.push("Name is too long");

    const intl_phone = r.Phone ? internationalPhone(r.Phone, countryCode) : null;
    if (r.Phone && !intl_phone) problems.push("Check the phone number");
    const email = r.Email.toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push("Check the email");
    if (!r.Phone && !email) problems.push("Add a phone number or email");

    for (const key of [intl_phone && `p:${intl_phone}`, email && `e:${email}`]) {
      if (!key) continue;
      if (seen.has(key)) problems.push(`Same ${key[0] === "p" ? "phone" : "email"} as row ${seen.get(key)}`);
      else seen.set(key, line);
    }

    let plan_id: string | null = null;
    let starts_on: string | null = null;
    let ends_on: string | null = null;
    const hasMembership = r.Plan || r["Last paid on"] || r["Paid until"];
    if (hasMembership) {
      const plan = byName.get(r.Plan.trim().toLowerCase());
      if (!r.Plan) problems.push("Add the plan");
      else if (!plan) problems.push(`No plan called "${r.Plan}"`);
      starts_on = parseDate(r["Last paid on"]);
      if (!r["Last paid on"]) problems.push("Add the last paid date");
      else if (!starts_on) problems.push(`Can't read the date "${r["Last paid on"]}"`);
      if (r["Paid until"]) {
        ends_on = parseDate(r["Paid until"]);
        if (!ends_on) problems.push(`Can't read the date "${r["Paid until"]}"`);
        else if (starts_on && ends_on < starts_on) problems.push("Paid until is before the last paid date");
      } else if (plan && starts_on) {
        ends_on = addDays(starts_on, plan.duration_days - 1); // same as a renewal
      }
      plan_id = plan?.id ?? null;
    }

    let amount_paise: number | null = null;
    if (r.Amount) {
      const rupees = Number(r.Amount.replace(/[₹,\s]|rs\.?/gi, ""));
      if (!Number.isFinite(rupees) || rupees < 0 || rupees > 10_00_000) problems.push(`Check the amount "${r.Amount}"`);
      else amount_paise = Math.round(rupees * 100);
      if (!hasMembership) problems.push("An amount needs a plan and date");
    }

    return { line, full_name, phone: r.Phone, intl_phone, email, plan_id, starts_on, ends_on, amount_paise, problems };
  });
}

export function templateCsv(plans: ImportPlan[]) {
  const plan = plans[0]?.name ?? "Monthly";
  return [
    IMPORT_COLUMNS.join(","),
    `Ravi Kumar,9876543210,,${plan},01/10/2026,31/10/2026,1500`,
    `Priya Sharma,9123456780,priya@example.com,${plan},05/10/2026,,1500`,
    "Arjun Nair,9988776655,,,,,",
  ].join("\r\n");
}
