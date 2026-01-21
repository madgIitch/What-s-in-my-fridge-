import { getApps, initializeApp } from '@react-native-firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyD9WEvA5By48UY1cuRvBeJkpZDwdm42-mA',
  appId: '1:534730978435:android:d94b7c8acb3aefa01f57b6',
  messagingSenderId: '534730978435',
  projectId: 'what-s-in-my-fridge-a2a07',
  storageBucket: 'what-s-in-my-fridge-a2a07.firebasestorage.app',
};

export const ensureFirebaseApp = () => {
  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }
};
