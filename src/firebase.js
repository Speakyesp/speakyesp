import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import { getAuth } from "firebase/auth";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBoWWHe1Q25I1yEF3o-nf9ae5G9vgUOUfo",
  authDomain: "speaktest-19dd6.firebaseapp.com",
  databaseURL: "https://speaktest-19dd6-default-rtdb.firebaseio.com",
  projectId: "speaktest-19dd6",
  storageBucket: "speaktest-19dd6.appspot.com",
  messagingSenderId: "86205945597",
  appId: "1:86205945597:web:fde45e4e8c868643b99094",
  measurementId: "G-45LGLDX7CX"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Export Firebase authentication
export const auth = getAuth();

// Export the initialized Firebase app
export default app;
