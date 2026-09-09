import { initializeApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

console.log('[firebase] storageBucket configurado:', firebaseConfig.storageBucket);

const app = initializeApp(firebaseConfig);
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  console.log('[firebase] auth inicializada com persistência AsyncStorage.');
} catch (e) {
  if (e?.code === 'auth/already-initialized') {
    authInstance = getAuth(app);
    console.log('[firebase] auth já existente, reutilizando.');
  } else {
    console.error('[firebase] ERRO ao inicializar auth:', e?.code || '', e?.message || '');
    throw e;
  }
}
export const auth = authInstance;
export const db = getFirestore(app);
export const storage = firebaseConfig.storageBucket
  ? getStorage(app, `gs://${firebaseConfig.storageBucket}`)
  : getStorage(app);
console.log('[firebase] storage inicializado, bucket:', storage?._bucket?.bucket || 'desconhecido');
