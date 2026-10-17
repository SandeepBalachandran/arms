// What gyms pay for the app, in one place: the public pricing page reads it,
// and so will the owner's Plan & billing page. Amounts in rupees.
//   monthly / yearly   the regular price
//   founding           a lower monthly price, locked for as long as the gym
//                      stays, for the first `founding.spots` gyms
//   freeMonths         free months before the first payment
//   registrationFee    one-time, every gym (founding too), added to the first
//                      payment after the free month, so nobody pays it before
//                      trying the app; not refunded once paid
export const PRICING = {
  monthly: 499,
  yearly: 4990,
  founding: { monthly: 349, spots: 5 },
  freeMonths: 1,
  registrationFee: 2500,
} as const;

/** "₹4,990" */
export const rupees = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;
