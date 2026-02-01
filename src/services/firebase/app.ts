import { getApps, initializeApp } from '@react-native-firebase/app';

const getEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

const firebaseConfig = {
  apiKey: getEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
  appId: getEnv('EXPO_PUBLIC_FIREBASE_APP_ID'),
  messagingSenderId: getEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  projectId: getEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
};

export const ensureFirebaseApp = () => {
  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }
};
