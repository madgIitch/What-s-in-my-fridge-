import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

export const cleanupRecipeJobs = functions
  .region("europe-west1")
  .pubsub.schedule("every 24 hours")
  .onRun(async () => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const oldJobsSnap = await admin
      .firestore()
      .collectionGroup("recipe_jobs")
      .where("createdAt", "<", cutoff)
      .get();

    if (oldJobsSnap.empty) {
      return null;
    }

    const db = admin.firestore();
    const batchSize = 400;

    for (let i = 0; i < oldJobsSnap.docs.length; i += batchSize) {
      const batch = db.batch();
      const chunk = oldJobsSnap.docs.slice(i, i + batchSize);
      for (const doc of chunk) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }

    return null;
  });
