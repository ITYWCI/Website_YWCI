import { 
    collection, 
    getDocs, 
    query, 
    where,
    orderBy,
    updateDoc,
    limit,
    addDoc,
    serverTimestamp,
    deleteDoc,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    deleteUser,
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { initializePage } from './auth.js';
import { auth, db } from './firebase-config.js';
import {
    deleteEmployerCompletely,
    updateEmployer,
    createEmployer,
    getNextEmployerId
} from './adminFunctions.js';
import { 
    httpsCallable 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";
import { functions } from './firebase-config.js';

let modal = null;
let form = null;
let isEditing = false;
let selectedEmployerData = null;
let selectedEmployerId = null;
let selectedEmployerEmail = null;

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

// Format full name function
function formatFullName(employer) {
    if (!employer) return 'Unknown';
    
    const firstName = employer.firstName || '';
    const middleName = employer.middleName || '';
    const lastName = employer.lastName || '';
    
    let fullName = firstName;
    
    if (middleName) {
        fullName += ' ' + middleName;
    }
    
    if (lastName) {
        fullName += ' ' + lastName;
    }
    
    return fullName.trim() || 'Unknown';
}

// Get job listings count for employer
async function getJobListingsCount(employerId) {
    try {
        const jobsRef = collection(db, "jobs");
        const q = query(jobsRef, where("employerId", "==", employerId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.size;
    } catch (error) {
        console.error("Error getting job count:", error);
        return 0;
    }
}

// Initialize employers table
async function initializeEmployersTable() {
    showLoader();
    try {
        console.log("Fetching employers...");
        const employersRef = collection(db, "employers");
        const querySnapshot = await getDocs(employersRef);
        const tableBody = document.getElementById('employerTableBody');
        
        if (!tableBody) {
            console.error("Table body element not found");
            return;
        }

        tableBody.innerHTML = ''; // Clear existing content
        console.log("Total employers found:", querySnapshot.size);

        for (const doc of querySnapshot.docs) {
            const employerData = doc.data();
            // Add null checks and default values
            if (!employerData) continue;

            console.log("Processing employer data:", employerData);
            
            const jobCount = await getJobListingsCount(employerData.employerId || '');
            const fullName = formatFullName(employerData);
            
            const row = document.createElement('tr');
            
            // Add employer ID as data attribute
            row.setAttribute('data-employer-id', doc.id);
            
            // Create employer info cell with avatar
            const employerInfoCell = document.createElement('td');
            employerInfoCell.innerHTML = `
                <div class="employer-info">
                    <div class="employer-avatar">
                        <div class="avatar-initials">${getInitials(fullName)}</div>
                    </div>
                    <div>
                        <div style="font-family: interSemiBold;">${fullName}</div>
                    </div>
                </div>
            `;

            // Create other cells with null checks
            const usernameCell = document.createElement('td');
            usernameCell.innerHTML = `
                <div class="employer-username">
                    ${employerData.username || 'No Username'}
                </div>
            `;

            const emailCell = document.createElement('td');
            emailCell.textContent = employerData.email || 'N/A';

            const jobListingsCell = document.createElement('td');
            jobListingsCell.innerHTML = `
                <span class="job-count">${jobCount}</span>
            `;

            const dateRegisteredCell = document.createElement('td');
            dateRegisteredCell.textContent = formatDate(employerData.createdAt);

            // Append all cells to row
            row.appendChild(employerInfoCell);
            row.appendChild(usernameCell);
            row.appendChild(emailCell);
            row.appendChild(jobListingsCell);
            row.appendChild(dateRegisteredCell);

            tableBody.appendChild(row);
        }

        // Show no results message if no employers found
        const noResults = document.getElementById('noResultsMessage');
        if (noResults) {
            noResults.style.display = querySnapshot.empty ? 'block' : 'none';
        }

    } catch (error) {
        console.error("Error fetching employers:", error);
    } finally {
        hideLoader();
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

// Update handleRowSelection function
async function handleRowSelection() {
    const rows = document.querySelectorAll('#employerTableBody tr');
    const floatingButtons = document.querySelector('.floating-action-buttons');
    const editButton = document.querySelector('.edit-employer-btn');
    const deleteButton = document.querySelector('.delete-employer-btn');
    let selectedEmployerId = null;
    let selectedDocumentId = null;

    // Function to deselect all rows
    const deselectAllRows = () => {
        rows.forEach(row => row.classList.remove('selected'));
        if (floatingButtons) floatingButtons.classList.remove('visible');
        if (editButton) editButton.disabled = true;
        if (deleteButton) deleteButton.disabled = true;
        selectedEmployerId = null;
        selectedDocumentId = null;
    };

    // Row click handler
    rows.forEach(row => {
        row.addEventListener('click', async function(e) {
            e.stopPropagation(); // Prevent click from bubbling to document
            
            // Get the document ID from the row
            const docId = this.getAttribute('data-employer-id');
            if (!docId) return;
            
            // Store the document ID
            selectedDocumentId = docId;
            
            // Get the email directly from the row's email cell
            const emailCell = this.querySelector('td:nth-child(3)'); // Assuming email is in the 3rd column
            let selectedEmployerEmail = null;
            if (emailCell) {
                selectedEmployerEmail = emailCell.textContent;
                if (selectedEmployerEmail === 'N/A') {
                    selectedEmployerEmail = null;
                }
            }
            
            console.log("Selected employer's document ID: ", docId);
            console.log("Selected employer's email: ", selectedEmployerEmail);
            
            // Fetch the complete employer data from Firestore
            try {
                const employerRef = doc(db, "employers", docId);
                const docSnap = await getDoc(employerRef);
                
                if (docSnap.exists()) {
                    const employerData = docSnap.data();
                    
                    // Set the selectedEmployerId to the employerId field from the data
                    selectedEmployerId = employerData.employerId;
                    console.log("Selected employer's actual employerId: ", selectedEmployerId);
                    
                    // Store the complete employer data
                    selectedEmployerData = {
                        ...employerData,
                        id: docId,
                        documentId: docId // Store document ID separately
                    };
                    
                    // Try to get email from different possible locations
                    selectedEmployerEmail = employerData.email || 
                                           employerData.contactEmail || 
                                           employerData.userEmail ||
                                           selectedEmployerEmail;
                    
                    console.log("Selected employer's full name:", formatFullName(selectedEmployerData));
                    console.log("Complete employer data:", selectedEmployerData);
                } else {
                    console.error("No employer document found with ID:", docId);
                    return;
                }
            } catch (error) {
                console.error("Error fetching employer data:", error);
                return;
            }
            
            // Deselect all other rows
            rows.forEach(r => r.classList.remove('selected'));
            this.classList.add('selected');
            
            if (selectedDocumentId) {
                floatingButtons.classList.add('visible');
                if (editButton) editButton.disabled = false;
                if (deleteButton) deleteButton.disabled = false;
            }
        });
    });

    // Add click handler to document to deselect when clicking outside
    document.addEventListener('click', function(e) {
        // Check if click is outside the table and floating buttons
        const tableArea = document.getElementById('employerTableBody');
        const floatingButtonsArea = document.querySelector('.floating-action-buttons');
        
        if (tableArea && floatingButtonsArea) {
            const isClickInTable = tableArea.contains(e.target);
            const isClickInButtons = floatingButtonsArea.contains(e.target);
            
            if (!isClickInTable && !isClickInButtons) {
                deselectAllRows();
            }
        }
    });

    // Edit button handler
    if (editButton) {
        editButton.addEventListener('click', async function() {
            if (!selectedDocumentId) {
                await Swal.fire({
                    title: 'Error!',
                    text: 'Please select an employer to edit.',
                    icon: 'error',
                    confirmButtonColor: '#073884'
                });
                return;
            }

            try {
                const employerRef = doc(db, "employers", selectedDocumentId);
                const employerSnap = await getDoc(employerRef);

                if (employerSnap.exists()) {
                    const employerData = {
                        id: selectedDocumentId,
                        ...employerSnap.data()
                    };
                    
                    // Open modal first
                    const modal = document.getElementById('addEmployerModal');
                    if (modal) {
                        modal.style.display = 'block';
                        
                        // Modify the password field properties
                        const passwordInput = document.getElementById('password');
                        if (passwordInput) {
                            passwordInput.disabled = true;
                            passwordInput.style.backgroundColor = '#f3f4f6';
                            passwordInput.value = '********';
                        }

                        // Hide the Default Password button in edit mode
                        const defaultPasswordBtn = document.getElementById('defaultPasswordBtn');
                        if (defaultPasswordBtn) {
                            defaultPasswordBtn.style.display = 'none';
                        }
                        
                        // Then call openEditModal
                        openEditModal(employerData);
                    }
                } else {
                    throw new Error('Employer not found');
                }
            } catch (error) {
                console.error("Error fetching employer data:", error);
                await Swal.fire({
                    title: 'Error!',
                    text: 'Could not load employer data.',
                    icon: 'error',
                    confirmButtonColor: '#073884'
                });
            }
        });
    }

    // Delete button handler
    if (deleteButton) {
        deleteButton.addEventListener('click', async function(e) {
            e.stopPropagation(); // Prevent click from bubbling
            
            console.log("Delete button clicked, selected employer's document ID:", selectedDocumentId);
            console.log("Selected employer's actual employerId:", selectedEmployerId);
            
            // Store the IDs immediately to prevent them from being changed
            const documentIdToDelete = selectedDocumentId;
            const employerIdToDelete = selectedEmployerId;
            
            console.log("Stored document ID to delete:", documentIdToDelete);
            console.log("Stored employer ID to delete:", employerIdToDelete);
            
            if (!documentIdToDelete) {
                await Swal.fire({
                    title: 'Error!',
                    text: 'Please select an employer to delete.',
                    icon: 'error',
                    confirmButtonColor: '#073884'
                });
                return;
            }

            try {
                // Admin authentication
                const { value: adminPassword } = await Swal.fire({
                    title: 'Admin Authentication',
                    input: 'password',
                    inputLabel: 'Please enter your admin password to continue',
                    inputPlaceholder: 'Enter your password',
                    showCancelButton: true,
                    confirmButtonText: 'Confirm',
                    cancelButtonText: 'Cancel',
                    confirmButtonColor: '#073884',
                    cancelButtonColor: '#6b7280',
                    inputAttributes: {
                        autocapitalize: 'off',
                        autocorrect: 'off'
                    }
                });

                if (!adminPassword) {
                    return; // User cancelled
                }

                // Store admin password temporarily
                sessionStorage.setItem('adminPassword', adminPassword);

                // Confirm deletion with updated message
                const result = await Swal.fire({
                    title: 'Are you sure?',
                    text: "This will delete the employer account, authentication, and other data connected to it! Continue?",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'Yes, delete it!'
                });

                if (result.isConfirmed) {
                    showLoader();
                    
                    // Delete related job listings first using the employerId
                    if (employerIdToDelete) {
                        console.log("Deleting jobs with employerId:", employerIdToDelete);
                        const jobsRef = collection(db, "jobs");
                        const q = query(jobsRef, where("employerId", "==", employerIdToDelete));
                        const jobsSnapshot = await getDocs(q);
                        
                        console.log(`Found ${jobsSnapshot.size} jobs to delete`);
                        
                        const deletePromises = jobsSnapshot.docs.map(doc => {
                            console.log(`Deleting job with ID: ${doc.id}`);
                            return deleteDoc(doc.ref);
                        });
                        
                        await Promise.all(deletePromises);
                        console.log("Related job listings deleted");
                    } else {
                        console.log("No employerId available, skipping job deletion");
                    }
                    
                    // Now call the delete function with the document ID for auth and document deletion
                    const deleteResult = await deleteEmployerCompletely(documentIdToDelete);
                    
                    hideLoader();
                    
                    if (deleteResult.success) {
                        await Swal.fire({
                            title: 'Deleted!',
                            text: 'Employer and all related data have been deleted.',
                            icon: 'success',
                            confirmButtonColor: '#073884'
                        });
                        
                        // Refresh the table
                        initializeEmployersTable();
                    } else {
                        throw new Error(deleteResult.message || 'Failed to delete employer');
                    }
                }
            } catch (error) {
                hideLoader();
                console.error("Error deleting employer:", error);
                
                await Swal.fire({
                    title: 'Error!',
                    text: error.message || 'Failed to delete employer.',
                    icon: 'error',
                    confirmButtonColor: '#073884'
                });
            } finally {
                // Clear the admin password from session storage
                sessionStorage.removeItem('adminPassword');
            }
        });
    }
}

// Update the updateModalState function
function updateModalState(isEditing) {
    const modal = document.getElementById('addEmployerModal');
    const form = document.getElementById('addEmployerForm');
    const modalTitle = modal.querySelector('.modal-header h2');
    const submitBtn = form.querySelector('.submit-btn');
    const hasMiddleNameCheckbox = document.getElementById('hasMiddleName');
    const middleNameInput = document.getElementById('middleName');
    const emailInput = document.getElementById('email');
    const passwordContainer = document.querySelector('.password-container');

    // Update modal title and button text based on action
    modalTitle.textContent = isEditing ? 'Edit Employer' : 'Add New Employer';
    submitBtn.textContent = isEditing ? 'Save Changes' : 'Add Employer';

    // Reset form if adding new employer
    if (!isEditing) {
        form.reset();
        form.dataset.editMode = 'false';
        form.dataset.employerId = '';
        
        // Reset middle name field
        if (hasMiddleNameCheckbox && middleNameInput) {
            hasMiddleNameCheckbox.checked = false;
            middleNameInput.disabled = false;
            middleNameInput.value = '';
        }
        
        // Enable email field for new employer
        if (emailInput) {
            emailInput.disabled = false;
            emailInput.style.backgroundColor = '';
            emailInput.value = '';
        }

        // Completely recreate the password field for add mode
        resetPasswordField();
    }

    modal.style.display = 'block';
}

// Define the toggle function first, at the top level of your script
window.togglePasswordVisibility = function() {
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.getElementById('togglePassword');
    
    if (passwordInput && toggleBtn) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
            passwordInput.type = 'password';
            toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
        }
    }
};

const passwordHTML = `
    <label for="password" class="form-label">Password*</label>
    <div class="password-input-container">
        <input type="password" 
               id="password" 
               name="password" 
               class="form-control" 
               required 
               placeholder="Enter password"
               autocomplete="new-password">
        <button type="button" 
                class="password-toggle-btn" 
                id="togglePassword" 
                onclick="togglePasswordVisibility()"
                aria-label="Toggle password visibility">
        </button>
    </div>
    <button type="button" 
            id="defaultPasswordBtn" 
            class="default-password-btn">
        <i class="fas fa-key"></i>
        Default Password
    </button>`;

// First, add the HTML to the container
const passwordContainer = document.querySelector('.password-container');
if (passwordContainer) {
    passwordContainer.innerHTML = passwordHTML;
}

// Add the resetPasswordField function
function resetPasswordField() {
    const passwordContainer = document.querySelector('.password-container');
    if (passwordContainer) {
        passwordContainer.innerHTML = passwordHTML;
        
        // Add event listener for default password button
        const defaultBtn = document.getElementById('defaultPasswordBtn');
        const passwordInput = document.getElementById('password');
        
        if (defaultBtn && passwordInput) {
            defaultBtn.addEventListener('click', function() {
                passwordInput.value = 'yeswecan';
            });
        }
    }
}

// Update the handleAddEmployerButtonClick function to use the new CSS classes
function handleAddEmployerButtonClick() {
    // Reset the modal to add mode
    const modal = document.getElementById('addEmployerModal');
    const form = document.getElementById('addEmployerForm');
    
    if (modal && form) {
        // Reset form and mode
        form.reset();
        form.dataset.editMode = 'false';
        form.dataset.employerId = '';
        
        // Update modal title and button
        const modalTitle = modal.querySelector('.modal-header h2');
        const submitBtn = form.querySelector('.submit-btn');
        if (modalTitle) modalTitle.textContent = 'Add New Employer';
        if (submitBtn) {
            submitBtn.textContent = 'Add Employer';
            submitBtn.className = 'btn btn-primary submit-btn';
        }
        
        // Enable and reset email field
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.disabled = false;
            emailInput.style.backgroundColor = '';
            emailInput.value = '';
        }
        
        // Reset middle name field
        const hasMiddleNameCheckbox = document.getElementById('hasMiddleName');
        const middleNameInput = document.getElementById('middleName');
        if (hasMiddleNameCheckbox && middleNameInput) {
            hasMiddleNameCheckbox.checked = false;
            middleNameInput.disabled = false;
            middleNameInput.value = '';
        }
        
        // Find the password field container
        const passwordFieldContainer = document.querySelector('.form-group:has(#password)');
        if (passwordFieldContainer) {
            // Completely replace the password field container using the new CSS class
            passwordFieldContainer.innerHTML = `
                <label for="password" class="form-label">Password*</label>
                <div class="password-input-container">
                    <input type="password" 
                           id="password" 
                           name="password" 
                           class="form-control" 
                           required 
                           placeholder="Enter password"
                           autocomplete="new-password">
                    <button type="button" 
                            class="password-toggle-btn" 
                            id="togglePassword" 
                            onclick="togglePasswordVisibility()"
                            aria-label="Toggle password visibility">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
                <button type="button" 
                        id="defaultPasswordBtn" 
                        class="default-password-btn">
                    <i class="fas fa-key"></i>
                    Default Password
                </button>`;
            
            // Add event listener for default password button
            const defaultBtn = document.getElementById('defaultPasswordBtn');
            const passwordInput = document.getElementById('password');
            
            if (defaultBtn && passwordInput) {
                defaultBtn.addEventListener('click', function() {
                    passwordInput.value = 'yeswecan';
                });
            }
        }
        
        // Show the modal
        modal.style.display = 'block';
    }
}

// Update the closeModal function to properly reset the form
function closeModal() {
    const modal = document.getElementById('addEmployerModal');
    
    if (modal) {
        modal.style.display = 'none';
    }
}


// Update initializeFormHandlers function by removing the duplicate password toggle logic
function initializeFormHandlers() {
    const defaultPasswordBtn = document.getElementById('defaultPasswordBtn');
    const passwordInput = document.getElementById('password');
    const form = document.getElementById('addEmployerForm');
    const hasMiddleNameCheckbox = document.getElementById('hasMiddleName');
    const middleNameInput = document.getElementById('middleName');

    // Handle middle name checkbox
    if (hasMiddleNameCheckbox && middleNameInput) {
        hasMiddleNameCheckbox.addEventListener('change', function() {
            middleNameInput.disabled = this.checked;
            if (this.checked) {
                middleNameInput.value = '';
            }
        });
    }

    if (defaultPasswordBtn && passwordInput) {
        defaultPasswordBtn.addEventListener('click', function() {
            passwordInput.value = 'yeswecan';
        });
    }

    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            const isEditMode = this.dataset.editMode === 'true';
            const employerId = this.dataset.employerId;
            const hasNoMiddleName = document.getElementById('hasMiddleName').checked;
            
            const firstName = document.getElementById('firstName').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
            const middleName = hasNoMiddleName ? '' : document.getElementById('middleName').value.trim();
            const email = document.getElementById('email').value.trim();
            
            // Get username value from the dynamically added field
            const usernameInput = this.querySelector('input[name="username"]');
            const username = usernameInput ? usernameInput.value.trim() : '';
            
            if (isEditMode) {
                try {
                    // Create the data object first
                    const employerData = {
                        firstName,
                        lastName,
                        middleName: hasNoMiddleName ? '' : middleName,
                        email,
                        username
                    };

                    // Now use the created object in the confirmation dialog
                    const result = await Swal.fire({
                        title: 'Confirm Update',
                        html: `
                            <div style="text-align: left;">
                                <p><strong>First Name:</strong> ${employerData.firstName}</p>
                                <p><strong>Middle Name:</strong> ${hasNoMiddleName ? 'N/A' : (employerData.middleName || 'N/A')}</p>
                                <p><strong>Last Name:</strong> ${employerData.lastName}</p>
                                <p><strong>Username:</strong> ${employerData.username}</p>
                            </div>
                        `,
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonColor: '#073884',
                        cancelButtonColor: '#6b7280',
                        confirmButtonText: 'Yes, update it!',
                        cancelButtonText: 'Cancel'
                    });

                    if (result.isConfirmed) {
                        await updateEmployer(employerId, employerData);
                        
                        await Swal.fire({
                            title: 'Success!',
                            text: 'Employer updated successfully.',
                            icon: 'success',
                            confirmButtonColor: '#073884'
                        });
                        
                        this.reset();
                        modal.style.display = 'none';
                        window.location.reload();
                    }
                } catch (error) {
                    console.error("Error:", error);
                    await Swal.fire({
                        title: 'Error!',
                        text: 'Failed to update employer.',
                        icon: 'error',
                        confirmButtonColor: '#073884'
                    });
                }
                return;
            }

            // If creating new employer, continue with existing flow
            const password = document.getElementById('password').value;
            
            // Add these fields only for new employer creation
            const employerData = {
                firstName,
                lastName,
                middleName: hasNoMiddleName ? '' : middleName,
                email,
                username,
                employerId: await getNextEmployerId(),
                password
            };

            // Nice looking password prompt with verification
            try {
                const { value: adminPassword } = await Swal.fire({
                    title: 'Admin Authentication',
                    input: 'password',
                    inputLabel: 'Please enter your admin password to continue',
                    inputPlaceholder: 'Enter your password',
                    showCancelButton: true,
                    confirmButtonText: 'Confirm',
                    cancelButtonText: 'Cancel',
                    confirmButtonColor: '#073884',
                    cancelButtonColor: '#6b7280',
                    inputAttributes: {
                        autocapitalize: 'off',
                        autocorrect: 'off'
                    },
                    customClass: {
                        input: 'swal2-input',
                        validationMessage: 'swal2-validation-message'
                    },
                    preConfirm: async (password) => {
                        if (!password) {
                            Swal.showValidationMessage('Please enter your password');
                            return false;
                        }
                        
                        // Verify admin password
                        try {
                            const adminEmail = sessionStorage.getItem('adminEmail');
                            if (!adminEmail) {
                                throw new Error('Admin email not found');
                            }
                            
                            // Try to reauthenticate with the provided password
                            await signInWithEmailAndPassword(auth, adminEmail, password);
                            return password;
                        } catch (error) {
                            Swal.showValidationMessage('Invalid admin password');
                            return false;
                        }
                    }
                });

                if (!adminPassword) {
                    return; // User cancelled or validation failed
                }

                sessionStorage.setItem('adminPassword', adminPassword);

                // Continue with employer creation confirmation
                const result = await Swal.fire({
                    title: 'Confirm Details',
                    html: `
                        <div style="text-align: left;">
                            <p><strong>First Name:</strong> ${employerData.firstName}</p>
                            <p><strong>Middle Name:</strong> ${hasNoMiddleName ? 'N/A' : (employerData.middleName || 'N/A')}</p>
                            <p><strong>Last Name:</strong> ${employerData.lastName}</p>
                            <p><strong>Email:</strong> ${employerData.email}</p>
                            <p><strong>Username:</strong> ${employerData.username}</p>
                        </div>
                    `,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#073884',
                    cancelButtonColor: '#6b7280',
                    confirmButtonText: 'Yes, add it!',
                    cancelButtonText: 'Cancel'
                });

                if (result.isConfirmed) {
                    try {
                        await createEmployer(employerData, password);
                        sessionStorage.removeItem('adminPassword');
                        
                        await Swal.fire({
                            title: 'Success!',
                            text: 'Employer added successfully.',
                            icon: 'success',
                            confirmButtonColor: '#073884'
                        });
                        
                        this.reset();
                        modal.style.display = 'none';
                        window.location.reload();
                    } catch (error) {
                        sessionStorage.removeItem('adminPassword');
                        console.error("Error:", error);
                        let errorMessage = 'An error occurred.';
                        if (error.code === 'auth/email-already-in-use') {
                            errorMessage = 'This email is already registered.';
                        }
                        await Swal.fire({
                            title: 'Error!',
                            text: errorMessage,
                            icon: 'error',
                            confirmButtonColor: '#073884'
                        });
                    }
                } else {
                    sessionStorage.removeItem('adminPassword');
                }
            } catch (error) {
                console.error("Authentication error:", error);
                await Swal.fire({
                    title: 'Error!',
                    text: 'Authentication failed. Please try again.',
                    icon: 'error',
                    confirmButtonColor: '#073884'
                });
            }
        });
    }
}

