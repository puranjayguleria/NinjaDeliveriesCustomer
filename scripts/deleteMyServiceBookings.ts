/**
 * Delete MY service bookings (and related service_payments) from Firestore.
 *
 * Why this script exists:
 * - Useful for clearing test data when plan bookings created many occurrences.
 *
 * Safety:
 * - Defaults to dry-run.
 * - Requires explicit CONFIRM_DELETE=YES.
 *
 * Usage (PowerShell):
 *   $env:FIREBASE_PROJECT_ID="ninjadeliveries-91007"
 *   $env:FIREBASE_SERVICE_ACCOUNT="C:\\path\\to\\serviceAccount.json"
 *   $env:CUSTOMER_UID="<uid>"
 *   $env:DRY_RUN="true"   # or "false"
 *   $env:CONFIRM_DELETE="YES"
 *   npx tsx scripts/deleteMyServiceBookings.ts
 */

// NOTE: This script is Node-only (not part of the React Native bundle).
// We load firebase-admin dynamically so the app build/lint doesn't require it.
let admin: any;

type DeletePlan = {
  uid: string;
  dryRun: boolean;
  bookingIds: string[];
  paymentIds: string[];
};

const projectId = process.env.FIREBASE_PROJECT_ID || "";
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || "";
const uid = process.env.CUSTOMER_UID || "";
const dryRun = (process.env.DRY_RUN || "true").toLowerCase() !== "false";
const confirm = (process.env.CONFIRM_DELETE || "").toUpperCase() === "YES";

function must(v: string, name: string) {
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function initAdmin() {
  // Dynamic imports avoid TS/Metro complaining in RN context.
  admin = await import("firebase-admin");

  // Auth modes:
  // 1) Service account JSON (FIREBASE_SERVICE_ACCOUNT) - recommended
  // 2) ADC (Application Default Credentials) via gcloud - set USE_ADC=true
  const useAdc = (process.env.USE_ADC || "false").toLowerCase() === "true";

  if (!projectId) {
    throw new Error("Missing env FIREBASE_PROJECT_ID");
  }

  if (admin.apps.length === 0) {
    if (serviceAccountPath) {
      const serviceAccount = await import(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
    } else if (useAdc) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
    } else {
      throw new Error(
        "Missing env FIREBASE_SERVICE_ACCOUNT. Either set FIREBASE_SERVICE_ACCOUNT to a service account JSON path OR set USE_ADC=true to use gcloud Application Default Credentials."
      );
    }
  }
}

async function buildDeletePlan(db: any): Promise<DeletePlan> {
  const customerUid = must(uid, "CUSTOMER_UID");

  const bookingsSnap = await db
    .collection("service_bookings")
    .where("customerId", "==", customerUid)
    .get();

  const bookingIds = bookingsSnap.docs.map((d: any) => d.id);

  // Related payments: best-effort via bookingId.
  // If your schema uses a different field, adjust here.
  const paymentIds: string[] = [];
  if (bookingIds.length > 0) {
    // Firestore IN query limit is 30. Chunk.
    for (let i = 0; i < bookingIds.length; i += 30) {
      const chunk = bookingIds.slice(i, i + 30);
      const paySnap = await db
        .collection("service_payments")
        .where("bookingId", "in", chunk)
        .get();
      paymentIds.push(...paySnap.docs.map((d: any) => d.id));
    }
  }

  return { uid: customerUid, dryRun, bookingIds, paymentIds };
}

async function deleteDocsInBatches(db: any, collection: string, ids: string[]) {
  const chunkSize = 400; // keep below 500 write limit
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const batch = db.batch();
    for (const id of chunk) batch.delete(db.collection(collection).doc(id));
    await batch.commit();
  }
}

async function main() {
  await initAdmin();
  const db = admin.firestore();

  const plan = await buildDeletePlan(db);

  console.log("\n🧹 Delete plan summary");
  console.log(JSON.stringify({
    uid: plan.uid,
    dryRun: plan.dryRun,
    bookingsToDelete: plan.bookingIds.length,
    paymentsToDelete: plan.paymentIds.length,
  }, null, 2));

  if (plan.dryRun) {
    console.log("\n✅ DRY_RUN=true, no deletions performed.");
    return;
  }

  if (!confirm) {
    throw new Error("Refusing to delete. Set CONFIRM_DELETE=YES to proceed.");
  }

  // Delete payments first (so we don't orphan payment docs pointing at missing bookings)
  if (plan.paymentIds.length > 0) {
    console.log(`\nDeleting ${plan.paymentIds.length} docs from service_payments...`);
    await deleteDocsInBatches(db, "service_payments", plan.paymentIds);
  }

  if (plan.bookingIds.length > 0) {
    console.log(`\nDeleting ${plan.bookingIds.length} docs from service_bookings...`);
    await deleteDocsInBatches(db, "service_bookings", plan.bookingIds);
  }

  console.log("\n✅ Done.");
}

main().catch((e) => {
  console.error("❌ Script failed:", e);
  process.exitCode = 1;
});
