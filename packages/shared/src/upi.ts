import { z } from "zod";

// Direct UPI payments to the gym's own UPI ID (no gateway).

// Mirrors the check constraint on public.gyms.upi_id, e.g. "ironfit@okhdfcbank".
export const upiIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9]{2,64}$/, "Enter a UPI ID like name@okhdfcbank");

// UPI transaction reference (UTR / RRN), usually 12 digits. Optional.
export const utrSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => v === "" || /^[A-Z0-9]{6,35}$/.test(v), "Check the reference number");

// upi://pay link that opens GPay/PhonePe/Paytm with payee and amount filled in.
// Some apps limit amount-prefilled links to personal UPI IDs, so screens should
// also show the UPI ID for paying manually.
export function upiPayLink({
  upiId,
  payeeName,
  amountPaise,
  note,
}: {
  upiId: string;
  payeeName: string;
  amountPaise: number;
  note: string;
}) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: (amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: note.slice(0, 50),
  });
  // Spaces as %20 and a literal "@": some UPI apps reject "+" and "%40".
  return `upi://pay?${params.toString().replace(/\+/g, "%20").replace(/%40/g, "@")}`;
}