// Update the openEditModal function
function openEditModal(employerData) {
    if (!employerData) return;
    
    const modal = document.getElementById('addEmployerModal');
    const form = document.getElementById('addEmployerForm');
    
    if (!modal || !form) return;
    
    // Set form to edit mode
    form.dataset.editMode = 'true';
    form.dataset.employerId = employerData.id || '';
    
    // Update modal title and button text
    const modalTitle = modal.querySelector('.modal-header h2');
    const submitBtn = form.querySelector('.submit-btn');
    
    if (modalTitle) modalTitle.textContent = 'Edit Employer';
    if (submitBtn) submitBtn.textContent = 'Save Changes';
    
    // Populate form fields
    const firstNameInput = document.getElementById('firstName');
    const middleNameInput = document.getElementById('middleName');
    const lastNameInput = document.getElementById('lastName');
    const emailInput = document.getElementById('email');
    const usernameInput = document.getElementById('username');
    const hasMiddleNameCheckbox = document.getElementById('hasMiddleName');
    
    if (firstNameInput) firstNameInput.value = employerData.firstName || '';
    if (lastNameInput) lastNameInput.value = employerData.lastName || '';
    if (emailInput) {
        emailInput.value = employerData.email || '';
        emailInput.disabled = true;
        emailInput.style.backgroundColor = '#f3f4f6';
    }
    
    // Handle middle name logic
    if (middleNameInput && hasMiddleNameCheckbox) {
        const hasNoMiddleName = !employerData.middleName || employerData.middleName.trim() === '';
        hasMiddleNameCheckbox.checked = hasNoMiddleName;
        middleNameInput.disabled = hasNoMiddleName;
        middleNameInput.value = hasNoMiddleName ? '' : (employerData.middleName || '');
    }
    
    // Set username
    if (usernameInput) {
        usernameInput.value = employerData.username || '';
    }
    
    // Modify the password field for edit mode
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.getElementById('togglePassword');
    const defaultPasswordBtn = document.getElementById('defaultPasswordBtn');
    
    if (passwordInput) {
        passwordInput.disabled = true;
        passwordInput.style.backgroundColor = '#f3f4f6';
        passwordInput.value = '********';
    }
    
    // Hide the toggle password button and default password button in edit mode
    if (toggleBtn) {
        toggleBtn.style.display = 'none';
    }
    if (defaultPasswordBtn) {
        defaultPasswordBtn.style.display = 'none';
    }
    
    // Show the modal
    modal.style.display = 'block';
}

