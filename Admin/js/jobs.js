import { auth, db } from './firebase-config.js';
import { 
    collection, 
    getDocs,
    query, 
    where,
    orderBy,
    deleteDoc,
    updateDoc,
    getDoc,
    doc
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

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
        let date;
        // Handle 13-digit Unix timestamp (milliseconds)
        if (typeof timestamp === 'number' || /^\d{13}$/.test(timestamp)) {
            date = new Date(parseInt(timestamp));
        }
        // Handle Firestore timestamp
        else if (timestamp.toDate) {
            date = timestamp.toDate();
        }
        // Handle Date object
        else if (timestamp instanceof Date) {
            date = timestamp;
        }
        // Handle string timestamp
        else if (typeof timestamp === 'string') {
            date = new Date(parseInt(timestamp));
        }
        
        if (date && !isNaN(date)) {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
        return 'N/A';
    } catch (error) {
        console.error("Error formatting date:", error, "for timestamp:", timestamp);
        return 'N/A';
    }
}

// Format employer name function
async function getEmployerName(employerId) {
    try {
        if (!employerId) return 'N/A';
        
        const employersRef = collection(db, "employers");
        const q = query(employersRef, where("employerId", "==", employerId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const employerData = querySnapshot.docs[0].data();
            const firstName = employerData.firstName || '';
            const middleName = employerData.middleName || '';
            const lastName = employerData.lastName || '';
            
            if (firstName && lastName) {
                if (middleName) {
                    return `${firstName} ${middleName}. ${lastName}`;
                }
                return `${firstName} ${lastName}`;
            }
        }
        return 'N/A';
    } catch (error) {
        console.error("Error getting employer name:", error);
        return 'N/A';
    }
}

// Add these variables at the top of the file
let viewJobModal = null;
let currentJobData = null;

// Add the formatSalary function
function formatSalary(salary) {
    if (!salary) return 'N/A';
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
    }).format(salary);
}

// Add the openModal and closeModal functions
function openModal(modal) {
    if (modal) modal.style.display = 'block';
}

function closeModal(modal) {
    if (modal) modal.style.display = 'none';
}

