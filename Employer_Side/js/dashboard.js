import {
    initializePage,
    db } from './auth.js';
import { getInitials, createInitialsAvatar, populateUserNav } from './utils.js';

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

// Initialize Firebase Auth
const auth = getAuth();

function hideLoader() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.classList.add('hidden');
    }
}

async function initializeDashboard() {
    try {
        // Wait for all data loading functions to complete
        await Promise.all([
            getTotalApplications(),
            getActiveJobs(),
            countHiredApplicants(),
            countPendingApplications()
            // Add any other async operations here
        ]);
        
        // Hide loader after all data is loaded
        hideLoader();
    } catch (error) {
        console.error("Error initializing dashboard:", error);
        hideLoader(); // Hide loader even if there's an error
    }
}

// Update the auth state change handler
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userData = await getEmployerData(user.email);
            if (userData) {
                populateDashboardUser(userData);
                await initializeDashboard();
            } else {
                console.error("No user data found in database");
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error("Error in dashboard initialization:", error);
            hideLoader();
            window.location.href = 'login.html';
        }
    } else {
        hideLoader();
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
    }
});

// Function to get employer data
async function getEmployerData(email) {
    try {
        const employersRef = collection(db, "employers");
        const q = query(employersRef, where("email", "==", email.toLowerCase()));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            return userData;
        }
        console.log("No user data found for email:", email);
        return null;
    } catch (error) {
        console.error("Error fetching employer data:", error);
        return null;
    }
}

//Function to populate dashboard username  
function populateDashboardUser(userData) {
    try {
        const userNameElement = document.querySelector('.user-name');
        const initialsElement = document.querySelector('.initials');
        
        if (userNameElement && initialsElement && userData) {
            // Display full name
            const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
            userNameElement.textContent = userData.username || 'User';
            
            // Generate and display initials
            const initials = `${(userData.firstName || '').charAt(0)}${(userData.lastName || '').charAt(0)}`;
            initialsElement.textContent = initials.toUpperCase();
        }
    } catch (error) {
        console.error("Error populating dashboard user:", error);
    }
}

// Function to get total applications
async function getTotalApplications() {
    try {
        const applicationsRef = collection(db, "applications");
        const querySnapshot = await getDocs(applicationsRef);
        const totalApplications = querySnapshot.size;
        
        const totalApplicationsElement = document.getElementById('totalApplications');
        if (totalApplicationsElement) {
            totalApplicationsElement.textContent = totalApplications;
        }
    } catch (error) {
        console.error("Error getting applications:", error);
        const totalApplicationsElement = document.getElementById('totalApplications');
        if (totalApplicationsElement) {
            totalApplicationsElement.textContent = "Error";
        }
    }
}

// Function to get total active jobs
async function getActiveJobs() {
    try {
        const jobsRef = collection(db, "jobs");
        const querySnapshot = await getDocs(jobsRef);
        const totalJobs = querySnapshot.size;
        
        const activeJobsElement = document.getElementById('activeJobs');
        if (activeJobsElement) {
            activeJobsElement.textContent = totalJobs;
        }
    } catch (error) {
        console.error("Error getting jobs:", error);
        const activeJobsElement = document.getElementById('activeJobs');
        if (activeJobsElement) {
            activeJobsElement.textContent = "Error";
        }
    }
}

// Function to count hired applicants
async function countHiredApplicants() {
    try {
        const applicationsRef = collection(db, "applications");
        const querySnapshot = await getDocs(applicationsRef);
        let hiredCount = 0;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'hired') {
                hiredCount++;
            }
        });

        const hiredElement = document.querySelector('.text-info.text-uppercase.mb-1 .h5');
        if (hiredElement) {
            hiredElement.textContent = hiredCount;
        }

    } catch (error) {
        console.error("Error counting hired applicants:", error);
    }
}

// Function to count pending applications
async function countPendingApplications() {
    try {
        const applicationsRef = collection(db, "applications");
        const querySnapshot = await getDocs(applicationsRef);
        let pendingCount = 0;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'application received' || data.status === 'viewed') {
                pendingCount++;
            }
        });

        const pendingElement = document.querySelector('.text-warning.text-uppercase.mb-1 .h5');
        if (pendingElement) {
            pendingElement.textContent = pendingCount;
        }

    } catch (error) {
        console.error("Error counting pending applications:", error);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializePage(initializeDashboard);
});
