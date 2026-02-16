# Time Slots — Multi‑User Testing (Book First, Then Verify)

Use this document to test **real booking collisions**.

Goal: one user books a slot first, then another user tries to book the same time/slot and the app should:
- show **Verifying / Checking availability**
- show **Booked / Not available** for the blocked slot
- show a clear **message** when the user changes time slot or date

This focuses on the logic that checks **available workers** vs **time slot selection**.

---

## 1) What you need

### Accounts
- **User A** (Customer account)
- **User B** (Another Customer account)

### Data setup
- Pick 1 service (example: “Cleaning”) and 1 company/provider.
- Make sure the provider has **only 1 active worker** (best for easy testing).
  - If there are more workers, the same time slot may stay available.

### Notes
- Do these tests on real devices if possible.
- Keep both phones on network.

---

## 2) Important things to observe

While testing, always check:
1. Does the screen show **Verifying availability…** when it should?
2. Does it block **Continue** while verifying?
3. Does it show **Booked / Not available** after verification?
4. Does it show the correct **warning message** when user changes time/date?

---

## 3) Test Case MU1 — Same service + same company + same date/time (should block second booking)

### Part A — User A books first
1. Login as **User A**.
2. Open a **normal service** (not a package).
3. Go to **Select Date & Time**.
4. Choose:
   - Date = tomorrow
   - Time = pick one time slot (example: “11:00 AM - 1:00 PM”)
5. Complete the booking (cash or online — any method).
6. Confirm booking is created (Booking History should show it).

### Part B — User B tries the same slot
1. Login as **User B**.
2. Open the **same service** and choose the **same company** (if company selection exists).
3. Go to **Select Date & Time**.
4. Select the same:
   - Date = tomorrow
   - Time = same time slot used by User A

**Expected**
1. The app should show **Verifying / Checking availability…**.
2. That time slot should become **Booked** (or **Not available**) after verification.
3. User B should NOT be able to continue with that slot.

---

## 4) Test Case MU2 — User B changes to another time slot (message should show)

### Steps
1. Continue from MU1 Part B (User B on time-slot screen).
2. Tap a different time slot.

**Expected**
1. App shows a message like **“Checking availability…” / “Verifying…”**.
2. If other time slot has worker available:
   - It should show **Available**
   - Continue should become enabled
3. If other time slot also has no worker:
   - It should show **Booked / Not available**
   - Continue should stay disabled

---

## 5) Test Case MU3 — User B changes date (re-check happens)

### Steps
1. Still as User B.
2. Change the date to the next day.
3. Wait for verification to complete.

**Expected**
1. Slots should show **Verifying** first (not “Available” immediately).
2. After verifying:
   - Slots update correctly.
3. Continue stays disabled while verifying.

---

## 6) Test Case MU4 — Two bookings fill a single slot (when there are 2 workers)

Use this only if the provider has **2 active workers**.

### Steps
1. User A books date D + slot T (same company).
2. User B books date D + slot T (same company).
3. User C tries date D + slot T.

**Expected**
- Slot should become **Booked/Not available** for User C after verification.

---

## 7) Test Case MU5 — Long duration service (continuous block) collision

Use a service that needs multiple slots (example: 4 hours => 2 slots).

### Steps
1. User A books starting at time slot T where it consumes T and T+1.
2. User B tries starting at:
   - the same T
   - or T+1

**Expected**
- If the block overlaps, User B should not be able to select a valid continuous block.
- App should show error like **“Not enough continuous availability…”**.

---

## 8) What to record when a test fails

When something fails, capture:
1. Screenshots (loader, slot list, error text).
2. Booking IDs (from console logs if possible).
3. Date + time slot used.
4. Company ID (if visible).