// Modify the initializeJobsTable function to add row click handlers
async function initializeJobsTable() {
    showLoader();
    try {
        console.log("Fetching jobs...");
        const jobsRef = collection(db, "jobs");
        const querySnapshot = await getDocs(jobsRef);
        const tableBody = document.getElementById('jobTableBody');
        
        if (!tableBody) {
            console.error("Table body element not found");
            return;
        }

        tableBody.innerHTML = '';
        console.log("Total jobs found:", querySnapshot.size);

        // Create an object to group jobs by employer
        let jobsByEmployer = {};

        // First pass: group all jobs by employer and get employer names
        for (const doc of querySnapshot.docs) {
            const jobData = { id: doc.id, ...doc.data() };  // Include the document ID
            const employerId = jobData.employerId;
            const employerName = await getEmployerName(employerId);
            
            if (!jobsByEmployer[employerId]) {
                jobsByEmployer[employerId] = {
                    employerName: employerName,
                    jobs: []
                };
            }
            
            jobsByEmployer[employerId].jobs.push({
                ...jobData,
                employerName: employerName
            });
        }

        // Sort employers alphabetically and sort jobs within each employer
        const sortedEmployers = Object.entries(jobsByEmployer)
            .sort(([, a], [, b]) => a.employerName.localeCompare(b.employerName));

        // Render the sorted jobs
        for (const [employerId, employerData] of sortedEmployers) {
            // Sort jobs within this employer alphabetically by title
            employerData.jobs.sort((a, b) => a.title.localeCompare(b.title));
            
            // Render each job
            employerData.jobs.forEach(jobData => {
                const row = document.createElement('tr');
                row.style.cursor = 'pointer';
                row.setAttribute('data-job-id', jobData.id);
                
                // Add click handler to show job details
                row.addEventListener('click', () => {
                    const modal = document.getElementById('viewJobModal');
                    if (!modal) return;

                    currentJobData = jobData; // Store current job data for delete functionality

                    // Clean up data
                    const cleanCompany = jobData.company?.replace(/[•·]|\s+[•·]\s+/g, '').trim() || 'N/A';
                    const cleanLocation = jobData.location?.replace(/[•·]|\s+[•·]\s+/g, '').trim() || 'N/A';

                    // Update modal content
                    const titleElement = modal.querySelector('.modal-job-title');
                    const typeElement = modal.querySelector('.modal-job-type');
                    const companyInfoSection = modal.querySelector('.modal-company-info');
                    const descriptionElement = modal.querySelector('.modal-description');

                    if (titleElement) titleElement.textContent = jobData.title;
                    if (typeElement) {
                        typeElement.textContent = jobData.type || 'Full Time';
                        typeElement.className = `modal-job-type ${(jobData.type || 'Full Time').toLowerCase().replace(/\s+/g, '-')}`;
                    }

                    // Update company info section with icons
                    if (companyInfoSection) {
                        companyInfoSection.innerHTML = `
                            <div class="info-item">
                                <i class="fas fa-building"></i>
                                <span class="modal-company">${cleanCompany}</span>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-map-marker-alt"></i>
                                <span class="modal-location">${cleanLocation}</span>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-money-bill-wave"></i>
                                <span class="modal-salary">${jobData.isConfidential ? 'Salary Confidential' : 
                                    jobData.isRange ? `${formatSalary(jobData.minSalary)} - ${formatSalary(jobData.maxSalary)}` : 
                                    formatSalary(jobData.salary)}</span>
                            </div>
                        `;
                    }

                    if (descriptionElement) {
                        descriptionElement.innerHTML = `
                            ${jobData.companyDescription ? `
                                <div class="company-description-section">
                                    <h3 style="font-family: interBold;">About ${cleanCompany}</h3>
                                    <div class="company-description-content">${jobData.companyDescription}</div>
                                </div>
                            ` : ''}
                            <div class="job-details-section">
                                ${jobData.description || ''}
                            </div>
                        `;
                    }

                    // Show the modal
                    modal.style.display = 'block';
                });

                // Create table cells
                const jobNameCell = document.createElement('td');
                jobNameCell.innerHTML = `
                    <div class="job-info">
                        <div class="job-name" style="font-family: interSemiBold;">${jobData.title || 'N/A'}</div>
                    </div>
                `;

                const locationCell = document.createElement('td');
                locationCell.textContent = jobData.location || 'N/A';

                const dateAddedCell = document.createElement('td');
                dateAddedCell.textContent = formatDate(jobData.timestamp);

                const lastEditedCell = document.createElement('td');
                lastEditedCell.textContent = formatDate(jobData.lastEdited || jobData.timestamp);

                const postedByCell = document.createElement('td');
                postedByCell.textContent = employerData.employerName;

                // Append cells to row
                row.appendChild(jobNameCell);
                row.appendChild(locationCell);
                row.appendChild(dateAddedCell);
                row.appendChild(lastEditedCell);
                row.appendChild(postedByCell);

                tableBody.appendChild(row);
            });
        }

        // Add modal close handlers
        const modal = document.getElementById('viewJobModal');
        const closeBtn = modal?.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = () => modal.style.display = 'none';
        }

        // Close modal with Escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal?.style.display === 'block') {
                modal.style.display = 'none';
            }
        });

    } catch (error) {
        console.error("Error fetching jobs:", error);
    } finally {
        hideLoader();
    }
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

// Get initials from username
function getInitialsFromUsername(username) {
    if (!username) return 'A';
    return username.charAt(0).toUpperCase();
}

// Update the populateAdminName function
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

