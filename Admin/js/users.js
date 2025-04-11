import { auth, db } from './firebase-config.js';
import { 
    collection, 
    getDocs,
    query, 
    orderBy,
    where
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { initializePage } from './auth.js';

// Show/Hide loader functions
function showLoader() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) loader.classList.remove('hidden');
}

function hideLoader() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) loader.classList.add('hidden');
}

// Format date function
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    try {
        const date = timestamp.toDate();
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        console.error("Error formatting date:", error);
        return 'N/A';
    }
}

// Add this function from employers.js
function formatFullName(userData) {
    if (!userData) return 'N/A';
    
    const firstName = userData.firstName || '';
    const middleName = userData.middleName || '';
    const lastName = userData.lastName || '';
    
    let fullName = firstName;
    if (middleName) fullName += ` ${middleName}`;
    if (lastName) fullName += ` ${lastName}`;
    
    return fullName.trim() || 'N/A';
}

// Add these variables at the top of your file
let currentSortField = 'type'; // Default sort by type (applicants first, then employers)
let currentSortDirection = 'asc'; // Default sort direction
let allUsers = []; // Store all users in memory

// Initialize users table
async function initializeUsersTable() {
    showLoader();
    try {
        console.log("Fetching users and employers...");
        
        // Fetch both users and employers
        const usersRef = collection(db, "users");
        const employersRef = collection(db, "employers");
        
        // Get all users and employers
        const [usersSnapshot, employersSnapshot] = await Promise.all([
            getDocs(usersRef),
            getDocs(employersRef)
        ]);

        const tableBody = document.getElementById('userTableBody');
        if (!tableBody) {
            console.error("Table body element not found");
            return;
        }

        tableBody.innerHTML = ''; // Clear existing content
        
        // Reset the users array
        allUsers = [];
        
        // Process users (applicants)
        usersSnapshot.forEach((doc) => {
            const userData = doc.data();
            allUsers.push({
                ...userData,
                id: doc.id,
                type: 'applicant',
                fullName: formatFullName(userData)
            });
        });

        // Process employers
        employersSnapshot.forEach((doc) => {
            const employerData = doc.data();
            allUsers.push({
                ...employerData,
                id: doc.id,
                type: 'employer',
                fullName: formatFullName(employerData)
            });
        });

        // Sort users based on current sort field and direction
        sortUsers();

        // Render sorted users
        renderUsers(tableBody);

        // Show no results message if no users or employers found
        const noResults = document.getElementById('noResultsMessage');
        if (noResults) {
            noResults.style.display = allUsers.length === 0 ? 'block' : 'none';
        }

    } catch (error) {
        console.error("Error fetching users and employers:", error);
    } finally {
        hideLoader();
    }
}

// Function to sort users based on current sort field and direction
function sortUsers() {
    allUsers.sort((a, b) => {
        // Always group by type first unless sorting by date
        if (currentSortField !== 'createdAt' && a.type !== b.type) {
            return a.type === 'applicant' ? -1 : 1; // Applicants come first
        }
        
        // Then sort by the selected field
        if (currentSortField === 'fullName') {
            const nameA = a.fullName || '';
            const nameB = b.fullName || '';
            return currentSortDirection === 'asc' 
                ? nameA.localeCompare(nameB) 
                : nameB.localeCompare(nameA);
        } 
        else if (currentSortField === 'createdAt') {
            // Handle date sorting
            const dateA = a.createdAt ? a.createdAt.toDate().getTime() : 0;
            const dateB = b.createdAt ? b.createdAt.toDate().getTime() : 0;
            return currentSortDirection === 'asc' 
                ? dateA - dateB 
                : dateB - dateA;
        }
        // Default sort by name within each type
        else {
            const nameA = a.fullName || '';
            const nameB = b.fullName || '';
            return nameA.localeCompare(nameB);
        }
    });
}

