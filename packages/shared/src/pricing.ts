// What gyms pay for the app, in one place: the public pricing page reads it,
// and so will the owner's Plan & billing page. Amounts in rupees.
//   monthly / yearly   the regular price
//   founding           a lower monthly price, locked for as long as the gym
//                      stays, for the first `foundingSpots` gyms
//   freeMonths         free months before the first payment
export const PRICING = {
  monthly: 499,
  yearly: 4990,
  founding: { monthly: 349, spots: 20 },
  freeMonths: 1,
  setupFee: 0,
} as const;

/** "₹4,990" */
export const rupees = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;