// Update the openJobModal function to show archived status
function openJobModal(jobData) {
    if (!viewJobModal) return;

    currentJobData = jobData;

    // Clean up all data
    const cleanCompany = jobData.company.replace(/[•·]|\s+[•·]\s+/g, '').trim();
    const cleanLocation = jobData.location.replace(/[•·]|\s+[•·]\s+/g, '').trim();

    const titleElement = viewJobModal.querySelector('.modal-job-title');
    const companyInfoSection = viewJobModal.querySelector('.modal-company-info');
    const descriptionElement = viewJobModal.querySelector('.modal-description');
    const jobTypeSpan = viewJobModal.querySelector('.modal-job-type');
    const modalHeader = viewJobModal.querySelector('.modal-header');

    // Set job title
    if (titleElement) titleElement.textContent = jobData.title;
    
    // Add archived status if job is archived
    if (modalHeader) {
        // Remove any existing archived status
        const existingStatus = viewJobModal.querySelector('.archived-status');
        if (existingStatus) {
            existingStatus.remove();
        }
        
        // Add archived status if needed
        if (jobData.archived) {
            const archivedStatus = document.createElement('div');
            archivedStatus.className = 'archived-status';
            archivedStatus.textContent = 'Archived';
            archivedStatus.style.position = 'absolute';
            archivedStatus.style.top = '15px';
            archivedStatus.style.right = '40px';
            archivedStatus.style.backgroundColor = '#d33';
            archivedStatus.style.color = 'white';
            archivedStatus.style.padding = '5px 10px';
            archivedStatus.style.borderRadius = '4px';
            archivedStatus.style.fontFamily = 'montserratSemiBold';
            archivedStatus.style.fontSize = '14px';
            archivedStatus.style.zIndex = '10';
            modalHeader.appendChild(archivedStatus);
            console.log("Added archived status to job:", jobData.title);
        }
    }
    
    if (companyInfoSection) {
        companyInfoSection.innerHTML = `
            <div class="info-item">
                <i class="fas fa-building"></i>
                <span class="modal-company">${cleanCompany}</span>
            </div>
            <div class="info-item">
                <i class="fas fa-map-marker-alt"></i>
                <span class="modal-location">${cleanLocation}</span>
            </div>
            <div class="info-item">
                <i class="fas fa-money-bill-wave"></i>
                <span class="modal-salary">${jobData.isConfidential ? ' ' : 
                    jobData.isRange ? `${formatSalary(jobData.minSalary)} - ${formatSalary(jobData.maxSalary)}` : 
                    formatSalary(jobData.salary)}</span>
            </div>
        `;
    }

    if (descriptionElement) {
        descriptionElement.innerHTML = `
            ${jobData.companyDescription ? `
                <div class="company-description-section">
                    <h3 style="font-family: interBold;">About ${cleanCompany}</h3>
                    <div class="company-description-content">${jobData.companyDescription}</div>
                </div>
            ` : ''}
            <div class="job-details-section">   
                ${jobData.description}
            </div>
        `;
    }

    if (jobTypeSpan) {
        jobTypeSpan.className = 'modal-job-type ' + jobData.typeClass;
        jobTypeSpan.textContent = jobData.type;
    }

    openModal(viewJobModal);
}

// Update the setupDeleteHandler function to just mark jobs as archived
function setupDeleteHandler() {
    const deleteButton = viewJobModal?.querySelector('.delete-button');
    if (deleteButton) {
        deleteButton.addEventListener('click', async function() {
            try {
                const result = await Swal.fire({
                    title: 'Delete Job Posting',
                    text: 'Are you sure you want to delete this job posting?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#073884',
                    confirmButtonText: 'Yes, delete it!',
                    cancelButtonText: 'Cancel',
                    allowOutsideClick: false,
                    allowEscapeKey: false
                });

                if (result.isConfirmed && currentJobData) {
                    // Update the document in Firestore to mark as archived
                    const jobRef = doc(db, "jobs", currentJobData.id);
                    await updateDoc(jobRef, {
                        archived: true,
                        archivedDate: new Date().toISOString()
                    });

                    await Swal.fire({
                        title: 'Archived!',
                        text: 'The job posting has been moved to archives.',
                        icon: 'success',
                        confirmButtonColor: '#073884',
                        allowOutsideClick: false,
                        allowEscapeKey: false
                    });

                    // Close the modal and refresh the page
                    closeModal(viewJobModal);
                    window.location.reload();
                }
            } catch (error) {
                console.error("Error archiving job: ", error);
                await Swal.fire({
                    title: 'Error!',
                    text: 'There was an error archiving the job.',
                    icon: 'error',
                    confirmButtonColor: '#073884',
                    allowOutsideClick: false,
                    allowEscapeKey: false
                });
            }
        });
    }
}

