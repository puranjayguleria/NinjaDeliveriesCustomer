# Services Booking Alpha Test Script (4 hours, very specific)

This is a **consumer-style alpha testing script** for the NinjaDeliveries Customer app.

You have **4 hours**. If you complete this script, we’ll know the Services booking flow is working for real users.

---

## What you’re testing

You’ll create **multiple bookings** using:
- **Direct service booking (one-time)**
- **Package booking (weekly/monthly plan)**

You’ll also test:
- slot selection rules (tomorrow-only, availability)
- multi-slot auto-selection (when quantity is more)
- company/provider selection
- checkout (address + payments)
- booking history (filters, cancel)
- payment recovery (if app is closed)

---

## How to record results (simple)

For each test, mark **PASS** or **FAIL**.

If FAIL, note:
- what you tapped
- what you expected
- what actually happened
- screenshot/screen recording if possible

---

## Setup (10 minutes)

### S1. Login + basic connectivity
1. Open the app.
2. Confirm you’re logged in.
3. Open **Services**.

PASS if:
- Services screen opens without crash.

### S2. Prepare a saved address (or add one)
1. Start any service booking and reach **Checkout**.
2. If you don’t already have an address saved, add one.

PASS if:
- You can save an address.
- Address becomes selected.

---

## Session 1 — Direct service booking (1 booking) (35 minutes)

Goal: confirm basic slot booking works end-to-end for a one-time service.

### 1.1 Pick a non-package service
1. Services → pick any category.
2. Choose a service that is **not a package** (normal one-time service).

PASS if:
- You reach **Select Date & Time**.

### 1.2 Date rules (tomorrow-only)
On Select Date & Time:
- Try selecting **today** or any **past day**.

PASS if:
- Today/past cannot be selected.
- Earliest selectable date is **tomorrow**.

### 1.3 Pick a date + one slot
1. Select **tomorrow**.
2. Select a slot like **9:00 AM - 11:00 AM**.
3. Continue → pick a company/provider (if asked) → go to checkout.

PASS if:
- You can proceed without errors.

### 1.4 Checkout (cash) and confirm booking appears
1. Choose **Cash** (or “Pay on service”).
2. Place the booking.
3. Open **Booking History**.

PASS if:
- Booking is visible.
- Status looks reasonable (pending/assigned/etc.).

Record booking name + date/time here:
- Booking #1: ______________________

---

## Session 2 — Multi-quantity contiguous slots (1 booking attempt) (35 minutes)

Goal: confirm when quantity is higher, the app auto-picks multiple continuous slots.

### 2.1 Choose a service where you can increase quantity
1. Go back to Services.
2. Choose a service where you can select **2 or 3 quantities** (or multiple issues/items).

### 2.2 Pick start slot and verify the app selects a block
1. Go to Select Date & Time.
2. Choose **tomorrow** (or day after tomorrow).
3. Tap a start slot.

PASS if:
- The app auto-selects **multiple slots** (a block).
- The block is continuous (same day or continues into next day if needed).

### 2.3 Try a “hard” start slot (late day)
1. Select a late start slot like **7:00 PM - 9:00 PM**.

PASS if:
- If it can’t fit required slots, it shows a clear message (no crash).

Optional: if it allows checkout, place booking as **Cash**.

Record booking name + date/time here (if placed):
- Booking #2: ______________________

---

## Session 3 — Weekly package plan (7 days) (1 booking) (55 minutes)

Goal: confirm the plan calendar selection works and enforces exactly 7 days.

### 3.1 Enter package flow
1. Services → choose a category/service that offers **packages**.
2. Select a **Weekly** package.

PASS if:
- Package details are visible clearly (price + unit/frequency).

### 3.2 Calendar selection rules
On the plan calendar:
- Confirm you can see **this month + next month**.
- Confirm you can’t select today/past.

PASS if:
- Only **tomorrow onward** is selectable.

### 3.3 Select exactly 7 days
1. Select a start day.
2. Select days until total selected days = **7**.

Now test limits:
- Try selecting an 8th day.

