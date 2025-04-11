import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

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

//Function to save the last visited URL
function saveLastVisitedUrl() {
    // Don't save login page or empty paths
    if (!window.location.pathname.includes('login.html') && window.location.pathname !== '/') {
        const currentPath = window.location.pathname;
        sessionStorage.setItem('lastVisitedUrl', currentPath);
        console.log('Saved URL:', currentPath); // Debug log
    }
}

//Check auth state
function checkAuth() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (!user && !window.location.pathname.includes('login.html')) {
                // Save the current URL before redirecting to login
                saveLastVisitedUrl();
                window.location.href = 'login.html';
                reject('No user logged in');
            }
            resolve(user);
        }, reject);
    });
}

// Get employer data
async function getEmployerData(email) {
    try {
        const employersRef = collection(db, "employers");
        const q = query(employersRef, where("email", "==", email.toLowerCase()));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].data();
        }
        console.log("No user data found for email:", email);
        return null;
    } catch (error) {
        console.error("Error fetching employer data:", error);
        return null;
    }
}

// Populate dashboard user
function populateDashboardUser(userData) {
    try {
        const userNameElement = document.querySelector('.mr-2.d-none.d-lg-inline.text-gray-600.small');
        if (userNameElement && userData) {
            userNameElement.textContent = userData.username || 'User';
        }
    } catch (error) {
        console.error("Error populating dashboard user:", error);
    }
}

// Handle logout
async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Error signing out:", error);
        alert('Error signing out. Please try again.');
    }
}

// Initialize page with auth check
async function initializePage(pageSpecificInit) {
    try {
        // Check authentication first
        const user = await checkAuth();
        if (!user) return;

        // Get and populate user data
        const userData = await getEmployerData(user.email);
        if (userData) {
            populateDashboardUser(userData);
        }

        // Run page-specific initialization if provided
        if (pageSpecificInit) {
            await pageSpecificInit();
        }

    } catch (error) {
        console.error("Error initializing page:", error);
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
    }
}

// Add logout listener
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.querySelector('.logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
});

// Add event listener for tab/window close
window.addEventListener('beforeunload', function() {
    // Only clear if we're not on the login page
    if (!window.location.pathname.includes('login.html')) {
        // Save the current URL before clearing
        saveLastVisitedUrl();
        // Clear the session storage after a small delay
        setTimeout(() => {
            sessionStorage.clear();
        }, 0);
    }
});

export { 
    initializePage, 
    handleLogout, 
    auth, 
    db, 
    checkAuth, 
    getEmployerData, 
    populateDashboardUser,
    saveLastVisitedUrl
};