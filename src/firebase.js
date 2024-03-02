import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import { getAuth } from "firebase/auth";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCiSF3tS1aexfPtGGr9OAWIYBK4OLRehoI",
    authDomain: "chatus-6b5b6.firebaseapp.com",
    databaseURL: "https://chatus-6b5b6-default-rtdb.firebaseio.com",
    projectId: "chatus-6b5b6",
    storageBucket: "chatus-6b5b6.appspot.com",
    messagingSenderId: "673849113997",
    appId: "1:673849113997:web:7251b7d022e314a63691c4",
    measurementId: "G-556CMZLY10"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Export Firebase authentication
export const auth = getAuth();

// Export the initialized Firebase app
export default app;
