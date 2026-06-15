# Digital Shrine

Desktop-first PWA for a mythology-inspired guardian ritual companion.

## Your safest launch plan

If you are a mainland China solo developer, and your priorities are:

- safest release path
- highest chance of actually receiving money
- lowest launch cost

then this project should launch in this order:

1. `Web/PWA only`
2. `Cloudflare Pages` deployment
3. `One-time ritual packs first`
4. `Membership later`
5. `PayPal payment link first, hosted checkout only after payout route is verified`

This means:

- do not launch through the App Store first
- do not make subscription the main payment path on day one
- do not rely on direct Stripe merchant setup as your first assumption
- do not activate live charging until your real payout route is confirmed

## Why this is the best path

### Safest

- Web launch avoids app-store review risk
- You can keep the product framed as symbolic ritual guidance without store-policy pressure
- PayPal payment links are easier to control than app-native billing for a mainland China founder

### Most likely to receive money

- One-time packs are easier for first-time overseas buyers than a recurring subscription
- They match the product's core behavior better: one current need, one specific guided pack
- You need fewer moving parts to fulfill a one-time purchase well

### Cheapest

- Cloudflare Pages can host this static Vite build at very low cost
- No app packaging, no app-store account costs, no mobile release overhead
- No need to build full subscription lifecycle operations before first launch

## Recommended commercial shape

### Launch version

- free guardian match
- free first ritual answer
- one-time ritual packs as the main paid conversion
- restore access by email
- optional membership UI can remain in preview mode, but should not be the main CTA

### Later version

Only after the pack-first launch proves:

- buyers are willing to pay
- fulfillment feels good
- payout route is stable
- users actually return

then add:

- membership
- archive retention
- longer memory features
- recurring billing

## Payment reality

Current practical signals we already verified:

- direct Stripe merchant setup is not the simplest first assumption for a mainland China founder
- Paddle can reject products that look too close to fortune telling or spiritual advisory services
- PayPal is the most realistic first live path if your top priority is actually receiving overseas money quickly

So the safe operating rule is:

- keep the code ready for payment-link checkout
- keep launch mode conservative
- only turn on live checkout after you verify your payout path in reality

## Deployment plan

### Cheapest recommended deployment

Use `Cloudflare Pages`.

Why:

- very low cost
- good global edge delivery
- ideal for static Vite output
- simple custom domain support later

### Local run

```bash
npm install
npm run dev -- --host 127.0.0.1
```

### Build

```bash
npm run build
```

### Cloudflare Pages settings

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: current LTS

## Commerce mode for launch

Use these environment values first:

```bash
VITE_COMMERCE_BACKEND=local
VITE_COMMERCE_API_BASE=http://127.0.0.1:8787
VITE_PAYMENT_PROVIDER=manual_waitlist
VITE_PAYMENT_LINK_MODE=demo
VITE_PAYPAL_CHECKOUT_URL=
VITE_PADDLE_CHECKOUT_URL=
VITE_LEMONSQUEEZY_CHECKOUT_URL=
```

Meaning:

- `manual_waitlist`
  safest pre-live mode
- `demo`
  lets you test the hosted-checkout-shaped flow without promising real charging

When you are ready for your first real-money launch, prefer:

```bash
VITE_PAYMENT_PROVIDER=paypal
VITE_PAYMENT_LINK_MODE=live
VITE_PAYPAL_CHECKOUT_URL=https://www.paypal.com/ncp/payment/your-payment-link
```

## What to turn on first

### Phase 1

- public web launch
- one-time ritual pack CTA
- email restore
- trust, privacy, terms pages

### Phase 2

- verified hosted checkout
- real order confirmation
- webhook-based fulfillment

### Phase 3

- membership only if needed

## Current project direction

This repo is now shaped toward:

- web-first launch
- hosted-checkout-ready architecture
- pack-first monetization
- launch-safe product framing
- low-cost deployment path
