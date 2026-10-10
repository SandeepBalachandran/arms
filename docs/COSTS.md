# GOS — What It Costs to Run

Everything you pay for to take GOS live: the web admin, the member app, the database, messaging and the app stores, with the costs that are easy to miss.

- **Prices checked:** October 2026. Providers change prices often, so check each link in [Sources](#sources) before paying.
- **Exchange rate:** about **₹88 per US dollar**. Most of these services bill in dollars.
- **Bottom line:** a production launch costs about **₹4,500–5,500 a month**, plus about **₹3,000–10,000 one time**. Messaging (WhatsApp/SMS) is extra and grows with the number of members; pass it on to gyms.

---

## 1. At a glance

### Monthly, at launch (1–10 gyms, under 2,000 members)

| Service | What it does in GOS | Plan | Per month |
|---|---|---|---|
| Supabase | Database, logins, file storage (logos), scheduled jobs | Pro | $25 (≈ ₹2,200) |
| Vercel | Hosts the web admin, join pages and posters | Pro, 1 seat | $20 (≈ ₹1,760) |
| Expo EAS | Builds the Android/iOS app | Free | ₹0 |
| Resend | Sign-in and confirmation emails | Free (3,000/month) | ₹0 |
| Domain | `yourbrand.in` or `.com` | — | ≈ ₹100 (₹1,000–1,800 a year) |
| **Subtotal** | | | **≈ ₹4,060** |
| GST and card fees | 18% GST on foreign services, about 3.5% forex markup | | ≈ ₹700–900 |
| **Total** | | | **≈ ₹4,800–5,000** |

### One-time

| Item | Cost | Needed for |
|---|---|---|
| Google Play developer account | $25 (≈ ₹2,200) | Publishing the Android app |
| Apple Developer Program | $99 **per year** (≈ ₹8,700) | Publishing on iPhone (can wait) |
| DLT registration (India SMS) | ≈ ₹0–6,000 depending on operator | Only if you send SMS |
| D-U-N-S number | Free | Only for a company (organisation) Play or Apple account |
| WhatsApp Business verification (Meta) | Free | WhatsApp login codes and reminders |

---

## 2. Each service in detail

### Supabase: database, logins and storage

GOS keeps everything here: gyms, members, payments, check-ins, and logins.

| Plan | Price | Limits that matter for GOS |
|---|---|---|
| Free | $0 | **Pauses after 1 week without activity**, 500 MB database, 1 GB files, no backups. **Not for real gyms.** |
| **Pro** | **$25/month** | 8 GB database, 100 GB files, 250 GB transfer, 100,000 monthly users, daily backups kept 7 days, never pauses. $10 of server credit covers the smallest server (Micro). |

**Extra charges on Pro:**

| Item | Price | When you'd need it |
|---|---|---|
| Bigger server (Small) | $15/month (−$10 credit = **+$5**) | Around 50+ gyms, or if the app feels slow |
| Bigger server (Medium) | $60/month | Hundreds of gyms |
| Database over 8 GB | $0.125 per GB | Years of check-ins at many gyms |
| Transfer over 250 GB | $0.09 per GB | Very unlikely at GOS's size |
| Monthly users over 100,000 | $0.00325 each | ≈ 100,000 members using the app each month |
| Custom domain (e.g. `api.gos.in`) | $10/month | Optional: makes login emails and links show your domain |
| Point-in-time recovery | $100/month | Optional: restore to any minute. Daily backups are included anyway |
| Dedicated IPv4 address | ≈ $4/month | Only if you connect to the database from an IPv4-only network; the free "session pooler" avoids this |

**GOS estimate:** **$25/month** for a long time. A gym with 300 members produces a few MB of data a month, so 8 GB covers hundreds of gyms.

### Vercel: web admin hosting

Hosts the admin panel, sign-in, join pages (`/join/<gym>`) and check-in posters.

| Plan | Price | Notes |
|---|---|---|
| Hobby | $0 | **Not allowed for commercial use** under Vercel's terms. Fine while testing. |
| **Pro** | **$20 per team member per month** | Covers about 1 TB of transfer, which GOS won't come close to. Overages are billed unless you set a spend limit. |

**GOS estimate:** **$20/month** with one seat (you). Each extra developer adds $20.

**Cheaper alternatives:** Cloudflare Pages, Netlify or a small VPS (about ₹500–1,000/month) can host the admin. They need some setup changes; Vercel is the simplest for Next.js.

### Expo EAS: app builds

Turns the code into an APK/AAB (Android) and IPA (iPhone).

| Plan | Price | Notes |
|---|---|---|
| **Free** | $0 | About 15–30 builds a month (sources differ), in a slower queue. Over-the-air updates for 1,000 users. |
| Starter | $19/month | Faster builds and over-the-air updates for 3,000 users. |
| Production | $199/month | Only at large scale. |

**GOS estimate:** **₹0**. You build only when releasing. Upgrade to Starter ($19) when you want instant bug fixes without a store update ("EAS Update") for more than 1,000 members.

### Domain name

| Option | First year | Renewal (yearly) |
|---|---|---|
| `.in` / `.co.in` (Indian registrars) | ₹200–800 | ≈ ₹700–1,000 |
| `.com` on GoDaddy or Hostinger | ₹1–200 (promotion) | **₹1,500–1,850 + 18% GST** |
| `.com` on Cloudflare | ≈ $10.5 | ≈ $10.5 (no renewal jump) |

**Hidden cost:** first-year offers are cheap, but renewals cost 5–10× more. Compare renewal prices, or pay for 2–5 years upfront. Cloudflare charges the same every year.

### Email: sign-in links and codes

Supabase's built-in email sender is limited to a handful of emails per hour and is meant for testing only. **Production needs your own email service.**

| Service | Free | Paid |
|---|---|---|
| **Resend** | 3,000 emails/month (100 a day) | $20/month for 50,000 |
| Brevo, Amazon SES | Similar free tiers | SES ≈ $0.10 per 1,000 |

**GOS estimate:** **₹0** at first. Email is only used for sign-in and account confirmation. If logins move to WhatsApp or SMS codes, email use falls further. Over 100 sign-ins a day needs the $20 plan.

### WhatsApp Business API: login codes, reminders, offers

Needed for the planned **WhatsApp login codes**, automatic renewal reminders and offer broadcasts. Today's "Send on WhatsApp" buttons open the gym's own WhatsApp and cost nothing.

Meta charges **per delivered message** (India, before 18% GST):

| Type | Used for | Price | With GST |
|---|---|---|---|
| Authentication | Login codes | ₹0.115 | ≈ ₹0.14 |
| Utility | Renewal reminders, payment confirmations | ₹0.115 | ≈ ₹0.14 |
| Marketing | Offers, win-back campaigns | ₹0.8631 | ≈ ₹1.02 |
| Service | Replies within 24 h of the member messaging you | Free | Free |

**Hidden costs:**
- **The provider's markup.** You usually send through a provider such as Gupshup, Interakt, AiSensy or Twilio. They add **10–30%** or a monthly fee of about ₹1,000–3,000. Connecting directly through Meta's Cloud API avoids this but takes more development work.
- **Marketing is about 7× the price of utility**, so offer campaigns are where the money goes.
- Meta can change prices up to 4 times a year.

**Examples:**

| Situation | Messages | Cost |
|---|---|---|
| 500 members log in once | 500 codes | ≈ ₹70 |
| Renewal reminders: 300 members, 2 reminders each, monthly | 600 | ≈ ₹85/month |
| One offer to 1,000 past members | 1,000 | ≈ ₹1,020 per campaign |

### SMS (backup for login codes)

| Item | Cost |
|---|---|
| OTP SMS via MSG91 or similar | ≈ ₹0.13–0.20 per SMS |
| **DLT registration** (required for business SMS in India) | One time, ≈ ₹0–6,000 depending on operator; plus template approval time (days) |

**GOS estimate:** small, only for members whose WhatsApp code doesn't arrive.

### App stores

| Store | Fee | Hidden requirements |
|---|---|---|
| **Google Play** | **$25 once** | A **personal** account must run a closed test with **12 testers for 14 days** before going public. A **company** account needs a D-U-N-S number (free) instead. |
| **Apple App Store** | **$99 every year** | A company account needs a D-U-N-S number, a website and an email on your domain. Builds and submission work from Windows via EAS, but you need an iPhone to test. |

**Store commission:** none for GOS. Gym fees are paid outside the app (UPI or cash), and the gym subscription would be billed outside the stores. That's allowed for a business tool, but read the store rules before adding in-app purchases.

---

## 3. Costs that are easy to miss

| # | Cost | Typical amount | How to avoid or reduce it |
|---|---|---|---|
| 1 | **18% GST on foreign services** (Supabase, Vercel, Apple and others charge it to Indian cards) | +18% | Register for GST once revenue starts and claim it back as input credit |
| 2 | **Card forex markup** on dollar payments | +2–3.5% | Use a zero-forex card (Niyo, Scapia, some credit cards) |
| 3 | **Domain renewal jump** | 5–10× year 1 | Cloudflare, or a multi-year purchase |
| 4 | **WhatsApp provider markup** | +10–30% or ₹1,000–3,000/month | Meta Cloud API directly, or pick a provider with no monthly fee |
| 5 | **Vercel Hobby can't be used commercially** | $20/month once live | — |
| 6 | **Supabase Free pauses** after a week without activity | Downtime | Use Pro from launch |
| 7 | **Built-in email sender** isn't for production | Logins fail | Resend (free) before launch |
| 8 | **Play Store 12-tester closed test** for personal accounts | 2+ weeks delay | Start it early, or use a company account |
| 9 | **Apple renews yearly** | $99 every year | Launch Android first (as planned) |
| 10 | **Usage overages** on Vercel/Supabase | Usually ₹0 at GOS's size | Set spend limits and billing alerts on both |
| 11 | **Backups beyond 7 days** | $100/month for point-in-time recovery | Weekly CSV/SQL export as a free extra copy |
| 12 | **Privacy policy and terms** (required by stores and India's DPDP Act) | ₹0 with a template, ₹5,000–20,000 with a lawyer | Template first, lawyer before scaling |
| 13 | **Business registration** (to sign up gyms, and for D-U-N-S/GST) | ₹1,000–8,000 (sole proprietorship/MSME to private limited) | Start as a proprietor if you like |
| 14 | **Your own time** keeping things updated (Expo/Next.js upgrades, store policy changes) | A few hours a month | — |

---

## 4. Scenarios

All monthly, including GST and card fees. Messaging assumes WhatsApp login codes, monthly renewal reminders and one offer campaign a month to half the members.

| | Pilot | Growing | Established |
|---|---|---|---|
| Gyms | 1–5 | 20 | 100 |
| Members | ≈ 1,000 | ≈ 5,000 | ≈ 25,000 |
| Supabase | ₹2,600 | ₹2,600 | ₹3,100 (Small server) |
| Vercel | ₹2,100 | ₹2,100 | ₹4,200 (2 seats) |
| Expo EAS | ₹0 | ₹2,000 (Starter) | ₹2,000 |
| Email (Resend) | ₹0 | ₹0 | ₹2,100 |
| Domain | ₹100 | ₹100 | ₹100 |
| **Platform total** | **≈ ₹4,800** | **≈ ₹6,800** | **≈ ₹11,500** |
| WhatsApp reminders and codes | ≈ ₹300 | ≈ ₹1,500 | ≈ ₹7,000 |
| WhatsApp offers (marketing) | ≈ ₹500 | ≈ ₹2,500 | ≈ ₹12,500 |
| Provider fee (if any) | ₹0–1,500 | ₹1,500 | ₹3,000 |
| **All in** | **≈ ₹5,600–7,100** | **≈ ₹12,300** | **≈ ₹34,000** |
| **Cost per gym** | ₹1,100–7,000 | ≈ ₹600 | ≈ ₹340 |

At 20+ gyms, the platform costs **about ₹300–600 per gym per month**, so a GOS subscription of ₹999–1,999 per gym leaves a healthy margin.

---

## 5. Who should pay for what

| Cost | Who pays | How |
|---|---|---|
| Hosting, database, builds, domain, email | **You (GOS)** | Covered by the monthly gym subscription |
| WhatsApp **login codes and reminders** | **You** | Small (≈ ₹0.14 each); include in the subscription with a fair-use limit |
| WhatsApp **offer campaigns** | **The gym** | Prepaid message credits, e.g. sell 1,000 credits for ₹1,500 |
| SMS | You (fallback only) | — |
| Gym's own UPI payments | Nobody | GOS uses no payment gateway, so there are no fees |

---

## 6. Launch checklist (in order)

1. **Supabase Pro** ($25), and turn on billing alerts.
2. **Domain:** buy it, then point it at Vercel.
3. **Vercel Pro** ($20), with a spend limit.
4. **Resend:** verify the domain and plug it into Supabase Auth (Settings → SMTP).
5. **Google Play account** ($25), and start the closed test with 12 testers early.
6. **Privacy policy and terms** pages on the website.
7. *(When adding WhatsApp login)* Meta Business verification, then choose a provider or use the Cloud API.
8. *(Later)* Apple Developer ($99/year), Expo Starter, and a bigger Supabase server.

**Cash needed to launch on Android:** about **₹2,200 one time + ₹4,800 a month**.

---

## Sources

Checked October 2026. Most figures are from the providers' pages; some are from third-party summaries where the provider doesn't publish INR prices.

- Supabase: [pricing](https://supabase.com/pricing.md), [billing docs](https://supabase.com/docs/guides/platform/billing-on-supabase)
- Vercel: [pricing explained (2026)](https://temps.sh/blog/vercel-pricing-2026-pro-plan-explained), [real project costs](https://dev.to/nayankyada/vercel-pricing-2026-what-you-actually-pay-for-a-real-nextjs-project-33md)
- Expo EAS: [pricing](https://expo.dev/pricing), [usage-based billing](https://docs.expo.dev/billing/usage-based-pricing.md)
- WhatsApp (India): [rates and GST](https://montymobile.com/blogs/whatsapp-business-api-pricing-in-india-inr-rates-gst-and-the-2026-currency-migration-deadline), [rate summary](https://whautomate.com/whatsapp-business-api-pricing-india), [ChatMaxima India rates](https://chatmaxima.com/whatsapp-api-pricing/india/)
- SMS OTP (India): [OTP price comparison](https://www.messagecentral.com/blog/sms-otp-pricing-india), [MSG91 notes](https://docs.botble.com/sms-gateways/drivers/msg91.html)
- Email: [Resend pricing 2026](https://www.usecarly.com/blog/resend-pricing/)
- Domains: [GoDaddy India renewals](https://zoutons.com/news/godaddy-domain-pricing-2026-renewal-explained), [Hostinger India](https://zoutons.com/news/hostinger-domain-price-india-2026), [Cloudflare .com](https://domainoffer.net/tld/com/cloudflare), [.in prices compared](https://domainoffer.net/tld/in)
- App stores: [Google Play account (2026)](https://afkarsoftware.com/en/blog-detail/google-play-console-account-2026-one-time-25-fee/), [Apple enrollment](https://developer.apple.com/support/enrollment/)

Not confirmed from a source (estimates): the Supabase IPv4 add-on price (≈ $4), DLT registration fees, and the exchange rate.
