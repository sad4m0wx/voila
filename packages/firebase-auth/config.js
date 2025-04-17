// shared/firebase-auth/config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Initialize Firebase - use environment variables in your actual apps
// This will be initialized in each app that uses these utilities
export function initializeFirebase(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app);
  
  return { app, auth, db, functions };
}







