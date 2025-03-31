// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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
const analytics = getAuth(app);