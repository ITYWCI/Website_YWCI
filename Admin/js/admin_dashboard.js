import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { initializePage } from './auth.js';

// Function to show/hide loader
function showLoader() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.classList.remove('hidden');
    }
}

function hideLoader() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.classList.add('hidden');
    }
}

// Function to populate admin name
// Add this function to all three files (admin_dashboard.js, users.js, employers.js)
function getInitialsFromUsername(username) {
    if (!username) return 'A';
    return username.charAt(0).toUpperCase();
}

// Update the populateAdminName function in all three files
function populateAdminName(adminData) {
    try {
        const adminNameElement = document.querySelector('.mr-2.d-none.d-lg-inline.text-gray-600.small');
        const adminInitialsElement = document.querySelector('.initials');
        
        if (adminNameElement && adminData) {
            adminNameElement.textContent = adminData.username || 'Admin';
            console.log("Admin name populated:", adminData.username);
        } else {
            console.log("Admin name element or data missing");
        }

        if (adminInitialsElement && adminData) {
            adminInitialsElement.textContent = getInitialsFromUsername(adminData.username);
        }
    } catch (error) {
        console.error("Error populating admin name:", error);
    }
}

// Function to fetch dashboard counts
async function fetchDashboardCounts(elements) {
    try {
        // Fetch all counts in parallel for better performance
        const [jobsSnapshot, applicantsSnapshot, employersSnapshot, usersSnapshot] = await Promise.all([
            getDocs(collection(db, "jobs")),
            getDocs(collection(db, "applications")),
            getDocs(collection(db, "employers")),
            getDocs(collection(db, "users"))
        ]);

        // Update UI with counts
        const jobsCount = jobsSnapshot.size;
        const applicationsCount = applicantsSnapshot.size;
        const employersCount = employersSnapshot.size;
        const totalUsers = employersCount + usersSnapshot.size;

        elements.activeJobs.textContent = jobsCount;
        elements.totalApplications.textContent = applicationsCount;
        elements.totalEmployers.textContent = employersCount;
        elements.totalUsers.textContent = totalUsers;

    } catch (error) {
        console.error("Error fetching counts:", error);
        throw error; // Rethrow to handle in the main flow
    }
}

// Initialize dashboard
async function initializeDashboard() {
    try {
        const elements = {
            totalUsers: document.querySelector('#totalUsers'),
            totalEmployers: document.querySelector('#totalEmployers'),
            totalApplications: document.querySelector('#totalApplications'),
            activeJobs: document.querySelector('#activeJobs')
        };

        const missingElements = Object.entries(elements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            throw new Error(`Missing DOM elements: ${missingElements.join(', ')}`);
        }

        await fetchDashboardCounts(elements);
    } catch (error) {
        console.error("Error initializing dashboard:", error);
        throw error;
    }
}

// DOMContentLoaded event handler
document.addEventListener('DOMContentLoaded', async () => {
    showLoader();
    try {
        await initializePage(initializeDashboard);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        hideLoader();
    }
});