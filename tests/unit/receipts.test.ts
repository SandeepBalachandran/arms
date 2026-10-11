import { describe, expect, it } from "vitest";
import { receiptHtml, receiptText, receiptView, type ReceiptInput } from "@gymos/shared";

const base: ReceiptInput = {
  gym: { name: "Arms Fitness", address: "MG Road, Kochi", phone: "9876543210", phone_country_code: "91", logo_url: null, receipt_prefix: "AF-", currency: "INR", timezone: "Asia/Kolkata" },
  memberName: "Ravi Kumar",
  payment: { receipt_no: 42, paid_at: "2026-09-30T20:00:00Z", amount_paise: 150000, method: "upi", utr: "123456789012" },
  item: { kind: "plan", name: "Monthly", starts_on: "2026-10-01", ends_on: "2026-10-31" },
};

describe("receiptView", () => {
  it("lays out a membership receipt in the gym's time zone", () => {
    expect(receiptView(base)).toMatchObject({
      number: "AF-42",
      paidOn: "1 Oct 2026", // 20:00 UTC on 30 Sep is 1 Oct in India
      what: "Membership: Monthly",
      period: "1 Oct 2026 – 31 Oct 2026",
      method: "UPI",
      reference: "123456789012",
      amount: "₹1,500",
      gymPhone: "+91 9876543210",
      sessions: null,
    });
  });

  it("describes a PT package with its sessions", () => {
    const v = receiptView({ ...base, item: { kind: "pt", name: "12 PT sessions", starts_on: "2026-10-01", ends_on: "2026-11-29", sessions: 12 } });
    expect(v).toMatchObject({ what: "Personal training: 12 PT sessions", sessions: "12 sessions" });
  });

  it("uses # when the gym has no receipt prefix", () => {
    expect(receiptView({ ...base, gym: { ...base.gym, receipt_prefix: "" } }).number).toBe("#42");
  });
});

describe("sharing", () => {
  it("a WhatsApp message with the essentials", () => {
    expect(receiptText(receiptView(base))).toBe(
      "*Arms Fitness* · Receipt AF-42\nReceived from Ravi Kumar on 1 Oct 2026\nMembership: Monthly\nValid 1 Oct 2026 – 31 Oct 2026\nAmount: ₹1,500 (UPI, ref 123456789012)\nThank you!",
    );
  });

  it("the PDF version escapes names, so a member's name can't inject HTML", () => {
    const html = receiptHtml(receiptView({ ...base, memberName: '<img src=x onerror="alert(1)">' }));
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("AF-42");
  });
});