// Add the setupModalCloseHandlers function
function setupModalCloseHandlers() {
    // Close button handler
    const closeButton = viewJobModal?.querySelector('.modal-close');
    if (closeButton) {
        closeButton.addEventListener('click', function() {
            closeModal(viewJobModal);
        });
    }
    
    // Close when clicking outside the modal content
    window.addEventListener('click', function(event) {
        if (event.target === viewJobModal) {
            closeModal(viewJobModal);
        }
    });
}

// Update the displayJobDetails function to properly align the job type
function displayJobDetails(job) {
    if (!viewJobModal) return;
    
    currentJobData = job;
    
    // Set job title and add archived label if needed
    const titleElement = viewJobModal.querySelector('.modal-job-title');
    if (titleElement) {
        if (job.archived) {
            titleElement.innerHTML = `${job.title} <span class="archived-label">Archived</span>`;
        } else {
            titleElement.textContent = job.title;
        }
    }
    
    // Set job type with proper alignment
    const jobTypeElement = viewJobModal.querySelector('.modal-job-type');
    if (jobTypeElement) {
        jobTypeElement.textContent = job.type || 'Full-time';
        jobTypeElement.className = `modal-job-type ${job.type?.toLowerCase().replace(/\s+/g, '-') || 'full-time'}`;
        
        // Reset any existing styles
        jobTypeElement.style.margin = '0';
        jobTypeElement.style.padding = '4px 10px';
        jobTypeElement.style.display = 'inline-block';
        jobTypeElement.style.marginTop = '10px';
        jobTypeElement.style.marginLeft = '0';
        jobTypeElement.style.fontFamily = 'montserratSemiBold';
    }
    
    // Set company name
    const companyElement = viewJobModal.querySelector('.modal-company');
    if (companyElement) {
        companyElement.textContent = job.company || '';
    }
    
    // Set location
    const locationElement = viewJobModal.querySelector('.modal-location');
    if (locationElement) {
        locationElement.textContent = job.location || '';
    }
    
    // Set salary
    const salaryElement = viewJobModal.querySelector('.modal-salary');
    if (salaryElement) {
        salaryElement.textContent = formatSalary(job.salary) || '';
    }
    
    // Set description
    const descriptionElement = viewJobModal.querySelector('.modal-description');
    if (descriptionElement) {
        descriptionElement.innerHTML = job.description || '';
    }
    
    // Show the modal
    viewJobModal.style.display = 'block';
}

// Add CSS for the archived label and fix job type alignment
document.addEventListener('DOMContentLoaded', function() {
    // Create a style element
    const style = document.createElement('style');
    style.textContent = `
        .archived-label {
            display: inline-block;
            background-color: #d33;
            color: white;
            font-size: 14px;
            padding: 2px 8px;
            border-radius: 4px;
            margin-left: 10px;
            font-family: montserratSemiBold;
            vertical-align: middle;
        }
        
        /* Override the existing modal-job-type styles */
        #viewJobModal .modal-job-type {
            display: block !important;
            margin: 0 !important;
            padding: 5px 10px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            font-family: interRegular !important;
            margin-top: 0 !important;
            margin-left: 0 !important;
            text-align: center !important;
            width: fit-content !important;
        }
        
        /* Fix the modal title section layout */
        #viewJobModal .modal-title-section {
            display: block !important;
            align-items: flex-start !important;
            gap: 5px !important;
        }
        
        /* Ensure the job title is properly styled */
        #viewJobModal .modal-job-title {
            display: block !important;
            margin-bottom: 10px !important;
            font-family: interBold !important;
        }
        
        /* Style for different job types */
        #viewJobModal .modal-job-type.full-time {
            background-color: #e8f5e9 !important;
            color: #2e7d32 !important;
        }
        
        #viewJobModal .modal-job-type.part-time {
            background-color: #fff7e6 !important;
            color: #ff9900 !important;
        }
        
        #viewJobModal .modal-job-type.contract {
            background-color: #f6ffed !important;
            color: #52c41a !important;
        }
        
        #viewJobModal .modal-job-type.freelance {
            background-color: #f9f0ff !important;
            color: #722ed1 !important;
        }
    `;
    document.head.appendChild(style);
    
    // Remove any references to the archives button
    const archivesButton = document.querySelector('#archivesButton');
    if (archivesButton) {
        archivesButton.style.display = 'none';
    }
});

