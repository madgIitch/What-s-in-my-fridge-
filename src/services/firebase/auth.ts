import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { ensureFirebaseApp } from './app';
import { useAuthStore } from '../../stores/useAuthStore';
import { usePreferencesStore } from '../../stores/usePreferencesStore';

/**
 * Firebase Authentication Service
 * Equivalent to Firebase.auth usage in Android app
 */
ensureFirebaseApp();

/**
 * Sign in with email and password
 */
export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    useAuthStore.getState().setUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    });

    // Load cooking preferences from Firestore
    try {
      await usePreferencesStore.getState().loadCookingPreferencesFromFirestore(user.uid);
    } catch (error) {
      console.error('Error loading preferences after sign in:', error);
    }

    return user;
  } catch (error: any) {
    let errorMessage = 'Error al iniciar sesión';

    if (error.code === 'auth/invalid-email') {
      errorMessage = 'Email inválido';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'Usuario deshabilitado';
    } else if (error.code === 'auth/user-not-found') {
      errorMessage = 'Usuario no encontrado';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Contraseña incorrecta';
    }

    throw new Error(errorMessage);
  }
};

/**
 * Sign up with email and password
 */
export const signUp = async (email: string, password: string) => {
  try {
    const userCredential = await auth().createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    useAuthStore.getState().setUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    });

    // Save initial cooking preferences to Firestore
    try {
      const { cookingTime, availableUtensils } = usePreferencesStore.getState();
      const { syncCookingPreferencesToFirestore } = await import('./firestore');
      await syncCookingPreferencesToFirestore(cookingTime, availableUtensils);
    } catch (error) {
      console.error('Error saving initial preferences after sign up:', error);
    }

    return user;
  } catch (error: any) {
    let errorMessage = 'Error al crear cuenta';

    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'El email ya está en uso';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Email inválido';
    } else if (error.code === 'auth/operation-not-allowed') {
      errorMessage = 'Operación no permitida';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Contraseña demasiado débil';
    }

    throw new Error(errorMessage);
  }
};

/**
 * Sign out current user
 */
export const signOut = async () => {
  try {
    await auth().signOut();
    useAuthStore.getState().signOut();
  } catch (error: any) {
    throw new Error('Error al cerrar sesión');
  }
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email: string) => {
  try {
    await auth().sendPasswordResetEmail(email);
  } catch (error: any) {
    let errorMessage = 'Error al enviar email de recuperación';

    if (error.code === 'auth/invalid-email') {
      errorMessage = 'Email inválido';
    } else if (error.code === 'auth/user-not-found') {
      errorMessage = 'Usuario no encontrado';
    }

    throw new Error(errorMessage);
  }
};

/**
 * Listen to auth state changes
 */
export const onAuthStateChanged = (
  callback: (user: FirebaseAuthTypes.User | null) => void
) => {
  return auth().onAuthStateChanged(callback);
};

/**
 * Get current user
 */
export const getCurrentUser = () => {
  return auth().currentUser;
};
