// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, onIdTokenChanged, User } from 'firebase/auth/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useRouter} from 'expo-router'

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBOYDjgY1Q7E3oSDn64A2gNhkphpLCs0gI",
  authDomain: "med-app-b4426.firebaseapp.com",
  projectId: "med-app-b4426",
  storageBucket: "med-app-b4426.firebasestorage.app",
  messagingSenderId: "1038827148384",
  appId: "1:1038827148384:web:60a769b9e9d08b859adf05",
  measurementId: "G-B6L5QY947J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

onIdTokenChanged(auth, async (user: User | null) => {
  try {
    if (user) {
      const token = await user?.getIdToken();
      await AsyncStorage.setItem('userToken', token!);
    } else {
      await AsyncStorage.removeItem('userToken');
    }
  } catch (error) {
    console.error('Error in onIdTokenChanged:', error);
  }
});

export { app, auth };

