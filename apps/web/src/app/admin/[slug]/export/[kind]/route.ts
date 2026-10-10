import { NextResponse } from "next/server";
import { formatReceipt, PAYMENT_METHOD_LABELS } from "@gymos/shared";
import { getMyGyms } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// CSV downloads of a gym's members and payments, for the owner's records
// (offered before deleting a gym). Owners and admins only.
export async function GET(_request: Request, { params }: RouteContext<"/admin/[slug]/export/[kind]">) {
  const { slug, kind } = await params;
  const membership = (await getMyGyms()).find((m) => m.gym.slug === slug);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const { gym } = membership;
  const supabase = await createClient();
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: gym.timezone }) : "");

  let rows: (string | number | null)[][];
  if (kind === "members") {
    const { data, error } = await supabase
      .from("gym_members")
      .select("role, status, joined_at, profiles!inner(full_name, phone)")
      .eq("gym_id", gym.id)
      .order("joined_at");
    if (error) return new NextResponse(error.message, { status: 500 });
    rows = [
      ["Name", "Phone", "Role", "Status", "Joined"],
      ...data.map((m) => [m.profiles.full_name, m.profiles.phone, m.role, m.status, date(m.joined_at)]),
    ];
  } else if (kind === "payments") {
    const { data, error } = await supabase
      .from("payments")
      .select("created_at, paid_at, amount_paise, method, status, receipt_no, utr, note, plans(name), pt_subscriptions(package_name), gym_members!inner(profiles!inner(full_name))")
      .eq("gym_id", gym.id)
      .order("created_at");
    if (error) return new NextResponse(error.message, { status: 500 });
    rows = [
      ["Date", "Paid on", "Member", "For", "Amount", "Method", "Status", "Receipt", "UPI ref", "Note"],
      ...data.map((p) => [
        date(p.created_at),
        date(p.paid_at),
        p.gym_members.profiles.full_name,
        p.plans?.name ?? (p.pt_subscriptions ? `PT: ${p.pt_subscriptions.package_name}` : ""),
        (p.amount_paise / 100).toFixed(2),
        PAYMENT_METHOD_LABELS[p.method] ?? p.method,
        p.status,
        p.receipt_no === null ? "" : formatReceipt(gym.receipt_prefix, p.receipt_no),
        p.utr,
        p.note,
      ]),
    ];
  } else {
    return new NextResponse("Not found", { status: 404 });
  }

  // Excel opens UTF-8 CSVs correctly (₹, Indian names) only with a BOM.
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${gym.slug}-${kind}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function cell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  // Quote everything that needs it; a leading = + - @ is neutralised so a
  // spreadsheet never runs a member-entered value as a formula.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) || safe !== text ? `"${safe.replace(/"/g, '""')}"` : safe;
}