// Update the initialization function to remove setupArchivesModal
function initializeJobsPage() {
    // ... existing code ...
    
    // Setup event handlers
    setupJobRowClickHandlers();
    setupModalCloseHandlers();
    setupDeleteHandler();
    
    // ... rest of the function ...
}

// DOMContentLoaded event
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM loaded, initializing...");
    showLoader();

    try {
        // Wait for authentication state
        await new Promise((resolve) => {
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    console.log("User authenticated:", user.email);
                    try {
                        // Fetch admin data
                        const adminRef = collection(db, "admins");
                        const q = query(adminRef, where("email", "==", user.email));
                        const adminSnapshot = await getDocs(q);
                        
                        const adminDoc = adminSnapshot.docs.find(doc => {
                            const data = doc.data();
                            return data.userType === "admin" && 
                                   data.email === user.email;
                        });

                        if (adminDoc) {
                            const adminData = adminDoc.data();
                            console.log("Found admin data:", adminData);
                            populateAdminName(adminData);
                            resolve();
                        } else {
                            console.log("No matching admin found - redirecting");
                            window.location.href = 'admin_login.html';
                        }
                    } catch (error) {
                        console.error("Error fetching admin data:", error);
                        window.location.href = 'admin_login.html';
                    }
                } else {
                    window.location.href = 'admin_login.html';
                }
            });
        });

        // Initialize the modal
        viewJobModal = document.getElementById('viewJobModal');

        await initializeJobsTable();
        initializeSidebar();
        initializeDropdown();
        setupModalCloseHandlers();
        setupDeleteHandler();
    } catch (error) {
        console.error("Error:", error);
        window.location.href = 'admin_login.html';
    } finally {
        hideLoader();
    }
});

