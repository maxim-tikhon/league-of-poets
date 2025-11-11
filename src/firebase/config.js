import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAmexl6cKN5b6QQOpwQtLMSkZNFCbxbO9I",
  authDomain: "league-of-poets.firebaseapp.com",
  databaseURL: "https://league-of-poets-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "league-of-poets",
  storageBucket: "league-of-poets.firebasestorage.app",
  messagingSenderId: "325991269259",
  appId: "1:325991269259:web:d5233d4c66d0a79e6f658e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
export const database = getDatabase(app);

// Initialize Auth
export const auth = getAuth(app);