// Update the DOM manipulation to check if username field already exists
document.addEventListener('DOMContentLoaded', function() {
    const modalForm = document.getElementById('addEmployerForm');
    
    if (modalForm) {
        // Check if username field already exists
        const existingUsernameField = document.getElementById('username');
        
        if (!existingUsernameField) {
            console.log("Username field not found, adding it dynamically");
            
            // Find the password field container
            const passwordField = document.getElementById('password');
            
            if (passwordField) {
                const passwordFieldContainer = passwordField.closest('.form-group');
                
                if (passwordFieldContainer) {
                    // Create the username field HTML
                    const usernameFieldHTML = `
    <div class="form-group">
        <label for="username" style="font-family: montserratSemiBold;">Username</label>
        <input type="text" 
               id="username" 
               name="username" 
               class="form-control" 
               placeholder="Enter username"
               value="${selectedEmployerData?.username || ''}"
        >
    </div>
`;
                    
                    // Insert the username field after the password field
                    passwordFieldContainer.insertAdjacentHTML('afterend', usernameFieldHTML);
                    console.log("Username field added after password field");
                }
            }
        }
    }
});


// Initialize employers page
async function initializeEmployersPage() {
    try {
        modal = document.getElementById('addEmployerModal');
        form = document.getElementById('addEmployerForm');

        await initializeEmployersTable();
        initializeSidebar();
        initializeDropdown();
        handleRowSelection();
        initializeFormHandlers();

        // Add modal close handlers
        const closeBtn = modal.querySelector('.close');
        const cancelBtn = modal.querySelector('.cancel-btn');

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        // Add Employer button click handler
        const addEmployerBtn = document.getElementById('addEmployerBtn');
        if (addEmployerBtn) {
            addEmployerBtn.addEventListener('click', handleAddEmployerButtonClick);
        }

        // Initialize floating action buttons
        const floatingButtons = document.querySelector('.floating-action-buttons');
        if (floatingButtons) {
            floatingButtons.classList.remove('visible');
        }

    } catch (error) {
        console.error("Error initializing employers page:", error);
        throw error;
    }
}

