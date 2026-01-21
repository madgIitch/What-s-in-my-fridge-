import TextRecognition from 'react-native-text-recognition';
import storage from '@react-native-firebase/storage';
import { parseReceipt as parseReceiptCloud } from '../firebase/functions';

/**
 * OCR Service - Text recognition from images
 * Supports both local (ML Kit) and cloud (Vision API) processing
 */

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
 */
export const recognizeTextLocal = async (imageUri: string): Promise<OCRResult> => {
  try {
    console.log('Starting local OCR with ML Kit...');

    const result = await TextRecognition.recognize(imageUri);

    // Combine all text blocks
    const fullText = result.map((block) => block.text).join('\n');

    console.log('Local OCR completed. Text length:', fullText.length);

    return {
      text: fullText,
      blocks: result.map((block) => ({
        text: block.text,
        boundingBox: block.boundingBox,
      })),
    };
  } catch (error: any) {
    console.error('Error in local OCR:', error);
    throw new Error('Error al procesar la imagen con OCR local: ' + error.message);
  }
};

/**
 * Recognize text using Cloud Vision API (cloud processing)
 * Fallback option if local OCR fails or for better accuracy
 */
export const recognizeTextCloud = async (imageUri: string): Promise<OCRResult> => {
  try {
    console.log('Starting cloud OCR with Vision API...');

    // Upload image to Firebase Storage
    const timestamp = Date.now();
    const filename = `receipts/${timestamp}_receipt.jpg`;
    const reference = storage().ref(filename);

    console.log('Uploading image to Firebase Storage...');
    await reference.putFile(imageUri);

    // Get download URL
    const downloadURL = await reference.getDownloadURL();
    console.log('Image uploaded. URL:', downloadURL);

    // Call Cloud Function to process with Vision API
    const text = await parseReceiptCloud(downloadURL);

    console.log('Cloud OCR completed. Text length:', text.length);

    return {
      text,
    };
  } catch (error: any) {
    console.error('Error in cloud OCR:', error);
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
  if (preferCloud) {
    console.log('Using cloud OCR (user preference)');
    return recognizeTextCloud(imageUri);
  }

  try {
    // Try local OCR first
    console.log('Attempting local OCR...');
    return await recognizeTextLocal(imageUri);
  } catch (localError) {
    console.warn('Local OCR failed, falling back to cloud:', localError);

    try {
      // Fallback to cloud OCR
      return await recognizeTextCloud(imageUri);
    } catch (cloudError) {
      console.error('Both local and cloud OCR failed');
      throw new Error('No se pudo procesar la imagen. Intenta con otra foto más clara.');
    }
  }
};
