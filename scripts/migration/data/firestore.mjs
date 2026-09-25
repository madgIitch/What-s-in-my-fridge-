import { createRequire } from 'node:module';
import { SOURCE_PROJECT } from './snapshot.mjs';

export async function createFirestoreAdapter(projectId) {
  if (projectId !== SOURCE_PROJECT) throw new Error('SOURCE_PROJECT_REJECTED');
  const require = createRequire(import.meta.url);
  let app, firestore, storage;
  try {
    app = require('firebase-admin/app');
    firestore = require('firebase-admin/firestore');
    storage = require('firebase-admin/storage');
  } catch { throw new Error('FIREBASE_ADMIN_NOT_INSTALLED'); }
  const instance = app.initializeApp({ credential: app.applicationDefault(), projectId }, 'migration-read-only');
  const db = firestore.getFirestore(instance);
  return {
    async listUsers() {
      const docs = await db.collection('users').listDocuments();
      return docs.map(doc => doc.id);
    },
    async listDocuments(uid, collection, after, limit) {
      if (collection === 'cookingPreferences') {
        if (after) return [];
        const user = await db.collection('users').doc(uid).get();
        const data = user.data()?.cookingPreferences;
        return data ? [{ path: `users/${uid}/cookingPreferences/status`, data, updateTime: user.updateTime?.toDate().toISOString() ?? null }] : [];
      }
      const FieldPath = firestore.FieldPath;
      let query = db.collection('users').doc(uid).collection(collection).orderBy(FieldPath.documentId()).limit(limit);
      if (after) query = query.startAfter(after.split('/').at(-1));
      const page = await query.get();
      return page.docs.map(doc => ({ path: doc.ref.path, data: doc.data(), updateTime: doc.updateTime?.toDate().toISOString() ?? null }));
    },
    async *listStorageObjects(bucketName, prefix) {
      if (!['what-s-in-my-fridge-a2a07.appspot.com', 'what-s-in-my-fridge-a2a07.firebasestorage.app'].includes(bucketName)) throw new Error('SOURCE_BUCKET_REJECTED');
      const bucket = storage.getStorage(instance).bucket(bucketName);
      const [files] = await bucket.getFiles({ prefix, autoPaginate: true });
      for (const file of files) yield file.name;
    },
  };
}
