import firestore from '@react-native-firebase/firestore';
import { ensureFirebaseApp } from './app';
import { database, collections } from '../../database';
import FoodItem from '../../database/models/FoodItem';
import ParsedDraft from '../../database/models/ParsedDraft';
import { useAuthStore } from '../../stores/useAuthStore';

/**
 * Firestore Sync Service
 * Equivalent to InventoryRepository Firestore sync from Android app
 */
ensureFirebaseApp();

/**
 * Sync a food item to Firestore
 */
export const syncToFirestore = async (item: FoodItem) => {
  const userId = useAuthStore.getState().user?.uid;
  if (!userId) {
    console.warn('No user logged in, skipping Firestore sync');
    return;
  }

  try {
    await firestore()
      .collection('users')
      .doc(userId)
      .collection('inventory')
      .doc(item.id)
      .set({
        name: item.name,
        normalizedName: item.normalizedName || null,
        expiryDate: item.expiryDate,
        category: item.category,
        quantity: item.quantity,
        notes: item.notes,
        unit: item.unit,
        addedAt: item.addedAt,
        source: item.source,
      });
  } catch (error) {
    console.error('Error syncing to Firestore:', error);
    throw error;
  }
};

/**
 * Delete a food item from Firestore
 */
export const deleteFromFirestore = async (itemId: string) => {
  const userId = useAuthStore.getState().user?.uid;
  if (!userId) {
    console.warn('No user logged in, skipping Firestore delete');
    return;
  }

  try {
    await firestore()
      .collection('users')
      .doc(userId)
      .collection('inventory')
      .doc(itemId)
      .delete();
  } catch (error) {
    console.error('Error deleting from Firestore:', error);
    throw error;
  }
};

/**
 * Start bidirectional Firestore sync
 * Equivalent to InventoryRepository.startFirestoreSync()
 */
export const startFirestoreSync = (userId: string) => {
  console.log('Starting Firestore sync for user:', userId);

  const unsubscribe = firestore()
    .collection('users')
    .doc(userId)
    .collection('inventory')
    .onSnapshot(
      async (snapshot) => {
        console.log('Firestore snapshot received:', snapshot.docChanges().length, 'changes');

        await database.write(async () => {
          for (const change of snapshot.docChanges()) {
            const data = change.doc.data();
            const itemId = change.doc.id;
            const expiryDate =
              typeof data.expiryDate === 'number'
                ? data.expiryDate
                : typeof data.expiryAt === 'number'
                  ? data.expiryAt
                  : undefined;

            if (change.type === 'added' || change.type === 'modified') {
              try {
                // Check if item already exists locally
                const existingItem = await collections.foodItems
                  .find(itemId)
                  .catch(() => null);

                if (existingItem) {
                  // Update existing item
                  await existingItem.update(() => {
                    if (data.name !== undefined) existingItem.name = data.name;
                    if (data.normalizedName !== undefined) {
                      existingItem.normalizedName = data.normalizedName || undefined;
                    }
                    if (expiryDate !== undefined) existingItem.expiryDate = expiryDate;
                    if (data.category !== undefined) existingItem.category = data.category;
                    if (data.quantity !== undefined) existingItem.quantity = data.quantity;
                    if (data.notes !== undefined) existingItem.notes = data.notes;
                    if (data.unit !== undefined) existingItem.unit = data.unit;
                    if (data.addedAt !== undefined) existingItem.addedAt = data.addedAt;
                    if (data.source !== undefined) existingItem.source = data.source;
                  });
                  console.log('Updated item from Firestore:', itemId);
                } else {
                  // Create new item
                  await collections.foodItems.create((item) => {
                    if (expiryDate === undefined) {
                      console.warn('Missing expiryDate in Firestore item, defaulting to now:', itemId);
                    }
                    (item as any)._raw.id = itemId;
                    item.name = data.name;
                    item.normalizedName = data.normalizedName || undefined;
                    item.expiryDate = expiryDate ?? Date.now();
                    item.category = data.category;
                    item.quantity = data.quantity;
                    item.notes = data.notes;
                    item.unit = data.unit;
                    item.addedAt = data.addedAt ?? Date.now();
                    item.source = data.source;
                  });
                  console.log('Created item from Firestore:', itemId);
                }
              } catch (error) {
                console.error('Error syncing item from Firestore:', error);
              }
            }

            if (change.type === 'removed') {
              try {
                const item = await collections.foodItems
                  .find(itemId)
                  .catch(() => null);

                if (item) {
                  await item.destroyPermanently();
                  console.log('Deleted item from local DB (Firestore removal):', itemId);
                }
              } catch (error) {
                console.error('Error deleting item from local DB:', error);
              }
            }
          }
        });
      },
      (error) => {
        console.error('Firestore sync error:', error);
      }
    );

  return unsubscribe;
};

/**
 * Save a parsed draft to Firestore (for history)
 * Equivalent to InventoryRepository.saveDraftToFirestore()
 */
export const saveDraftToFirestore = async (draft: ParsedDraft) => {
  const userId = useAuthStore.getState().user?.uid;
  if (!userId) {
    console.warn('No user logged in, skipping draft sync');
    return;
  }

  try {
    await firestore()
      .collection('users')
      .doc(userId)
      .collection('scans')
      .doc(draft.id)
      .set({
        rawText: draft.rawText,
        timestamp: draft.timestamp,
        merchant: draft.merchant,
        purchaseDate: draft.purchaseDate,
        currency: draft.currency,
        total: draft.total,
        linesJson: draft.linesJson,
        unrecognizedLines: draft.unrecognizedLines,
        confirmed: draft.confirmed,
      });
  } catch (error) {
    console.error('Error saving draft to Firestore:', error);
    throw error;
  }
};

/**
 * Fetch all items from Firestore (manual sync)
 */
export const fetchInventoryFromFirestore = async (userId: string) => {
  try {
    const snapshot = await firestore()
      .collection('users')
      .doc(userId)
      .collection('inventory')
      .get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return items;
  } catch (error) {
    console.error('Error fetching inventory from Firestore:', error);
    throw error;
  }
};

/**
 * Sync cooking preferences to Firestore
 */
export const syncCookingPreferencesToFirestore = async (
  cookingTime: number,
  availableUtensils: string[]
) => {
  const userId = useAuthStore.getState().user?.uid;
  if (!userId) {
    console.warn('No user logged in, skipping preferences sync');
    return;
  }

  try {
    await firestore()
      .collection('users')
      .doc(userId)
      .set(
        {
          cookingPreferences: {
            cookingTime,
            availableUtensils,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
    console.log('Cooking preferences synced to Firestore');
  } catch (error) {
    console.error('Error syncing preferences to Firestore:', error);
    throw error;
  }
};

/**
 * Fetch cooking preferences from Firestore
 */
export const fetchCookingPreferencesFromFirestore = async (userId: string) => {
  try {
    const doc = await firestore()
      .collection('users')
      .doc(userId)
      .get();

    const data = doc.data();
    if (data?.cookingPreferences) {
      return {
        cookingTime: data.cookingPreferences.cookingTime,
        availableUtensils: data.cookingPreferences.availableUtensils,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching preferences from Firestore:', error);
    throw error;
  }
};
