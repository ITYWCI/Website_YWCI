import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Function to save the last visited URL
function saveLastVisitedUrl() {
    if (!window.location.pathname.includes('admin_login.html') && window.location.pathname !== '/') {
        const currentPath = window.location.pathname;
        sessionStorage.setItem('lastVisitedUrl', currentPath);
        console.log('Saved URL:', currentPath);
    }
}

// Check auth state
function checkAuth() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            if (!user && !window.location.pathname.includes('admin_login.html')) {
                saveLastVisitedUrl();
                window.location.href = 'admin_login.html';
                reject('No user logged in');
                return;
            }
            
            if (user) {
                try {
                    const adminRef = collection(db, "admins");
                    const q = query(adminRef, where("email", "==", user.email));
                    const adminSnapshot = await getDocs(q);
                    
                    // Only check admin status if we're in the admin section
                    if (window.location.pathname.includes('/Admin/')) {
                        const adminDoc = adminSnapshot.docs.find(doc => {
                            const data = doc.data();
                            return data.userType === "admin" && data.email === user.email;
                        });

                        if (!adminDoc && !window.location.pathname.includes('admin_login.html')) {
                            window.location.href = 'admin_login.html';
                            reject('Not an admin user');
                            return;
                        }
                    }

                    resolve({ user, adminData: adminSnapshot.docs[0]?.data() });
                } catch (error) {
                    console.error("Error verifying admin:", error);
                    reject(error);
                }
            } else {
                resolve(null);
            }
        });
    });
}

// Handle logout
async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = 'admin_login.html';
    } catch (error) {
        console.error("Error signing out:", error);
        alert('Error signing out. Please try again.');
    }
}

// Initialize page with auth check
async function initializePage(pageSpecificInit) {
    try {
        const { user, adminData } = await checkAuth();
        if (!user) return;

        // Only populate admin data if we're in the admin section
        if (window.location.pathname.includes('/Admin/')) {
            populateAdminName(adminData);
        }

        // Run page-specific initialization if provided
        if (pageSpecificInit) {
            await pageSpecificInit(adminData);
        }

    } catch (error) {
        console.error("Error initializing page:", error);
        if (!window.location.pathname.includes('admin_login.html')) {
            window.location.href = 'admin_login.html';
        }
    }
}

// Populate admin name
function populateAdminName(adminData) {
    try {
        const adminNameElement = document.querySelector('.mr-2.d-none.d-lg-inline.text-gray-600.small');
        const adminInitialsElement = document.querySelector('.initials');
        
        if (adminNameElement && adminData) {
            adminNameElement.textContent = adminData.username || 'Admin';
        }

        if (adminInitialsElement && adminData) {
            adminInitialsElement.textContent = getInitialsFromUsername(adminData.username);
        }
    } catch (error) {
        console.error("Error populating admin name:", error);
    }
}

function getInitialsFromUsername(username) {
    if (!username) return 'A';
    return username.charAt(0).toUpperCase();
}

// Add event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.querySelector('.logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
});

export { 
    initializePage, 
    handleLogout, 
    checkAuth, 
    populateAdminName,
    getInitialsFromUsername
}; 