PASS if:
- App prevents selecting more than 7 (or shows an understandable message).

Now test incomplete selection:
1. Unselect one day so you have 6.
2. Try to continue.

PASS if:
- App prompts you to complete the 7 days (doesn’t silently proceed).

### 3.4 Pick a time slot for the plan
1. Select a time slot.

PASS if:
- It validates availability and doesn’t take an unusually long time.

### 3.5 Provider + checkout
1. Choose provider/company option.
2. Checkout using **Cash** (recommended for alpha to avoid payment friction).
3. Confirm in Booking History.

PASS if:
- Booking entry/entries appear.
- Package booking is identifiable as a package/plan.

Record here:
- Booking #3 (weekly plan): ______________________

---

## Session 4 — Monthly package plan (30 days) (1 booking) (60 minutes)

Goal: confirm 30-day selection works across month boundary and conflict days are blocked.

### 4.1 Enter monthly plan
1. Services → pick a package service.
2. Select a **Monthly** package.

### 4.2 Select dates up to 30 (spanning months)
1. Choose a start date near the end of the month (example: 25th–30th) so it has to spill into next month.
2. Select dates until total = **30**.

PASS if:
- You can select into next month.
- Selection stops at 30.

### 4.3 Conflict days (red cross)
1. Look for any day marked with **red cross**.
2. Try to tap that day.

PASS if:
- You cannot select conflict days.

### 4.4 Choose slot time and proceed
1. Select a time slot.
2. Continue to company selection and checkout.

Recommendation: use **Cash** unless you’re specifically testing online payment.

Record here:
- Booking #4 (monthly plan): ______________________

---

## Session 5 — Multiple bookings & cart behavior (40 minutes)

Goal: ensure user can create multiple bookings without confusion/duplication.

### 5.1 Two different direct services, same checkout
1. Add Direct Service A.
2. Add Direct Service B.
3. Go to cart/checkout.

PASS if:
- Total amount looks correct.
- Services list shows both items.

Place booking (Cash) if possible.

Record:
- Booking #5 (multi-service checkout): ______________________

### 5.2 Same service twice (duplicate item case)
1. Add the same service again (or increase quantity).

PASS if:
- App clearly shows quantity and price updates.
- No weird duplication in cart.

### 5.3 Rapid tapping (duplication safety)
1. On final “Proceed/Pay/Place booking” button, tap quickly 3–5 times.

PASS if:
- Only one booking/payment attempt happens.
- You do not get duplicate bookings.

---

## Session 6 — Online payment + recovery (optional but highly valuable) (30 minutes)

Only do this if you have a test payment method available.

### 6.1 Online payment happy path
1. Create a small booking.
2. Choose **Online**.
3. Complete payment.

PASS if:
- Booking appears in Booking History.

### 6.2 Payment recovery (close app)
1. Start another online payment.
2. After payment step (or during verification), force close the app.
3. Reopen app.
4. Open Booking History.

PASS if:
- App recovers and finalizes paid booking.
- Cart is cleared for successful payment.
- No duplicates.

---

## Session 7 — Booking history, filters, and cancellation (15 minutes)

### 7.1 Filters
1. Booking History → switch filters: All / Active / Pending / Done / Reject / Cancel.

PASS if:
- List updates without lag/crash.

### 7.2 Cancellation
1. Open a pending/active booking.
2. Try cancel.

PASS if:
- Confirmation UI appears.
- Booking becomes cancelled.

---

## Final report (5 minutes)

Share:
- Number of bookings you created (target: 4–6)
- Any FAILs with screenshot/video
- Any confusing UX (even if it “works”)

### Minimum pass criteria (must be green)
- [ ] Direct booking works end-to-end using Cash
- [ ] Multi-slot (quantity) auto-select works OR fails gracefully with message
- [ ] Weekly plan enforces exactly 7 days
- [ ] Monthly plan enforces exactly 30 days (spanning months)
- [ ] Conflict days (red cross) cannot be selected
- [ ] Booking History shows the bookings and filters work
