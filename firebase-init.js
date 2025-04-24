import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Initialize Firebase directly with config
const firebaseConfig = {
    apiKey: "AIzaSyBL-HNBhP3mkb4Bp2BUDy4FbJl3M15MxSY",
    authDomain: "ywci-website.firebaseapp.com",
    projectId: "ywci-website",
    storageBucket: "ywci-website.firebasestorage.app",
    messagingSenderId: "718233699603",
    appId: "1:718233699603:web:fca95cafc62593fc04c6e6",
    measurementId: "G-3JJ5BD37DG"
};

console.log('Initializing Firebase...');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
console.log('Firebase initialized successfully');

export { app, auth, db, storage };