// Update the DOMContentLoaded event handler
document.addEventListener('DOMContentLoaded', async () => {
    showLoader();
    try {
        await initializePage(initializeEmployersPage);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        hideLoader();
    }
});

// Export necessary functions if needed
export {
    showLoader,
    hideLoader,
    initializeEmployersPage
};

// Function to completely reset the employer modal to its default state
function resetEmployerModal() {
    // Reset the form fields
    const employerForm = document.getElementById('employerForm');
    if (employerForm) {
        employerForm.reset();
        
        // Enable all fields
        const formFields = employerForm.elements;
        for (let i = 0; i < formFields.length; i++) {
            formFields[i].disabled = false;
        }
        
        // Clear any previous employer ID
        employerForm.removeAttribute('data-employer-id');
    }
    
    // Specifically ensure email and password are enabled
    const emailField = document.getElementById('employerEmail');
    const passwordField = document.getElementById('employerPassword');
    
    if (emailField) emailField.disabled = false;
    if (passwordField) passwordField.disabled = false;
    
    // Reset the modal title to default if the element exists
    const modalTitle = document.querySelector('.modal-title'); // Using class instead of ID
    if (modalTitle) {
        modalTitle.textContent = 'Add Employer';
    }
    
    // If there are any validation messages or errors, clear them
    const errorElements = document.querySelectorAll('.invalid-feedback');
    errorElements.forEach(element => {
        element.style.display = 'none';
    });
    
    const formElements = document.querySelectorAll('.form-control');
    formElements.forEach(element => {
        element.classList.remove('is-invalid');
        element.classList.remove('is-valid');
    });
    
    console.log("Modal has been completely reset");
}

