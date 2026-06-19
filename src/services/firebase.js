import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';


const firebaseConfig = {
    apiKey: "AIzaSyCNDiCv5ofDU-84l9neoHARyj5PfZTwgnI",
    authDomain: "companhia-amigo.firebaseapp.com",
    projectId: "companhia-amigo",
    storageBucket: "companhia-amigo.firebasestorage.app",
    messagingSenderId: "17940102853",
    appId: "1:17940102853:web:5822d16c1c90de97d87aac"
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);