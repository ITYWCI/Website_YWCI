import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBL-HNBhP3mkb4Bp2BUDy4FbJl3M15MxSY",
    authDomain: "ywci-website.firebaseapp.com",
    projectId: "ywci-website",
    storageBucket: "ywci-website.firebasestorage.app",
    messagingSenderId: "718233699603",
    appId: "1:718233699603:web:fca95cafc62593fc04c6e6",
    measurementId: "G-3JJ5BD37DG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

export { auth, db, functions }; 