// Function to render users to the table
function renderUsers(tableBody) {
    if (!tableBody) {
        tableBody = document.getElementById('userTableBody');
        if (!tableBody) {
            console.error("Table body element not found");
            return;
        }
    }
    
    tableBody.innerHTML = ''; // Clear existing content
    
    allUsers.forEach((userData) => {
        const row = document.createElement('tr');
        
        const userInfoCell = document.createElement('td');
        userInfoCell.innerHTML = `
            <div class="user-info">
                <div class="user-avatar">
                    <div class="avatar-initials">${getInitials(userData.fullName)}</div>
                </div>
                <div>
                    <div style="font-family: interSemiBold;">${userData.fullName}</div>
                </div>
            </div>
        `;

        // Create other cells
        const emailCell = document.createElement('td');
        emailCell.textContent = userData.email || 'N/A';

        const dateRegisteredCell = document.createElement('td');
        dateRegisteredCell.textContent = formatDate(userData.createdAt);

        const lastActiveCell = document.createElement('td');
        lastActiveCell.textContent = formatDate(userData.lastActive);

        const userTypeCell = document.createElement('td');
        userTypeCell.innerHTML = `
            <span class="status-badge status-${userData.type}">
                ${userData.type === 'applicant' ? 'Applicant' : 'Employer'}
            </span>
        `;

        // Append all cells to row
        row.appendChild(userInfoCell);
        row.appendChild(emailCell);
        row.appendChild(dateRegisteredCell);
        row.appendChild(lastActiveCell);
        row.appendChild(userTypeCell);

        tableBody.appendChild(row);
    });
}

// Function to initialize sortable table headers
function initializeSortableHeaders() {
    // Get the table headers
    const nameHeader = document.querySelector('th:nth-child(1)'); // Name column
    const dateHeader = document.querySelector('th:nth-child(3)'); // Date Registered column
    
    if (nameHeader) {
        // Add sort indicator and make it sortable
        nameHeader.classList.add('sortable');
        nameHeader.innerHTML = `Name <span class="sort-indicator">▼</span>`;
        nameHeader.addEventListener('click', () => {
            // Toggle sort direction if already sorting by name
            if (currentSortField === 'fullName') {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortField = 'fullName';
                currentSortDirection = 'asc';
            }
            
            // Update sort indicators
            updateSortIndicators();
            
            // Sort and render without fetching data again
            sortUsers();
            renderUsers();
        });
    }
    
    if (dateHeader) {
        // Add sort indicator and make it sortable
        dateHeader.classList.add('sortable');
        dateHeader.innerHTML = `Date Registered <span class="sort-indicator"></span>`;
        dateHeader.addEventListener('click', () => {
            // Toggle sort direction if already sorting by date
            if (currentSortField === 'createdAt') {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortField = 'createdAt';
                currentSortDirection = 'asc';
            }
            
            // Update sort indicators
            updateSortIndicators();
            
            // Sort and render without fetching data again
            sortUsers();
            renderUsers();
        });
    }
}

// Function to update sort indicators
function updateSortIndicators() {
    const nameHeader = document.querySelector('th:nth-child(1)');
    const dateHeader = document.querySelector('th:nth-child(3)');
    
    if (nameHeader) {
        if (currentSortField === 'fullName') {
            nameHeader.querySelector('.sort-indicator').textContent = 
                currentSortDirection === 'asc' ? '▼' : '▲';
        } else {
            nameHeader.querySelector('.sort-indicator').textContent = '';
        }
    }
    
    if (dateHeader) {
        if (currentSortField === 'createdAt') {
            dateHeader.querySelector('.sort-indicator').textContent = 
                currentSortDirection === 'asc' ? '▼' : '▲';
        } else {
            dateHeader.querySelector('.sort-indicator').textContent = '';
        }
    }
}

// Get initials from name
function getInitials(name) {
    if (name === 'N/A') return 'NA';
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

// Initialize mobile sidebar functionality
function initializeSidebar() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const adminContainer = document.querySelector('.admin-container');

    if (sidebarToggle && sidebarOverlay) {
        sidebarToggle.addEventListener('click', () => {
            adminContainer.classList.toggle('sidebar-toggled');
        });

        sidebarOverlay.addEventListener('click', () => {
            adminContainer.classList.remove('sidebar-toggled');
        });
    }
}

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

// Add dropdown functionality
function initializeDropdown() {
    const profileDropdown = document.getElementById('profileDropdown');
    
    if (profileDropdown) {
        const dropdownMenu = profileDropdown.nextElementSibling;
        
        if (dropdownMenu) {
            profileDropdown.addEventListener('click', function(e) {
                e.preventDefault();
                dropdownMenu.classList.toggle('show');
            });

            document.addEventListener('click', function(e) {
                if (!profileDropdown.contains(e.target)) {
                    dropdownMenu.classList.remove('show');
                }
            });
        }
    }
}

// Initialize users table
async function initializeUsersPage() {
    try {
        // Initialize sortable headers first
        initializeSortableHeaders();
        
        // Then load the table
        await initializeUsersTable();
        
        initializeSidebar();
        initializeDropdown();
    } catch (error) {
        console.error("Error initializing users page:", error);
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    showLoader();
    try {
        await initializePage(initializeUsersPage);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        hideLoader();
    }
}); 