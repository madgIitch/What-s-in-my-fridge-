import * as admin from "firebase-admin";  
  
interface CacheEntry {  
  recipes: any[];  
  timestamp: admin.firestore.Timestamp;  
  inventoryHash: string; // hash del inventario para invalidar caché  
}  
  
export async function getCachedRecipes(  
  userId: string,  
  inventoryHash: string  
): Promise<any[] | null> {  
  const cacheRef = admin  
    .firestore()  
    .collection("users")  
    .doc(userId)  
    .collection("recipeCache")  
    .doc(inventoryHash);  
  
  const cacheDoc = await cacheRef.get();  
    
  if (!cacheDoc.exists) return null;  
  
  const data = cacheDoc.data() as CacheEntry;  
  const now = admin.firestore.Timestamp.now();  
  const ageHours = (now.seconds - data.timestamp.seconds) / 3600;  
  
  // TTL de 24 horas  
  if (ageHours > 24) {  
    await cacheRef.delete();  
    return null;  
  }  
  
  return data.recipes;  
}  
  
export async function setCachedRecipes(  
  userId: string,  
  inventoryHash: string,  
  recipes: any[]  
): Promise<void> {  
  const cacheRef = admin  
    .firestore()  
    .collection("users")  
    .doc(userId)  
    .collection("recipeCache")  
    .doc(inventoryHash);  
  
  await cacheRef.set({  
    recipes,  
    timestamp: admin.firestore.FieldValue.serverTimestamp(),  
    inventoryHash,  
  });  
}  
  
// Generar hash del inventario para usar como cacheKey  
export function generateInventoryHash(items: string[]): string {  
  return items.sort().join(",");  
}
