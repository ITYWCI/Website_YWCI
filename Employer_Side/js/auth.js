// Import Firebase modules from server-provided SDK
let auth;
let db;

// Function to initialize Firebase from server
async function initializeFirebase() {
    try {
        const response = await fetch('/api/firebase-sdk');
        const data = await response.json();
        
        // Dynamically import Firebase modules
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js");
        const { getAuth, onAuthStateChanged, signOut } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js");
        const { getFirestore } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");
        
        // Initialize Firebase with config from server
        const app = initializeApp(data.config);
        auth = getAuth(app);
        db = getFirestore(app);
        
        console.log('Firebase initialized from server config');
        return { auth, db };
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        throw error;
    }
}

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
async function checkAuth() {
    try {
        // Make sure Firebase auth is initialized
        if (!auth) {
            await initializeFirebase();
        }
        
        // Dynamically import the auth functions we need
        const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js");
        
        return new Promise((resolve, reject) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                unsubscribe();
                if (!user && !window.location.pathname.includes('login.html')) {
                    // Save the current URL before redirecting to login
                    saveLastVisitedUrl();
                    window.location.href = '/Employer_Side/login.html';
                    reject('No user logged in');
                }
                resolve(user);
            }, reject);
        });
    } catch (error) {
        console.error("Error in checkAuth:", error);
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = '/Employer_Side/login.html';
        }
        throw error;
    }
}

// Get employer data
async function getEmployerData(email) {
    try {
        // Make sure Firebase is initialized
        if (!auth || !db) {
            await initializeFirebase();
        }
        
        // Use the server endpoint to get employer profile
        const response = await fetch('/api/employer/profile', {
            headers: {
                'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch employer data: ${response.statusText}`);
        }
        
        const userData = await response.json();
        return userData;
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
        // Dynamically import the auth functions we need
        const { signOut } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js");
        
        await signOut(auth);
        window.location.href = '/Employer_Side/login.html';
    } catch (error) {
        console.error("Error signing out:", error);
        alert('Error signing out. Please try again.');
    }
}

// Initialize page with auth check
async function initializePage(pageSpecificInit) {
    try {
        // Initialize Firebase first
        if (!auth || !db) {
            await initializeFirebase();
        }
        
        // Check authentication
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
            window.location.href = '/Employer_Side/login.html';
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

// Initialize Firebase when this module is imported
initializeFirebase().catch(error => {
    console.error('Failed to initialize Firebase on module import:', error);
});

export { 
    initializePage, 
    handleLogout, 
    auth, 
    db, 
    checkAuth, 
    getEmployerData, 
    populateDashboardUser,
    saveLastVisitedUrl,
    initializeFirebase
};