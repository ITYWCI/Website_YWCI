import {
    initializePage,
    db,
    auth,
    initializeFirebase } from './auth.js';
import { getInitials, createInitialsAvatar, populateUserNav } from './utils.js';

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
            populateUserNav(),
            getTotalApplications(),
            getActiveJobs(),
            countHiredApplicants(),
            countPendingApplications()
        ]);
        
        // Hide loader after everything is loaded
        hideLoader();
    } catch (error) {
        console.error("Error initializing dashboard:", error);
        hideLoader(); // Hide loader even on error
    }
}

// Initialize Firebase first, then set up auth state handler
initializeFirebase().then(() => {
    console.log('Firebase initialized in dashboard.js');
}).catch(error => {
    console.error("Error initializing Firebase in dashboard:", error);
});

// Function to handle user authentication
async function handleUserAuth(user) {
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
}

// Function to get employer data
async function getEmployerData(email) {
    try {
        // Use the server endpoint to get the employer profile
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
        // Make sure auth is initialized
        if (!auth || !auth.currentUser) {
            console.log("Waiting for authentication in getTotalApplications...");
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit and try again
            return getTotalApplications();
        }
        
        // Use the server endpoint to get applications
        const response = await fetch('/api/applicants', {
            headers: {
                'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch applications: ${response.statusText}`);
        }
        
        const applications = await response.json();
        const totalApplications = applications.length;
        
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
        // Make sure auth is initialized
        if (!auth || !auth.currentUser) {
            console.log("Waiting for authentication in getActiveJobs...");
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit and try again
            return getActiveJobs();
        }
        
        // Get current employer ID
        const employerId = await getCurrentEmployerId();
        if (!employerId) {
            throw new Error('No employer ID found');
        }
        
        // Use the server endpoint to get jobs
        const response = await fetch(`/api/employer/jobs/${employerId}`, {
            headers: {
                'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch jobs: ${response.statusText}`);
        }
        
        const jobs = await response.json();
        const totalJobs = jobs.length;
        
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
        // Make sure auth is initialized
        if (!auth || !auth.currentUser) {
            console.log("Waiting for authentication in countHiredApplicants...");
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit and try again
            return countHiredApplicants();
        }
        
        // Use the server endpoint to get applications
        const response = await fetch('/api/applicants', {
            headers: {
                'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch applications: ${response.statusText}`);
        }
        
        const applications = await response.json();
        let hiredCount = 0;

        applications.forEach((data) => {
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
        // Make sure auth is initialized
        if (!auth || !auth.currentUser) {
            console.log("Waiting for authentication in countPendingApplications...");
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit and try again
            return countPendingApplications();
        }
        
        // Use the server endpoint to get applications
        const response = await fetch('/api/applicants', {
            headers: {
                'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch applications: ${response.statusText}`);
        }
        
        const applications = await response.json();
        let pendingCount = 0;

        applications.forEach((data) => {
            if (data.status === 'pending') {
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

// Helper function to get current employer ID
async function getCurrentEmployerId() {
    try {
        const response = await fetch('/api/employer/current-id', {
            headers: {
                'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to get employer ID: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.employerId;
    } catch (error) {
        console.error("Error getting employer ID:", error);
        return null;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializePage(() => {
        // This will be called after Firebase and auth are initialized
        if (auth.currentUser) {
            handleUserAuth(auth.currentUser);
        }
    });
});