// Function to show the modal using vanilla JavaScript
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // Check if we're using Bootstrap 5
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        } 
        // Check if we're using Bootstrap 4 with jQuery
        else if (typeof $ !== 'undefined' && typeof $.fn.modal === 'function') {
            $(modal).modal('show');
        } 
        // Fallback to manual display
        else {
            modal.style.display = 'block';
            modal.classList.add('show');
            document.body.classList.add('modal-open');
            
            // Create backdrop if it doesn't exist
            let backdrop = document.querySelector('.modal-backdrop');
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.classList.add('modal-backdrop', 'fade', 'show');
                document.body.appendChild(backdrop);
            }
        }
    } else {
        console.error("Modal element not found:", modalId);
        
        // List all available modals for debugging
        const allModals = document.querySelectorAll('.modal');
        if (allModals.length > 0) {
            console.log("Available modals:");
            allModals.forEach(m => {
                console.log(`- ${m.id || 'unnamed modal'}`);
            });
        } else {
            console.log("No modals found in the document");
        }
    }
}

// Function to hide the modal using vanilla JavaScript
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // Check if we're using Bootstrap 5
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) {
                bsModal.hide();
            }
        } 
        // Check if we're using Bootstrap 4 with jQuery
        else if (typeof $ !== 'undefined' && typeof $.fn.modal === 'function') {
            $(modal).modal('hide');
        } 
        // Fallback to manual hide
        else {
            modal.style.display = 'none';
            modal.classList.remove('show');
            document.body.classList.remove('modal-open');
            
            // Remove backdrop
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.parentNode.removeChild(backdrop);
            }
        }
    } else {
        console.error("Modal element not found:", modalId);
    }
}