// Update the row click handler to properly display job details
function setupJobRowClickHandlers() {
    const rows = document.querySelectorAll('#jobTableBody tr');
    rows.forEach(row => {
        row.addEventListener('click', async function() {
            const jobId = this.getAttribute('data-job-id');
            if (!jobId) return;
            
            try {
                // Get the job document
                const jobRef = doc(db, "jobs", jobId);
                const jobSnap = await getDoc(jobRef);
                
                if (jobSnap.exists()) {
                    const jobData = jobSnap.data();
                    console.log("Job data:", jobData); // Debug: Log job data
                    console.log("Archived status:", jobData.archived); // Debug: Log archived status
                    
                    // Display job details in the modal
                    const modal = document.getElementById('viewJobModal');
                    if (!modal) return;
                    
                    // Store current job data for delete functionality
                    currentJobData = { id: jobId, ...jobData };
                    
                    // Update modal content
                    const titleElement = modal.querySelector('.modal-job-title');
                    const typeElement = modal.querySelector('.modal-job-type');
                    const companyInfoSection = modal.querySelector('.modal-company-info');
                    const descriptionElement = modal.querySelector('.modal-description');
                    const modalHeader = modal.querySelector('.modal-header');
                    
                    // First, update the title
                    if (titleElement) {
                        titleElement.textContent = jobData.title;
                    }
                    
                    // Add or update the archived status directly in the modal header
                    if (modalHeader) {
                        // Remove any existing archived status element
                        const existingStatus = modal.querySelector('.archived-status');
                        if (existingStatus) {
                            existingStatus.remove();
                        }
                        
                        // Create new archived status element if needed
                        if (jobData.archived) {
                            const archivedStatus = document.createElement('div');
                            archivedStatus.className = 'archived-status';
                            archivedStatus.textContent = 'Archived';
                            modalHeader.appendChild(archivedStatus);
                            console.log("Added archived status element"); // Debug
                        }
                    }
                    
                    if (typeElement) {
                        typeElement.textContent = jobData.type || 'Full Time';
                        typeElement.className = `modal-job-type ${(jobData.type || 'Full Time').toLowerCase().replace(/\s+/g, '-')}`;
                    }
                    
                    // Clean up data
                    const cleanCompany = jobData.company?.replace(/[•·]|\s+[•·]\s+/g, '').trim() || 'N/A';
                    const cleanLocation = jobData.location?.replace(/[•·]|\s+[•·]\s+/g, '').trim() || 'N/A';
                    
                    if (companyInfoSection) {
                        companyInfoSection.innerHTML = `
                            <div class="info-item">
                                <i class="fas fa-building"></i>
                                <span class="modal-company">${cleanCompany}</span>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-map-marker-alt"></i>
                                <span class="modal-location">${cleanLocation}</span>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-money-bill-wave"></i>
                                <span class="modal-salary">${jobData.isConfidential ? 'Salary Confidential' : 
                                    jobData.isRange ? `${formatSalary(jobData.minSalary)} - ${formatSalary(jobData.maxSalary)}` : 
                                    formatSalary(jobData.salary)}</span>
                            </div>
                        `;
                    }
                    
                    if (descriptionElement) {
                        descriptionElement.innerHTML = `
                            ${jobData.companyDescription ? `
                                <div class="company-description-section">
                                    <h3 style="font-family: interBold;">About ${cleanCompany}</h3>
                                    <div class="company-description-content">${jobData.companyDescription}</div>
                                </div>
                            ` : ''}
                            <div class="job-details-section">
                                ${jobData.description || ''}
                            </div>
                        `;
                    }
                    
                    // Show the modal
                    modal.style.display = 'block';
                    
                    // Double-check if the archived status is visible
                    setTimeout(() => {
                        const statusCheck = modal.querySelector('.archived-status');
                        console.log("Status element exists:", !!statusCheck); // Debug
                        if (statusCheck) {
                            console.log("Status element style:", statusCheck.style.display); // Debug
                        }
                    }, 100);
                }
            } catch (error) {
                console.error("Error fetching job details:", error);
            }
        });
    });
}

// Add CSS for the archived status element
document.addEventListener('DOMContentLoaded', function() {
    // Create a style element
    const style = document.createElement('style');
    style.textContent = `
        .archived-status {
            display: block;
            background-color: #d33;
            color: white;
            font-size: 14px;
            padding: 5px 10px;
            border-radius: 4px;
            margin-top: 5px;
            margin-bottom: 10px;
            font-family: montserratSemiBold;
            text-align: center;
            width: fit-content;
            position: absolute;
            top: 15px;
            right: 40px;
            z-index: 10; /* Ensure it's above other elements */
        }
        
        /* Override the existing modal-job-type styles */
        #viewJobModal .modal-job-type {
            display: block !important;
            margin: 0 !important;
            padding: 5px 10px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            font-family: interRegular !important;
            margin-top: 0 !important;
            margin-left: 0 !important;
            text-align: center !important;
            width: fit-content !important;
        }
        
        /* Fix the modal title section layout */
        #viewJobModal .modal-title-section {
            display: block !important;
            align-items: flex-start !important;
            gap: 5px !important;
            position: relative !important;
        }
        
        /* Ensure the job title is properly styled */
        #viewJobModal .modal-job-title {
            display: block !important;
            margin-bottom: 10px !important;
            font-family: interBold !important;
            padding-right: 100px !important; /* Make room for the archived status */
        }
        
        /* Make sure the modal header has position relative for absolute positioning */
        #viewJobModal .modal-header {
            position: relative !important;
        }
    `;
    document.head.appendChild(style);
    
    // Remove any references to the archives button
    const archivesButton = document.querySelector('#archivesButton');
    if (archivesButton) {
        archivesButton.style.display = 'none';
    }
}); 