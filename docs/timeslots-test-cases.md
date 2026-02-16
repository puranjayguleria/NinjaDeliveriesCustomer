
# Time Slots — Simple Test Cases (Normal Services + Packages)

Use this file to test time slot selection in `SelectDateTimeScreen`.

## 1) What are the 2 service types?

### Type A — Normal service (one-time booking)
- This is the normal service flow (NOT a package).
- You select a **date** and then you select a **start time**.
- If the service needs more time, the app selects a **block of continuous slots**.
- The app checks availability. This can take a few seconds.

### Type B — Package (can be one-time or recurring)
- This is package booking.
- Some packages are recurring. Examples:
  - **Daily** package: select **1 day** from next **7** days.
  - **Weekly** package: select **7 days**.
  - **Monthly** package: select **30 days**.
- Then select a time window.

---

## 2) Setup (do this before testing)

1. Login with a customer account.
2. Make sure at least 1 service exists.
3. Make sure at least 1 company/provider exists with active workers.
4. Create at least 1 booking in Firestore so some slots become **Booked**.

---

## 3) Type A — Normal service test cases

### A1 — When screen opens, it should verify first
**Steps**
1. Open the app.
2. Go to any normal service (not package).
3. Go to the date & time screen.

**Expected**
1. You should see a loader/overlay like **“Checking availability…” / “Verifying…”**.
2. Slots should NOT show “Available” before verification finishes.
3. Continue button should be disabled until verification finishes.

### A2 — No “Available first then Booked later”
**Steps**
1. Select a date where you know some slots are booked.
2. Immediately look at the slots list.

**Expected**
1. Slots should not become “Available” first and then change to “Booked”.
2. While verifying, show “Verifying” (or loader) only.
3. After verifying finishes, booked slots should show “Booked”.

### A3 — User must NOT continue while verifying
**Steps**
1. Turn on slow network / airplane mode toggle quickly (anything to slow it).
2. Open normal service date & time screen.
3. Try tapping **Continue** immediately.

**Expected**
1. Continue does nothing.
2. Continue looks disabled.
3. Button text should say “Verifying availability…” or similar.

### A4 — Select start time (continuous block selection)
**Steps**
1. Pick a service that takes long time (for example 4 hours).
2. Select a date.
3. Tap a start time.

**Expected**
1. App should select multiple slots (a block).
2. If block is possible, Continue becomes enabled.

### A5 — Not enough continuous slots
**Steps**
1. Pick a date.
2. Tap a late start time where there are not enough remaining slots.

**Expected**
1. Show error like “Not enough continuous availability…”.
2. Continue stays disabled.

### A6 — Change date should re-check availability
**Steps**
1. Pick date A.
2. Select a start time.
3. Switch to date B.

**Expected**
1. It should start verifying again.
2. Continue should be disabled while verifying.

---

## 4) Type B — Package test cases

### B1 — Daily package: only next 7 days, only 1 day selectable
**Steps**
1. Open a package with unit = day (daily).
2. Look at the calendar.
3. Try selecting tomorrow.
4. Try selecting a date after 7 days.
5. Try selecting 2 different dates.

**Expected**
1. Tomorrow is selected by default.
2. You can select only 1 day.
3. Only dates from **tomorrow to next 7 days** are selectable.
4. Outside dates are disabled.

### B2 — Weekly package: must pick 7 days
**Steps**
1. Open a weekly package.
2. Select only 3 days.

**Expected**
1. Continue stays disabled.
2. UI should tell you to pick 7 days.

### B3 — Monthly package: must pick 30 days
**Steps**
1. Open a monthly package.
2. Select only 10 days.

**Expected**
1. Continue stays disabled.
2. UI should tell you to pick 30 days.

### B4 — Recurring package: must pick a time window
**Steps**
1. Pick required days (daily=1, weekly=7, monthly=30).
2. Don’t pick any time slot.

**Expected**
1. Continue stays disabled.
2. UI should say “Pick a time”.

---

## 5) Quick final checklist

1. Normal services: Continue disabled while verifying.
2. Normal services: No “Available” flash before verification.
3. Daily package: only 7-day window.
4. Weekly/monthly package: day count rules enforced.