// Function to open the add employer modal
function openAddEmployerModal() {
    // Reset the modal to add mode
    const modal = document.getElementById('addEmployerModal');
    const form = document.getElementById('addEmployerForm');
    
    if (!modal || !form) return;
    
    // Reset form
    form.reset();
    
    // Set modal to add mode
    form.dataset.editMode = 'false';
    form.dataset.employerId = '';
    
    // Update modal title and button text
    const modalTitle = modal.querySelector('.modal-header h2');
    const submitBtn = form.querySelector('.submit-btn');
    
    if (modalTitle) modalTitle.textContent = 'Add New Employer';
    if (submitBtn) submitBtn.textContent = 'Add Employer';
    
    // Reset middle name field
    const hasMiddleNameCheckbox = document.getElementById('hasMiddleName');
    const middleNameInput = document.getElementById('middleName');
    
    if (hasMiddleNameCheckbox && middleNameInput) {
        hasMiddleNameCheckbox.checked = false;
        middleNameInput.disabled = true;
        middleNameInput.value = '';
    }
    
    // Enable email field for new employer
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.disabled = false;
        emailInput.style.backgroundColor = '';
        emailInput.value = '';
    }
    
    // Reset password field
    resetPasswordField();
    
    // Show the modal
    modal.style.display = 'block';
}

