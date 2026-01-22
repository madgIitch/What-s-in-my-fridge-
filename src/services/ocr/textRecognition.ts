import TextRecognition from 'react-native-text-recognition';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';
import { ensureFirebaseApp } from '../firebase/app';

/**
 * OCR Service - Text recognition from images
 * Supports both local (ML Kit) and cloud (Vision API) processing
 */
ensureFirebaseApp();

export interface OCRResult {
  text: string;
  confidence?: number;
  blocks?: TextBlock[];
}

export interface TextBlock {
  text: string;
  boundingBox?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

/**
 * Recognize text from image using ML Kit (local processing)
 * This is the preferred method as it's faster and doesn't require internet
 *
 * Note: ML Kit may not work well on emulators without Google Play Services
 */
export const recognizeTextLocal = async (imageUri: string): Promise<OCRResult> => {
  try {
    console.log('📸 Starting local OCR with ML Kit...');
    console.log('📸 Image URI:', imageUri);

    // Validate image URI
    if (!imageUri || typeof imageUri !== 'string') {
      throw new Error('URI de imagen inválida');
    }

    const result = await TextRecognition.recognize(imageUri);

    console.log('📸 ML Kit returned:', result?.length || 0, 'blocks');

    // Check if result is valid
    if (!result || !Array.isArray(result)) {
      console.warn('📸 ML Kit returned invalid result:', result);
      throw new Error('ML Kit no devolvió resultados válidos');
    }

    // Debug: Log each block
    result.forEach((block, index) => {
      const blockText = block.text || '';
      console.log(`📸 Block ${index}: "${blockText.substring(0, 50)}..." (${blockText.length} chars)`);
    });

    // Filter out empty blocks and combine text
    const nonEmptyBlocks = result.filter((block) => block.text && block.text.trim().length > 0);
    const fullText = nonEmptyBlocks.map((block) => block.text.trim()).join('\n');

    console.log('📸 Non-empty blocks:', nonEmptyBlocks.length);
    console.log('✅ Local OCR completed. Text length:', fullText.length);
    if (fullText.length > 0) {
      console.log('📸 First 200 chars:', fullText.substring(0, 200));
    } else {
      console.warn('📸 All blocks were empty or whitespace-only');
    }

    return {
      text: fullText,
      blocks: result.map((block) => ({
        text: block.text,
        boundingBox: block.boundingBox,
      })),
    };
  } catch (error: any) {
    console.error('❌ Error in local OCR:', error);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    throw new Error('Error al procesar la imagen con OCR local: ' + error.message);
  }
};

/**
 * Recognize text using Cloud Vision API (cloud processing)
 * Fallback option if local OCR fails or for better accuracy
 */
export const recognizeTextCloud = async (imageUri: string): Promise<OCRResult> => {
  try {
    console.log('☁️ Starting cloud OCR with Vision API...');

    // Get current user for folder structure
    const user = auth().currentUser;
    const userId = user?.uid || 'anonymous';

    // Upload image to Firebase Storage
    const timestamp = Date.now();
    const filename = `receipts/${userId}/${timestamp}_receipt.jpg`;
    const reference = storage().ref(filename);

    console.log('☁️ Uploading image to Firebase Storage...', filename);
    await reference.putFile(imageUri);

    // Get download URL
    const downloadURL = await reference.getDownloadURL();
    console.log('☁️ Image uploaded. URL:', downloadURL.substring(0, 100) + '...');

    // Call Cloud Function to process with Vision API
    const parseReceiptCallable = functions().httpsCallable('parseReceipt');

    console.log('☁️ Calling parseReceipt Cloud Function...');
    const result = await parseReceiptCallable({ imageUri: downloadURL });

    if (!result.data || !result.data.draft) {
      throw new Error('Cloud Function no devolvió datos válidos');
    }

    const rawText = result.data.draft.rawText || '';
    console.log('✅ Cloud OCR completed. Text length:', rawText.length);

    if (rawText.length > 0) {
      console.log('☁️ First 200 chars:', rawText.substring(0, 200));
    }

    return {
      text: rawText,
    };
  } catch (error: any) {
    console.error('❌ Error in cloud OCR:', error);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    throw new Error('Error al procesar la imagen con OCR en la nube: ' + error.message);
  }
};

/**
 * Auto-select best OCR method
 * Tries local first, falls back to cloud if needed
 */
export const recognizeText = async (
  imageUri: string,
  preferCloud: boolean = false
): Promise<OCRResult> => {
  console.log('🔍 recognizeText called with URI:', imageUri?.substring(0, 50) + '...');

  if (preferCloud) {
    console.log('🔍 Using cloud OCR (user preference)');
    return recognizeTextCloud(imageUri);
  }

  let localResult: OCRResult | null = null;
  let localError: any = null;

  // Try local OCR first
  try {
    console.log('🔍 Attempting local OCR (ML Kit)...');
    localResult = await recognizeTextLocal(imageUri);

    // Check if local OCR returned actual text
    if (localResult.text && localResult.text.trim().length > 0) {
      console.log('✅ Local OCR succeeded with', localResult.text.length, 'chars');
      return localResult;
    } else {
      console.warn('⚠️ Local OCR returned empty text, trying cloud...');
      localError = new Error('ML Kit devolvió texto vacío');
    }
  } catch (error: any) {
    console.warn('⚠️ Local OCR failed:', error.message);
    localError = error;
  }

  // Fallback to cloud OCR
  try {
    console.log('🔍 Falling back to cloud OCR (Vision API)...');
    const cloudResult = await recognizeTextCloud(imageUri);

    if (cloudResult.text && cloudResult.text.trim().length > 0) {
      console.log('✅ Cloud OCR succeeded with', cloudResult.text.length, 'chars');
      return cloudResult;
    } else {
      console.warn('⚠️ Cloud OCR also returned empty text');
    }
  } catch (cloudError: any) {
    console.error('❌ Cloud OCR also failed:', cloudError.message);
  }

  // Both failed
  console.error('❌ Both local and cloud OCR failed or returned empty');
  throw new Error(
    'No se pudo extraer texto de la imagen. ' +
    'Asegúrate de que el recibo esté bien iluminado y sin borrosidad. ' +
    (localError ? `(Error: ${localError.message})` : '')
  );
};