// Function to open the edit employer modal
function openEditEmployerModal(employer) {
    // First reset the modal completely
    resetEmployerModal();
    
    // Set the modal title if the element exists
    const modalTitle = document.querySelector('.modal-title'); // Using class instead of ID
    if (modalTitle) {
        modalTitle.textContent = 'Edit Employer';
    }
    
    // Fill the form with employer data
    const nameField = document.getElementById('employerName');
    const emailField = document.getElementById('employerEmail');
    const phoneField = document.getElementById('employerPhone');
    const addressField = document.getElementById('employerAddress');
    const websiteField = document.getElementById('employerWebsite');
    const descriptionField = document.getElementById('employerDescription');
    const passwordField = document.getElementById('employerPassword');
    const employerForm = document.getElementById('employerForm');
    
    if (nameField) nameField.value = employer.name || '';
    if (emailField) {
        emailField.value = employer.email || '';
        emailField.disabled = true;
    }
    if (phoneField) phoneField.value = employer.phone || '';
    if (addressField) addressField.value = employer.address || '';
    if (websiteField) websiteField.value = employer.website || '';
    if (descriptionField) descriptionField.value = employer.description || '';
    
    // Disable email and password fields for editing
    if (emailField) emailField.disabled = true;
    if (passwordField) {
        passwordField.disabled = true;
        passwordField.value = '';
    }
    
    // Store the employer ID in the form for later use
    if (employerForm) {
        employerForm.setAttribute('data-employer-id', employer.id);
    }
    
    // Show the modal
    showModal('employerModal');
    
    console.log("Edit employer modal opened for:", employer.id);
}

// Add event listeners for the buttons that open the modals
const addEmployerBtn = document.getElementById('addEmployerBtn');
if (addEmployerBtn) {
    addEmployerBtn.addEventListener('click', function() {
        console.log("Add employer button clicked");
        openAddEmployerModal();
    });
}

// For edit buttons, you'll need to add event listeners dynamically when you create the employer rows
function attachEditButtonListeners() {
    const editButtons = document.querySelectorAll('.edit-employer-btn');
    editButtons.forEach(button => {
        button.addEventListener('click', function() {
            const employerId = this.getAttribute('data-employer-id');
            console.log("Edit button clicked for employer:", employerId);
            
            // Get the employer data
            const employerRef = doc(db, "employers", employerId);
            getDoc(employerRef).then(docSnap => {
                if (docSnap.exists()) {
                    const employerData = docSnap.data();
                    employerData.id = docSnap.id;
                    openEditEmployerModal(employerData);
                } else {
                    console.error("No employer found with ID:", employerId);
                }
            }).catch(error => {
                console.error("Error getting employer:", error);
            });
        });
    });
}

// Add event listener for modal close buttons
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('close') || 
        event.target.getAttribute('data-dismiss') === 'modal' ||
        event.target.classList.contains('modal-close-btn')) {
        
        hideModal('employerModal');
        resetEmployerModal();
    }
});

// Add event listener for when the modal is hidden
const employerModal = document.getElementById('employerModal');
if (employerModal) {
    employerModal.addEventListener('hidden.bs.modal', function() {
        console.log("Modal hidden event triggered");
        resetEmployerModal();
    });
    
    // For manual modal closing
    employerModal.addEventListener('click', function(event) {
        if (event.target === employerModal) {
            hideModal('employerModal');
            resetEmployerModal();
        }
    });
}

// Make sure to call attachEditButtonListeners() after you've created the employer rows

// Function to handle employer selection
function selectEmployer(employerId, employerData) {
    console.log("Setting selectedEmployerId to:", employerId);
    selectedEmployerId = employerId;
    
    // Store the complete employer data if provided
    if (employerData) {
        selectedEmployerData = employerData;
        selectedEmployerEmail = employerData.email || null;
        
        console.log("Selected employer's document ID: ", selectedEmployerId);
        console.log("Selected employer's email: ", selectedEmployerEmail);
        console.log("Selected employer's full name: ", formatFullName(selectedEmployerData));
        
        // Log all available data for debugging
        console.log("Complete employer data:", selectedEmployerData);
    } else {
        // If employer data wasn't provided, fetch it from Firestore
        const employerRef = doc(db, "employers", employerId);
        getDoc(employerRef)
            .then((docSnap) => {
                if (docSnap.exists()) {
                    selectedEmployerData = docSnap.data();
                    selectedEmployerData.id = docSnap.id;
                    selectedEmployerEmail = selectedEmployerData.email || null;
                    
                    console.log("Selected employer's document ID: ", selectedEmployerId);
                    console.log("Selected employer's email: ", selectedEmployerEmail);
                    console.log("Selected employer's full name: ", formatFullName(selectedEmployerData));
                    
                    // Log all available data for debugging
                    console.log("Complete employer data:", selectedEmployerData);
                } else {
                    console.error("No employer found with ID:", employerId);
                }
            })
            .catch((error) => {
                console.error("Error getting employer:", error);
            });
    }
    
    // Highlight the selected row
    const rows = document.querySelectorAll('#employersTable tbody tr');
    rows.forEach(row => {
        if (row.getAttribute('data-employer-id') === employerId) {
            row.classList.add('selected-row');
        } else {
            row.classList.remove('selected-row');
        }
    });
}

// Update the row click handler to use the selectEmployer function
function createEmployerRow(employer) {
    const row = document.createElement('tr');
    row.setAttribute('data-employer-id', employer.id);
    
    // Create cells for each column
    const nameCell = document.createElement('td');
    nameCell.textContent = formatFullName(employer);
    
    const emailCell = document.createElement('td');
    emailCell.textContent = employer.email || 'N/A';
    
    const phoneCell = document.createElement('td');
    phoneCell.textContent = employer.phone || 'N/A';
    
    const addressCell = document.createElement('td');
    addressCell.textContent = employer.address || 'N/A';
    
    const websiteCell = document.createElement('td');
    websiteCell.textContent = employer.website || 'N/A';
    
    const actionsCell = document.createElement('td');
    
    // Create edit button
    const editButton = document.createElement('button');
    editButton.className = 'edit-employer-btn';
    editButton.textContent = 'Edit';
    editButton.setAttribute('data-employer-id', employer.id);
    
    // Create delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-employer-btn';
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('data-employer-id', employer.id);
    
    // Add buttons to actions cell
    actionsCell.appendChild(editButton);
    actionsCell.appendChild(deleteButton);
    
    // Add all cells to the row
    row.appendChild(nameCell);
    row.appendChild(emailCell);
    row.appendChild(phoneCell);
    row.appendChild(addressCell);
    row.appendChild(websiteCell);
    row.appendChild(actionsCell);
    
    // Add click handler for row selection
    row.addEventListener('click', function() {
        selectEmployer(employer.id, employer);
    });
    
    return row;
}

async function handleFormSubmit(event) {
    event.preventDefault();
    console.log("Form submitted");
    
    try {
        const form = event.target;
        const isEditing = form.dataset.editMode === 'true';
        const employerId = form.dataset.employerId || '';
        
        // Get form values with validation logging
        const firstName = document.getElementById('firstName')?.value.trim() || '';
        const hasMiddleName = document.getElementById('hasMiddleName')?.checked || false;
        const middleName = hasMiddleName ? '' : (document.getElementById('middleName')?.value.trim() || '');
        const lastName = document.getElementById('lastName')?.value.trim() || '';
        const email = document.getElementById('email')?.value.trim() || '';
        
        // Get username value from the dynamically added field
        const usernameInput = form.querySelector('input[name="username"]');
        const username = usernameInput ? usernameInput.value.trim() : '';
        
        
        if (isEditing) {
            // Create the data object first
            const employerData = {
                firstName,
                lastName,
                middleName: hasMiddleName ? '' : middleName,
                email,
                username
            };

            // Now use the created object in the confirmation dialog
            const result = await Swal.fire({
                title: 'Confirm Update',
                html: `
                    <div style="text-align: left;">
                        <p><strong>First Name:</strong> ${employerData.firstName}</p>
                        <p><strong>Middle Name:</strong> ${hasMiddleName ? 'N/A' : (employerData.middleName || 'N/A')}</p>
                        <p><strong>Last Name:</strong> ${employerData.lastName}</p>
                        <p><strong>Username:</strong> ${employerData.username}</p>
                    </div>
                `,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#073884',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Yes, update it!',
                cancelButtonText: 'Cancel'
            });

            if (result.isConfirmed) {
                await updateEmployer(employerId, employerData);
                
                await Swal.fire({
                    title: 'Success!',
                    text: 'Employer updated successfully.',
                    icon: 'success',
                    confirmButtonColor: '#073884'
                });
                
                this.reset();
                modal.style.display = 'none';
                window.location.reload();
            }
        }
    } catch (error) {
        console.error("Form submission error:", error);
        throw error;
    }
}

// Make sure the form has a submit event listener that's properly connected
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, setting up form handlers");
    
    const form = document.getElementById('addEmployerForm');
    
    if (form) {
        console.log("Form found, adding submit event listener");
        
        // Remove any existing listeners to avoid duplicates
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        // Add the event listener to the new form
        newForm.addEventListener('submit', function(event) {
            console.log("Form submit event triggered");
            handleFormSubmit(event);
        });
    } else {
        console.error("Form not found");
    }
    
    // Set up the Save Changes button with a direct click handler as a backup
    const saveChangesBtn = document.querySelector('.submit-btn');
    if (saveChangesBtn) {
        console.log("Save Changes button found, adding click event listener");
        
        saveChangesBtn.addEventListener('click', function(event) {
            console.log("Save Changes button clicked");
            
            // Prevent default only if it's a submit button
            if (this.type === 'submit') {
                event.preventDefault();
            }
            
            // Get the form
            const form = document.getElementById('addEmployerForm');
            if (form) {
                // Manually trigger form submission
                const submitEvent = new Event('submit', { cancelable: true });
                form.dispatchEvent(submitEvent);
            } else {
                console.error("Form not found when Save Changes clicked");
            }
        });
    } else {
        console.error("Save Changes button not found");
    }
});
