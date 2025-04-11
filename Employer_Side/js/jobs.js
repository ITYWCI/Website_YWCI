import {
    initializePage,
    auth,
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
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    query,
    where,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
let currentEmployerId = null;

async function getCurrentEmployerId() {
try {
    // Wait for auth state to be ready
    await new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe(); // Stop listening immediately
            resolve(user);
        });
    });

    const user = auth.currentUser;
    if (!user) {
        console.log("No user currently logged in");
        return null;
    }

    console.log("Current user email:", user.email); // Debug log

    const employersRef = collection(db, "employers");
    const q = query(employersRef, where("email", "==", user.email.toLowerCase()));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
        const employerId = querySnapshot.docs[0].data().employerId;
        console.log("Found employer ID:", employerId); // Debug log
        return employerId;
    }
    console.log("No employer found for email:", user.email); // Debug log
    return null;
} catch (error) {
    console.error("Error getting employer ID:", error);
    return null;
}
}

function hideLoader() {
const loader = document.getElementById('loadingOverlay');
if (loader) {
    loader.classList.add('hidden');
}
}

async function initializeJobs() {
try {
    // Wait for all data loading functions
    await populateUserNav();
    await loadJobsFromStorage();
    filterJobs();

    // Check if we should open the add job modal
    const shouldOpenAddModal = sessionStorage.getItem('openAddJobModal');
    if (shouldOpenAddModal === 'true') {
        sessionStorage.removeItem('openAddJobModal'); // Clear the flag
        const addJobModal = document.getElementById('addJobModal');
        if (addJobModal) {
            openModal(addJobModal);
        }
    }

    // Hide loader after everything is loaded
    hideLoader();
} catch (error) {
    console.error("Error initializing jobs:", error);
    hideLoader(); // Hide loader even on error
}
}

document.addEventListener('DOMContentLoaded', () => {
// Save current URL if not on login page
if (!window.location.pathname.includes('login.html')) {
    sessionStorage.setItem('lastVisitedUrl', window.location.pathname);
}

// Clear lastPage if we're not on the jobs page
if (!window.location.pathname.includes('jobs.html')) {
    sessionStorage.removeItem('lastPage');
}

initializePage(initializeJobs);
});

// Add this to handle page unload
window.addEventListener('beforeunload', () => {
// Clear lastPage when leaving the page
if (window.location.pathname.includes('jobs.html')) {
    sessionStorage.removeItem('lastPage');
}
});

// Separate function to handle pagination updates
function updatePagination(page) {
    const jobsPerPage = 10;
    const visibleJobs = document.querySelectorAll('.job-card[data-visible="true"]');
    const totalPages = Math.ceil(visibleJobs.length / jobsPerPage) || 1; // Ensure at least 1 page
    
    // Maintain the requested page unless it exceeds total pages
    currentPage = (page > totalPages) ? totalPages : page;

    // Calculate start and end indices
    const startIndex = (currentPage - 1) * jobsPerPage;
    const endIndex = startIndex + jobsPerPage;

    // Show only the jobs for current page
    visibleJobs.forEach((card, index) => {
        card.style.display = (index >= startIndex && index < endIndex) ? '' : 'none';
    });

    // Update pagination controls
    updatePaginationControls(totalPages);
}

// Update pagination controls
function updatePaginationControls(totalPages) {
const paginationContainer = document.getElementById('paginationContainer');
if (!paginationContainer) return;

let paginationHTML = `
    <button class="pagination-btn prev-btn" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
`;

for (let i = 1; i <= totalPages; i++) {
    paginationHTML += `
        <button class="pagination-btn page-btn ${i === currentPage ? 'active' : ''}">${i}</button>
    `;
}

paginationHTML += `
    <button class="pagination-btn next-btn" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
`;

// Only update if content is different
if (paginationContainer.innerHTML !== paginationHTML) {
    paginationContainer.innerHTML = paginationHTML;

    // Add event listeners once
    paginationContainer.querySelectorAll('.pagination-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const lastPage = currentPage; // Store the last page before changing

            if (this.classList.contains('prev-btn') && currentPage > 1) {
                currentPage = lastPage - 1;
                sessionStorage.setItem('lastPage', currentPage);
                updatePagination(currentPage);
            } else if (this.classList.contains('next-btn') && currentPage < totalPages) {
                currentPage = lastPage + 1;
                sessionStorage.setItem('lastPage', currentPage);
                updatePagination(currentPage);
            } else if (this.classList.contains('page-btn')) {
                currentPage = parseInt(this.textContent);
                sessionStorage.setItem('lastPage', currentPage);
                updatePagination(currentPage);
            }
        });
    });
}
}


//Start of Filter Jobs
// Filter function
async function filterJobs() {
    try {
        // Get current employer ID first
        currentEmployerId = await getCurrentEmployerId();
        console.log("Filtering jobs for employerId:", currentEmployerId);

        if (!currentEmployerId) {
            console.error("No employer ID found");
            return;
        }

        // Get the last known page from session storage
        const lastKnownPage = parseInt(sessionStorage.getItem('lastPage')) || currentPage;
        
        const searchInput = document.getElementById('searchInput');
        const jobTypeFilter = document.getElementById('jobTypeFilter');
        const locationFilter = document.getElementById('locationFilter');
        const salaryTypeFilter = document.getElementById('salaryTypeFilter');
        
        const searchTerm = searchInput.value.toLowerCase();
        const selectedType = jobTypeFilter.value.toLowerCase();
        const selectedLocation = locationFilter.value.toLowerCase();
        const selectedSalaryType = salaryTypeFilter.value.toLowerCase();
        
        // Get the noResultsMessage element
        const noResultsMessage = document.getElementById('noResultsMessage');
        if (noResultsMessage) noResultsMessage.style.display = 'none';
        
        let visibleJobs = 0;
    
        document.querySelectorAll('.job-card').forEach(card => {
            const title = card.querySelector('.job-title').textContent.toLowerCase();
            const typeElement = card.querySelector('.job-type');
            const location = card.querySelector('.job-location').textContent.toLowerCase();
            const company = card.querySelector('.job-company').textContent.toLowerCase();
            const description = card.querySelector('.job-description').textContent.toLowerCase();
            const salaryType = card.querySelector('.job-salary-sub').textContent.toLowerCase();
    
            let type = '';
            if (typeElement) {
                if (typeElement.classList.contains('full-time')) type = 'full time';
                else if (typeElement.classList.contains('part-time')) type = 'part time';
                else if (typeElement.classList.contains('probational')) type = 'probational';
                else if (typeElement.classList.contains('contractual')) type = 'contractual';
            }
    
            // Determine salary type
            let salaryTypeMatch = true;
            if (selectedSalaryType) {
                const salaryElement = card.querySelector('.job-salary-sub');
                const salaryText = salaryElement ? salaryElement.textContent.trim() : '';
                
                if (selectedSalaryType === 'confidential') {
                    // Check if salary is confidential (empty or just spaces)
                    salaryTypeMatch = salaryText === ' ' || salaryText === '';
                } else if (selectedSalaryType === 'range') {
                    // Check if salary is a range (contains a dash)
                    salaryTypeMatch = salaryText.includes('-');
                } else if (selectedSalaryType === 'fixed') {
                    // Check if salary is fixed (not confidential and not a range)
                    salaryTypeMatch = salaryText !== ' ' && salaryText !== '' && !salaryText.includes('-');
                }
            }
    
            // Check if the card matches all filters
            const matchesSearch = !searchTerm || 
                title.includes(searchTerm) || 
                company.includes(searchTerm) || 
                description.includes(searchTerm);
            const matchesType = !selectedType || type === selectedType;
            const matchesLocation = !selectedLocation || location.includes(selectedLocation);
    
            // Show/hide card based on filter matches
            if (matchesSearch && matchesType && matchesLocation && salaryTypeMatch) {
                card.style.display = '';
                card.setAttribute('data-visible', 'true');
                visibleJobs++;
            } else {
                card.style.display = 'none';
                card.setAttribute('data-visible', 'false');
            }
        });
    
        // Only show noResultsMessage if we have jobs but none are visible after filtering
        const totalJobs = document.querySelectorAll('.job-card').length;
        if (totalJobs > 0 && visibleJobs === 0) {
            if (noResultsMessage) noResultsMessage.style.display = 'block';
        }
        
        // Update pagination with new visible jobs count
        updatePagination(lastKnownPage);
        
    } catch (error) {
        console.error("Error filtering jobs:", error);
    }
}
//End of Filter Jobs


// Make sure getDocs is available in the scope where loadJobsFromStorage is defined
async function loadJobsFromStorage() { //This is a duplicate of the second function in
try {
    const querySnapshot = await getDocs(collection(db, "jobs"));
    const jobs = [];
    querySnapshot.forEach((doc) => {
        jobs.push({
            id: doc.id,
            ...doc.data()
        });
    });
    
} catch (error) {
    console.error("Error loading jobs: ", error);
    alert('Error loading jobs. Please refresh the page.');
}
}
//End of Load Jobs From Storage

//Add this variable at the top of your file to track current page
let currentPage = 1;

function handleCompanyInput() {
const companyInput = document.getElementById('company');
const otherCompanyCheckbox = document.getElementById('otherCompany');
const defaultCompany = "Yes We Can Manpower Services";

// Set initial state
companyInput.value = defaultCompany;
companyInput.disabled = true;

// Add event listener for checkbox
otherCompanyCheckbox.addEventListener('change', function() {
    if (this.checked) {
        companyInput.disabled = false;
        companyInput.value = ''; // Clear the input when enabling
        companyInput.focus(); // Optional: automatically focus the input
    } else {
        companyInput.disabled = true;
        companyInput.value = defaultCompany;
    }
});
}

function resetCompanyField() {
const companyInput = document.getElementById('company');
const otherCompanyCheckbox = document.getElementById('otherCompany');
const defaultCompany = "Yes We Can Manpower Services";

// Reset to initial state
otherCompanyCheckbox.checked = false;
companyInput.disabled = true;
companyInput.value = defaultCompany;
}

//Start of Filter Jobs
document.addEventListener('DOMContentLoaded', function() {
handleCompanyInput();

const otherCompanyCheckbox = document.getElementById('otherCompany');
const companyInput = document.getElementById('company');
const defaultCompany = "Yes We Can Manpower Services";

otherCompanyCheckbox.addEventListener('change', function() {
    if (this.checked) {
        companyInput.disabled = false;
        companyInput.value = ''; 
        companyInput.focus(); 
    } else {
        companyInput.disabled = true;
        companyInput.disabled = true;
        companyInput.value = defaultCompany;
    }
});
// Get all filter elements
const searchInput = document.getElementById('searchInput');
const jobTypeFilter = document.getElementById('jobTypeFilter');
const locationFilter = document.getElementById('locationFilter');
const minSalary = document.getElementById('minSalary');
const maxSalary = document.getElementById('maxSalary');
const resetButton = document.getElementById('resetFilters');
const resetFilterButton = document.getElementById('clearFiltersBtn');
const salaryTypeFilter = document.getElementById('salaryTypeFilter');

// Add event listeners
searchInput.addEventListener('input', filterJobs);
jobTypeFilter.addEventListener('change', filterJobs);
locationFilter.addEventListener('change', filterJobs);
salaryTypeFilter.addEventListener('change', filterJobs);

// Populate location filter with unique locations (sorted alphabetically)
const locations = new Set();
document.querySelectorAll('.job-location').forEach(location => {
    locations.add(location.textContent.trim());
});

// Convert Set to Array, sort it, and populate the select
Array.from(locations)
    .sort((a, b) => a.localeCompare(b))
    .forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        locationFilter.appendChild(option);
    });

// Reset button handlers
resetButton.addEventListener('click', function(e) {
    e.preventDefault();
    
    // Get the last known page
    const lastKnownPage = parseInt(sessionStorage.getItem('lastPage')) || currentPage;
    
    // Clear all filters
    searchInput.value = '';
    jobTypeFilter.value = '';
    locationFilter.value = '';
    salaryTypeFilter.value = '';
    
    // Run filter and force the last known page
    filterJobs();
    updatePagination(lastKnownPage);
});
resetFilterButton.addEventListener('click', function(e) {
    e.preventDefault();
    
    // Get the last known page
    const lastKnownPage = parseInt(sessionStorage.getItem('lastPage')) || currentPage;
    
    // Clear all filters
    searchInput.value = '';
    jobTypeFilter.value = '';
    locationFilter.value = '';
    salaryTypeFilter.value = '';
    
    // Run filter and force the last known page
    filterJobs();
    updatePagination(lastKnownPage);
});

// Add transition for smooth filtering
const style = document.createElement('style');
style.textContent = `
    .job-card {
        transition: opacity 0.3s ease-in-out;
    }
`;
document.head.appendChild(style);
});
//End of Filter Jobs

//Start of Undo/Redo    
// Initialize undo/redo stacks
const editor = document.getElementById('editor');
let undoStack = [''];
let redoStack = [];
let isUndoRedo = false;

// Make all functions globally available
window.getParentList = function(node) {
while (node && node !== editor) {
    if (node.nodeName === 'UL' || node.nodeName === 'OL') {
        return node;
    }
    node = node.parentNode;
}
return null;
}
//End of Get Parent List

//Start of Get Current List Type
window.getCurrentListType = function() {
const selection = window.getSelection();
const node = selection.anchorNode;
const list = getParentList(node);

if (!list) return null;
if (list.nodeName === 'OL') return 'number';
if (list.className === 'dash') return 'dash';
return 'bullet';
}
//End of Get Current List Type

//Start of Update List Buttons
window.updateListButtons = function() {
const currentType = getCurrentListType();
document.getElementById('bulletBtn')?.classList.toggle('active', currentType === 'bullet');
document.getElementById('numberBtn')?.classList.toggle('active', currentType === 'number');
document.getElementById('dashBtn')?.classList.toggle('active', currentType === 'dash');
}
//End of Update List Buttons

//Start of Format Text
window.formatText = function(command) {
document.execCommand(command, false, null);
if (!isUndoRedo) {
    undoStack.push(editor.innerHTML);
    redoStack = [];
}
editor.focus();
}
//End of Format Text

//Start of Toggle List
window.toggleList = function(type) {
const currentType = getCurrentListType();

// If current type matches clicked type, remove the list
if (currentType === type) {
    if (type === 'number') {
        document.execCommand('insertOrderedList', false, null);
    } else {
        document.execCommand('insertUnorderedList', false, null);
    }
    updateListButtons();
    if (!isUndoRedo) {
        undoStack.push(editor.innerHTML);
        redoStack = [];
    }
    return;
}

// If there's a different type of list, first remove it
if (currentType) {
    if (currentType === 'number') {
        document.execCommand('insertOrderedList', false, null);
    } else {
        document.execCommand('insertUnorderedList', false, null);
    }
}

// Apply the new list type
if (type === 'number') {
    document.execCommand('insertOrderedList', false, null);
} else {
    document.execCommand('insertUnorderedList', false, null);
    const list = getParentList(window.getSelection().anchorNode);
    if (list) {
        list.className = type === 'dash' ? 'dash' : '';
    }
}

updateListButtons();
if (!isUndoRedo) {
    undoStack.push(editor.innerHTML);
    redoStack = [];
}
editor.focus();
}
//End of Toggle List

//Start of Perform Undo
window.performUndo = function() {
if (undoStack.length > 1) {
    isUndoRedo = true;
    redoStack.push(undoStack.pop());
    editor.innerHTML = undoStack[undoStack.length - 1];
    isUndoRedo = false;
}
}
//End of Perform Undo

//Start of Perform Redo
window.performRedo = function() {
if (redoStack.length > 0) {
    isUndoRedo = true;
    const state = redoStack.pop();
    undoStack.push(state);
    editor.innerHTML = state;
    isUndoRedo = false;
}
}
//End of Perform Redo

//Start of Add Event Listeners
if (editor) {
editor.addEventListener('input', function(e) {
    if (!isUndoRedo) {
        undoStack.push(editor.innerHTML);
        redoStack = [];
    }
    updateListButtons();
});

document.addEventListener('selectionchange', updateListButtons);
}
//End of Add Event Listeners

//Start of Keyboard Shortcuts
// Add keyboard shortcuts
document.addEventListener('keydown', function(e) {
if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
        case 'z':
            e.preventDefault();
            if (e.shiftKey) {
                performRedo();
            } else {
                performUndo();
            }
            break;
        case 'y':
            e.preventDefault();
            performRedo();
            break;
        case 'b':
            e.preventDefault();
            formatText('bold');
            break;
        case 'i':
            e.preventDefault();
            formatText('italic');
            break;
        case 'u':
            e.preventDefault();
            formatText('underline');
            break;
    }
}
});
//End of Keyboard Shortcuts

//Start of Add CSS for Styling
const editorStyles = document.createElement('style');
editorStyles.textContent = `
#editor ul {
    list-style-type: disc;
    margin-left: 20px;
    padding-left: 20px;
}

#editor ol {
    list-style-type: decimal;
    margin-left: 20px;
    padding-left: 20px;
}

#editor ul.dash {
    list-style-type: none;
}

#editor ul.dash li {
    position: relative;
    padding-left: 20px;
}

#editor ul.dash li:before {
    content: "-";
    position: absolute;
    left: 0;
}

.toolbar button.active {
    background-color: #e0e0e0;
}
.job-description ul {
    list-style-type: disc;
    margin-left: 10px;
    padding-left: 20px;
}
.job-description ol {
    list-style-type: disc;
    margin-left: 10px;
    padding-left: 20px;
}

`;
document.head.appendChild(editorStyles);

// Initialize editor when page loads
window.onload = function() {
if (editor) {
    undoStack = [editor.innerHTML];
    updateListButtons();
}
};
//End of Add CSS for Styling

//Start of Job Modal
document.addEventListener('DOMContentLoaded', function() {
// Modal setup
const addJobModal = document.getElementById('addJobModal');
const viewJobModal = document.getElementById('viewJobModal');
const addButton = document.getElementById('addJobBtn');
const uploadButton = document.querySelector('.submit-btn');
const closeButtons = document.querySelectorAll('.close, .cancel-btn, .modal-close');
const jobForm = document.getElementById('jobForm');
const deleteButton = document.querySelector('.delete-button');
const editButton = document.querySelector('.edit-button');
const submitButton = document.querySelector('.submit-btn');
const locationFilter = document.getElementById('locationFilter');
let currentJobData = null;
let isEditing = false;
let editingJobIndex = -1;

// Salary input validation
const salaryConfidentialCheckbox = document.getElementById('salaryConfidential');
const salaryRangeCheckbox = document.getElementById('salaryRange');
const singleSalaryInput = document.getElementById('singleSalaryInput');
const rangeSalaryInputs = document.getElementById('rangeSalaryInputs');
const salaryInput = document.getElementById('salary');
const minSalaryInput = document.getElementById('minSalary');
const maxSalaryInput = document.getElementById('maxSalary');

handleSalaryInputs();
setupPagination();

// Function to format salary with commas
function formatSalary(value) {
if (!value) return '₱0';
// Remove any existing commas and the peso sign
const numericValue = value.toString().replace(/[₱,]/g, '');
// Format with commas
return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Function to format the default salary input field
function formatSalaryInput(input) {
let value = input.value.replace(/[^0-9]/g, '');
if (value) {
    value = parseInt(value, 10).toLocaleString('en-US');
}
input.value = value;
}

// Function to validate salary range
async function validateSalaryRange() {
const salaryRangeCheckbox = document.getElementById('salaryRange');
const jobMinSalary = document.getElementById('jobMinSalary');
const jobMaxSalary = document.getElementById('jobMaxSalary');

if (salaryRangeCheckbox?.checked && jobMinSalary && jobMaxSalary) {
    // Remove commas and convert to numbers
    const minValue = Number(jobMinSalary.value.replace(/,/g, ''));
    const maxValue = Number(jobMaxSalary.value.replace(/,/g, ''));
    
    if (minValue >= maxValue) {
        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                title: 'Invalid Salary Range',
                text: 'Minimum salary cannot be greater than or equal to maximum salary.',
                icon: 'error',
                confirmButtonColor: '#073884',
                allowOutsideClick: false,
                allowEscapeKey: false
            });
        } else {
            alert('Minimum salary cannot be greater than or equal to maximum salary');
        }
        return false;
    }
}
return true;
}

// Function to handle salary inputs
function handleSalaryInputs() {
const salaryConfidentialCheckbox = document.getElementById('salaryConfidential');
const salaryRangeCheckbox = document.getElementById('salaryRange');
const singleSalaryInput = document.getElementById('singleSalaryInput');
const rangeSalaryInputs = document.getElementById('rangeSalaryInputs');
const salary = document.getElementById('salary');
const jobMinSalary = document.getElementById('jobMinSalary');
const jobMaxSalary = document.getElementById('jobMaxSalary');

// Function to format and clean input
function formatAndCleanInput(input) {
    // Remove all non-numeric characters
    let value = input.value.replace(/[^0-9]/g, '');
    // Format with commas if there's a value
    if (value) {
        value = parseInt(value).toLocaleString('en-US');
    }
    input.value = value;
}

// Add input event listeners for salary inputs
[jobMinSalary, jobMaxSalary].forEach(input => {
    if (input) {
        // Prevent non-numeric input
        input.addEventListener('keypress', (e) => {
            if (!/^\d$/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete') {
                e.preventDefault();
            }
        });

        // Format on input
        input.addEventListener('input', () => formatAndCleanInput(input));

        // Handle paste event
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const numericValue = pastedText.replace(/\D/g, '');
            if (numericValue) {
                input.value = parseInt(numericValue).toLocaleString('en-US');
            }
        });
    }
});

// Handle confidential checkbox
salaryConfidentialCheckbox?.addEventListener('change', function() {
const isConfidential = this.checked;
const isRange = salaryRangeCheckbox?.checked || false;

// If range is not checked, disable the single salary input
if (!isRange) {
    const salarySingleInput = document.getElementById('salary');
    if (salarySingleInput) salarySingleInput.disabled = isConfidential;
}

// Only disable min/max inputs if confidential is checked AND range is not checked
if (isConfidential && !isRange) {
    if (jobMinSalary) {
        jobMinSalary.disabled = true;
        jobMinSalary.value = '';
    }
    if (jobMaxSalary) {
        jobMaxSalary.disabled = true;
        jobMaxSalary.value = '';
    }
}

// Clear single salary value if confidential
if (isConfidential) {
    if (document.getElementById('salary')) document.getElementById('salary').value = '';
}
});

// Handle salary range checkbox
salaryRangeCheckbox?.addEventListener('change', function() {
const isRange = this.checked;
const singleSalaryInput = document.getElementById('singleSalaryInput');
const rangeSalaryInputs = document.getElementById('rangeSalaryInputs');

// Toggle visibility of appropriate input sections
if (singleSalaryInput) singleSalaryInput.style.display = isRange ? 'none' : 'block';
if (rangeSalaryInputs) rangeSalaryInputs.style.display = isRange ? 'block' : 'none';

// IMPORTANT: Always enable min/max inputs when range is checked
if (isRange) {
    if (jobMinSalary) jobMinSalary.disabled = false;
    if (jobMaxSalary) jobMaxSalary.disabled = false;
    
    // Clear single salary value
    if (document.getElementById('salary')) document.getElementById('salary').value = '';
} else {
    // Clear min/max values when switching to single
    if (jobMinSalary) jobMinSalary.value = '';
    if (jobMaxSalary) jobMaxSalary.value = '';
    
    // Check if we need to disable single input based on confidential state
    const isConfidential = salaryConfidentialCheckbox?.checked || false;
    const salarySingleInput = document.getElementById('salary');
    if (salarySingleInput && isConfidential) salarySingleInput.disabled = true;
}
});

}

// Add input event listeners for salary formatting
if (salaryInput) {
    salaryInput.addEventListener('input', () => formatSalaryInput(salaryInput));
    salaryInput.addEventListener('focus', function() {
        this.value = this.value.replace(/,/g, '');
    });
    salaryInput.addEventListener('blur', function() {
        formatSalaryInput(this);
    });
}

if (minSalaryInput) {
    minSalaryInput.addEventListener('input', () => formatSalaryInput(minSalaryInput));
    minSalaryInput.addEventListener('focus', function() {
        this.value = this.value.replace(/,/g, '');
    });
    minSalaryInput.addEventListener('blur', function() {
        formatSalaryInput(this);
    });
}

if (maxSalaryInput) {
    maxSalaryInput.addEventListener('input', () => formatSalaryInput(maxSalaryInput));
    maxSalaryInput.addEventListener('focus', function() {
        this.value = this.value.replace(/,/g, '');
    });
    maxSalaryInput.addEventListener('blur', function() {
        formatSalaryInput(this);
    });
}

// Handle salary confidential checkbox
if (salaryConfidentialCheckbox) {
    salaryConfidentialCheckbox.addEventListener('change', function() {
        if (this.checked) {
            salaryRangeCheckbox.checked = false;
            salaryInput.disabled = true;
            salaryInput.value = '';
            salaryInput.placeholder = 'Confidential'; // Change placeholder text to "Confidential" when checkbox is checked
            rangeSalaryInputs.style.display = 'none';
            singleSalaryInput.style.display = 'block';
            minSalaryInput.value = '';
            maxSalaryInput.value = '';
        } else {
            salaryInput.disabled = false;
            salaryInput.placeholder = 'Enter rate'; // Reset placeholder text to "Enter rate" when checkbox is unchecked
        }
    });
}

// Handle salary range checkbox
if (salaryRangeCheckbox) {
    salaryRangeCheckbox.addEventListener('change', function() {
        if (this.checked) {
            salaryConfidentialCheckbox.checked = false;
            singleSalaryInput.style.display = 'none';
            rangeSalaryInputs.style.display = 'block';
            salaryInput.value = '';
            minSalaryInput.disabled = false;
            maxSalaryInput.disabled = false;
        } else {
            singleSalaryInput.style.display = 'block';
            rangeSalaryInputs.style.display = 'none';
            minSalaryInput.value = '';
            maxSalaryInput.value = '';
        }
    });
}

function getSalaryData() {
const salaryConfidentialCheckbox = document.getElementById('salaryConfidential');
const salaryRangeCheckbox = document.getElementById('salaryRange');
const salaryInput = document.getElementById('salary');
const jobMinSalary = document.getElementById('jobMinSalary');
const jobMaxSalary = document.getElementById('jobMaxSalary');

// First handle confidential case
if (salaryConfidentialCheckbox?.checked) {
    return {
        isConfidential: true,
        isRange: false,
        salary: 0,
        minSalary: 0,
        maxSalary: 0
    };
}

// Handle salary range case
if (salaryRangeCheckbox?.checked) {
    // Remove peso sign, commas and convert to number for range values
    const minSalary = Number(jobMinSalary.value.replace(/[₱,]/g, ''));
    const maxSalary = Number(jobMaxSalary.value.replace(/[₱,]/g, ''));
    
    return {
        isConfidential: false,
        isRange: true,
        salary: 0,
        minSalary: minSalary,
        maxSalary: maxSalary
    };
}

// Handle single salary case
const salary = Number(salaryInput.value.replace(/[₱,]/g, ''));
return {
    isConfidential: false,
    isRange: false,
    salary: salary,
    minSalary: 0,
    maxSalary: 0
};
}

// Keep the salary input event listeners
if (salaryInput) {
salaryInput.addEventListener('input', function(e) {
    // Remove any non-numeric characters
    let value = this.value.replace(/[^0-9]/g, '');

    // Format the number with commas
    if (value) {
        value = parseInt(value, 10).toLocaleString('en-US');
    }

    // Update the input value
    this.value = value;
});

// Prevent non-numeric key presses
salaryInput.addEventListener('keypress', function(e) {
    if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete') {
        e.preventDefault();
    }
});

// Clean up value when focus is lost
salaryInput.addEventListener('blur', function() {
    let value = this.value.replace(/[^0-9]/g, '');
    if (value) {
        value = parseInt(value, 10).toLocaleString('en-US');
        this.value = value;
    }
});

// Remove commas when focus is gained
salaryInput.addEventListener('focus', function() {
    this.value = this.value.replace(/,/g, '');
});
}

//Start of Format Salary
// Function to format salary with peso sign and commas
function formatSalary(value) {
if (!value && value !== 0) return '₱0';
return '₱' + value.toLocaleString('en-US');
}

// Function to format salary input field with peso sign
function formatSalaryInput(input) {
let value = input.value.replace(/[^0-9]/g, '');
if (value) {
    value = '₱' + parseInt(value, 10).toLocaleString('en-US');
}
input.value = value;
}

// Add input event listeners for salary formatting
[salaryInput, minSalaryInput, maxSalaryInput].forEach(input => {
if (input) {
    input.addEventListener('input', () => formatSalaryInput(input));
    
    // Remove commas when focus is gained
    input.addEventListener('focus', function() {
        this.value = this.value.replace(/,/g, '');
    });
    
    // Format with commas when focus is lost
    input.addEventListener('blur', function() {
        formatSalaryInput(this);
    });
}
});

// Handle salary confidential checkbox
salaryConfidentialCheckbox.addEventListener('change', function() {
if (this.checked) {
    salaryRangeCheckbox.checked = false;
    salaryInput.disabled = true;
    salaryInput.value = '';
    salaryInput.placeholder = 'Confidential'; // Change placeholder text to "Confidential" when checkbox is checked
    rangeSalaryInputs.style.display = 'none';
    singleSalaryInput.style.display = 'block';
    minSalaryInput.value = '';
    maxSalaryInput.value = '';
} else {
    salaryInput.disabled = false;
    salaryInput.placeholder = 'Enter rate'; // Reset placeholder text to "Enter rate" when checkbox is unchecked
}
});

// Handle salary range checkbox
salaryRangeCheckbox.addEventListener('change', function() {
if (this.checked) {
    salaryConfidentialCheckbox.checked = false;
    singleSalaryInput.style.display = 'none';
    rangeSalaryInputs.style.display = 'block';
    salaryInput.value = '';
    minSalaryInput.disabled = false;
    maxSalaryInput.disabled = false;
} else {
    singleSalaryInput.style.display = 'block';
    rangeSalaryInputs.style.display = 'none';
    minSalaryInput.value = '';
    maxSalaryInput.value = '';
}
});

//Start of Add Click Handlers to All Job Cards
const jobCards = document.querySelectorAll('.job-card');
jobCards.forEach(card => {
    card.addEventListener('click', function() {
        const latestJob = getLatestJobFromStorage();
        if (latestJob) {
            openJobModal(latestJob);
        }
    });
});
//End of Add Click Handlers to All Job Cards

//Start of Modal Functions
function openModal(modal) {
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}
//End of Open Modal

//Start of Close Modal          
function closeModal(modal) {
    if (modal) {
        const modalContent = modal.querySelector('.modal-content');
        const modalBackdrop = modal;
        
        if (modalContent) {
            modalContent.style.animation = 'slideOut 0.3s ease-out forwards';
            modalBackdrop.style.backgroundColor = 'rgba(0, 0, 0, 0)';
        }
        
        setTimeout(() => {
            modal.style.display = 'none';
            if (modalContent) {
                modalContent.style.animation = '';
            }
            modalBackdrop.style.backgroundColor = '';
            document.body.style.overflow = 'auto';

            // Clear the editor and form if it's the add job modal
            if (modal === addJobModal) {
                const modalTitle = modal.querySelector('.modal-header h2');
                if (modalTitle) {
                    modalTitle.textContent = 'Add a Job';
                }

                if (editor) {
                    editor.innerHTML = '';
                }
                if (jobForm) {
                    jobForm.reset();
                }
                if (submitButton) {
                    submitButton.textContent = 'Upload Job';
                    isEditing = false;
                    editingJobIndex = -1;
                }
            }
        }, 300);
    }
}
//End of Close Modal

function getFormattedLocation() {
    const region = document.getElementById('region');
    const province = document.getElementById('province');
    const city = document.getElementById('city');

    // Check if elements exist
    if (!region || !city) return '';

    // For Metro Manila (special case)
    if (region.value === '130000000') {
        return `${city.options[city.selectedIndex].text}, Metro Manila`;
    }

    // For other regions
    return `${city.options[city.selectedIndex].text}, ${province.options[province.selectedIndex].text}, ${region.options[region.selectedIndex].text}`;
}

// Populate location filter with unique locations
function populateLocationFilter() {
    const jobs = [];
    const locationFilter = document.getElementById('locationFilter');

    // Get all unique locations from job cards
    const locations = new Set();
    locations.add(''); // Add empty option for "All Locations"

    document.querySelectorAll('.job-location').forEach(locationElement => {
        if (locationElement.textContent) {
            locations.add(locationElement.textContent.trim());
        }
    });

    // Get the current selected value
    const currentValue = locationFilter.value;

    // Clear existing options
    locationFilter.innerHTML = '';

    // Add "All Locations" option
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All Locations';
    locationFilter.appendChild(allOption);

    // Add options to select
    Array.from(locations)
        .sort((a, b) => a.localeCompare(b))
        .forEach(location => {
            if (location) { // Skip empty location
                const option = document.createElement('option');
                option.value = location;
                option.textContent = location;
                locationFilter.appendChild(option);
            }
        });

    // Restore the selected value
    locationFilter.value = currentValue;
}
//End of Populate Location Filter   

// Add event listener for location filter
if (locationFilter) {
    locationFilter.addEventListener('change', filterJobs);
}

// Load jobs when page loads
loadJobsFromStorage();

// Add Job button click handler
if (addButton) {
    addButton.addEventListener('click', function() {
        // Reset company field
        const companyInput = document.getElementById('company');
        const otherCompanyCheckbox = document.getElementById('otherCompany');
        const defaultCompany = "Yes We Can Manpower Services";

        // Set initial state
        otherCompanyCheckbox.checked = false;
        companyInput.disabled = true;
        companyInput.value = defaultCompany;

        // Open modal
        openModal(addJobModal);
    });
}

// Close buttons click handlers
closeButtons.forEach(button => {
    button.addEventListener('click', function() {
        const modal = this.closest('.modal');
        closeModal(modal);
    });
});

// Close modal on escape key    
window.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        if (addJobModal.style.display === 'block') {
            closeModal(addJobModal);
        }
        if (viewJobModal.style.display === 'block') {
            closeModal(viewJobModal);
        }
    }
});
//End of Close Modal on Escape Key

// Modify delete functionality
if (deleteButton) {
    deleteButton.addEventListener('click', async function() {
        try {
            let confirmed = false;

            if (typeof Swal !== 'undefined') {
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
                confirmed = result.isConfirmed;
            } else {
                confirmed = window.confirm('Are you sure you want to delete this job posting?');
            }

            if (confirmed && currentJobData) {
                // Update the document in Firestore to mark as archived
                const jobRef = doc(db, "jobs", currentJobData.id);
                await updateDoc(jobRef, {
                    archived: true,
                    archivedDate: new Date().toISOString() // Optional: track when it was archived
                });

                // Show success message
                if (typeof Swal !== 'undefined') {
                    await Swal.fire({
                        title: 'Archived!',
                        text: 'The job posting has been moved to archives instead of deleting it. You can choose to restore it anytime or delete it permanently via the archives tab.',
                        icon: 'success',
                        confirmButtonColor: '#073884',
                        allowOutsideClick: false,
                        allowEscapeKey: false
                    });
                } else {
                    alert('The job posting has been moved to archives.');
                }

                // Close the modal and refresh the page
                closeModal(viewJobModal);
                window.location.reload();
            }
        } catch (error) {
            console.error("Error archiving job: ", error);
            if (typeof Swal !== 'undefined') {
                await Swal.fire({
                    title: 'Error!',
                    text: 'There was an error archiving the job. Please try again.',
                    icon: 'error',
                    confirmButtonColor: '#073884',
                    allowOutsideClick: false,
                    allowEscapeKey: false
                });
            } else {
                alert('There was an error archiving the job. Please try again.');
            }
        }
    });
}
//End of Modify Delete Functionality

document.addEventListener('DOMContentLoaded', function() {
    const archivesButton = document.querySelector('#archivesButton');
    const archivesModal = document.getElementById('archivesModal');
    const selectAllBtn = document.getElementById('selectAllArchives');
    let isAllSelected = false;
    
    if (archivesButton && archivesModal) {
        // Function to reset selection and disable buttons
        function resetSelectionAndButtons() {
            const rows = document.querySelectorAll('#archivesTableBody tr');
            const restoreBtn = document.querySelector('.action-buttons .restore-btn');
            const deleteBtn = document.querySelector('.action-buttons .delete-btn');
            
            rows.forEach(r => r.classList.remove('selected'));
            restoreBtn.disabled = true;
            deleteBtn.disabled = true;
            if (selectAllBtn) {
                selectAllBtn.innerHTML = '<i class="fas fa-check-square"></i> Select All';
                isAllSelected = false;
            }
        }

        // Add select all functionality
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                const rows = document.querySelectorAll('#archivesTableBody tr');
                const restoreBtn = document.querySelector('.action-buttons .restore-btn');
                const deleteBtn = document.querySelector('.action-buttons .delete-btn');
                
                isAllSelected = !isAllSelected;
                
                rows.forEach(row => {
                    if (!row.querySelector('td[colspan="3"]')) { // Skip the "No archived jobs found" row
                        row.classList.toggle('selected', isAllSelected);
                    }
                });
                
                restoreBtn.disabled = !isAllSelected;
                deleteBtn.disabled = !isAllSelected;
                
                selectAllBtn.innerHTML = isAllSelected ? 
                    '<i class="fas fa-square"></i> Deselect All' : 
                    '<i class="fas fa-check-square"></i> Select All';
            });
        }

        archivesButton.addEventListener('click', async function(e) {
            e.preventDefault();
            try {
                // Get current employer ID first
                currentEmployerId = await getCurrentEmployerId();
                if (!currentEmployerId) {
                    console.error("No employer ID found");
                    await Swal.fire({
                        title: 'Error!',
                        text: 'Could not verify employer account.',
                        icon: 'error',
                        confirmButtonColor: '#073884',
                        allowOutsideClick: false,
                        allowEscapeKey: false
                    });
                    return;
                }

                console.log("Loading archives for employer:", currentEmployerId); // Added console log

                const jobsRef = collection(db, "jobs");
                const q = query(jobsRef, 
                    where("employerId", "==", currentEmployerId),
                    where("archived", "==", true)
                );
                const querySnapshot = await getDocs(q);
                
                const archivesTableBody = document.getElementById('archivesTableBody');
                if (archivesTableBody) {
                    archivesTableBody.innerHTML = '';
                    
                    if (querySnapshot.empty) {
                        archivesTableBody.innerHTML = `
                            <tr>
                                <td colspan="3" style="text-align: center; padding: 20px; font-family: interRegular;">
                                    No archived jobs found
                                </td>
                            </tr>
                        `;
                        if (selectAllBtn) selectAllBtn.style.display = 'none'; // Hide select all button when no items
                    } else {
                        if (selectAllBtn) selectAllBtn.style.display = 'block'; // Show select all button
                        querySnapshot.forEach((doc) => {
                            const job = doc.data();
                            const row = document.createElement('tr');
                            row.setAttribute('data-id', doc.id);
                            row.innerHTML = `
                                <td style="font-family: interRegular;">${job.title || ''}</td>
                                <td style="font-family: interRegular;">${job.company || ''}</td>
                                <td style="font-family: interRegular;">${job.location || ''}</td>
                            `;
                            archivesTableBody.appendChild(row);
                        });

                        // Modify row click event to allow multiple selection
                        const rows = archivesTableBody.querySelectorAll('tr');
                        const restoreBtn = document.querySelector('.action-buttons .restore-btn');
                        const deleteBtn = document.querySelector('.action-buttons .delete-btn');

                        rows.forEach(row => {
                            row.addEventListener('click', function(e) {
                                e.stopPropagation();
                                this.classList.toggle('selected');
                                
                                // Update buttons based on any selection
                                const anySelected = archivesTableBody.querySelectorAll('tr.selected').length > 0;
                                restoreBtn.disabled = !anySelected;
                                deleteBtn.disabled = !anySelected;
                                
                                // Update select all button state
                                const allSelected = Array.from(rows).every(r => r.classList.contains('selected'));
                                if (selectAllBtn) {
                                    selectAllBtn.innerHTML = allSelected ? 
                                        '<i class="fas fa-square"></i> Deselect All' : 
                                        '<i class="fas fa-check-square"></i> Select All';
                                    isAllSelected = allSelected;
                                }
                            });
                        });

                        // Click event for the modal content to unselect
                        const modalContent = archivesModal.querySelector('.modal-content');
                        modalContent.addEventListener('click', function(e) {
                            if (e.target === modalContent) {
                                resetSelectionAndButtons();
                            }
                        });

                        // Restore button functionality
                        restoreBtn.addEventListener('click', async function(e) {
                            e.stopPropagation();
                            const selectedRows = archivesTableBody.querySelectorAll('tr.selected');
                            if (!selectedRows.length) return;

                            try {
                                const result = await Swal.fire({
                                    title: 'Restore Jobs?',
                                    text: selectedRows.length > 1 ? 
                                        'These jobs will be restored to active listings.' : 
                                        'This job will be restored to active listings.',
                                    icon: 'question',
                                    showCancelButton: true,
                                    confirmButtonColor: '#073884',
                                    cancelButtonColor: '#d33',
                                    confirmButtonText: 'Yes, restore!',
                                    cancelButtonText: 'Cancel',
                                    allowOutsideClick: false,
                                    allowEscapeKey: false
                                });

                                if (result.isConfirmed) {
                                    // Create an array of promises for batch update
                                    const updatePromises = Array.from(selectedRows).map(row => {
                                        const jobId = row.getAttribute('data-id');
                                        const jobRef = doc(db, "jobs", jobId);
                                        return updateDoc(jobRef, {
                                            archived: false
                                        });
                                    });

                                    await Promise.all(updatePromises);
                                    
                                    await Swal.fire({
                                        title: 'Restored!',
                                        text: selectedRows.length > 1 ? 
                                            'The jobs have been restored.' : 
                                            'The job has been restored.',
                                        icon: 'success',
                                        confirmButtonColor: '#073884',
                                        allowOutsideClick: false,
                                        allowEscapeKey: false
                                    });
                                    
                                    window.location.reload();
                                }
                            } catch (error) {
                                console.error("Error restoring jobs:", error);
                                Swal.fire({
                                    title: 'Error!',
                                    text: 'Error restoring the selected jobs.',
                                    icon: 'error',
                                    confirmButtonColor: '#073884',
                                    allowOutsideClick: false,
                                    allowEscapeKey: false
                                });
                            }
                        });

                        // Delete button functionality
                        deleteBtn.addEventListener('click', async function(e) {
                            e.stopPropagation();
                            const selectedRows = archivesTableBody.querySelectorAll('tr.selected');
                            if (!selectedRows.length) return;

                            try {
                                // First confirmation - warning
                                const firstResult = await Swal.fire({
                                    title: 'Delete Permanently?',
                                    text: selectedRows.length > 1 ? 
                                        'This action cannot be undone!' : 
                                        'This action cannot be undone!',
                                    icon: 'warning',
                                    showCancelButton: true,
                                    confirmButtonColor: '#d33',
                                    cancelButtonColor: '#073884',
                                    confirmButtonText: 'Continue',
                                    cancelButtonText: 'Cancel',
                                    allowOutsideClick: false,
                                    allowEscapeKey: false
                                });
                                if (firstResult.isConfirmed) {
                                    // Second confirmation - error for emphasis
                                    const finalResult = await Swal.fire({
                                        title: 'Final Confirmation',
                                        text: selectedRows.length > 1 ? 
                                            'Are you sure? This will permanently delete these job listings.' : 
                                            'Are you sure? This will permanently delete this job listing.',
                                        icon: 'error',
                                        showCancelButton: true,
                                        confirmButtonColor: '#d33',
                                        cancelButtonColor: '#073884',
                                        confirmButtonText: 'Yes, I understand',
                                        cancelButtonText: 'Cancel',
                                        allowOutsideClick: false,
                                        allowEscapeKey: false
                                    });

                                    if (finalResult.isConfirmed) {
                                        // Create an array of promises for batch delete
                                        const deletePromises = Array.from(selectedRows).map(row => {
                                            const jobId = row.getAttribute('data-id');
                                            const jobRef = doc(db, "jobs", jobId);
                                            return deleteDoc(jobRef);
                                        });

                                        await Promise.all(deletePromises);
                                        
                                        await Swal.fire({
                                            title: 'Deleted!',
                                            text: selectedRows.length > 1 ? 
                                                'The jobs have been permanently deleted.' : 
                                                'The job has been permanently deleted.',
                                            icon: 'success',
                                            confirmButtonColor: '#073884',
                                            allowOutsideClick: false,
                                            allowEscapeKey: false
                                        });
                                        
                                        selectedRows.forEach(row => row.remove());
                                        resetSelectionAndButtons();
                                    }
                                }
                            } catch (error) {
                                console.error("Error deleting jobs:", error);
                                Swal.fire({
                                    title: 'Error!',
                                    text: 'Error deleting the selected jobs.',
                                    icon: 'error',
                                    confirmButtonColor: '#073884',
                                    allowOutsideClick: false,
                                    allowEscapeKey: false
                                });
                            }
                        });
                    }
                }
                
                archivesModal.style.display = 'block';
            } catch (error) {
                console.error("Error loading archives:", error);
                if (error.code) {
                    Swal.fire({
                        title: 'Error!',
                        text: 'Error loading archived jobs.',
                        icon: 'error',
                        confirmButtonColor: '#073884',
                        allowOutsideClick: false,
                        allowEscapeKey: false
                    });
                }
            }
        });

        // Close button handler
        const closeButton = archivesModal.querySelector('.close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                archivesModal.style.display = 'none';
                resetSelectionAndButtons();
            });
        }
    }
});

async function initializeLocationDropdowns(locationString) {
    try {
        console.log("Initializing with location:", locationString);

        if (!locationString) return;

        const locationParts = locationString.split(',').map(part => part.trim());
        console.log("Location parts:", locationParts);

        const cityName = locationParts[0];
        const provinceName = locationParts[1];
        const regionName = locationParts[2];
        const isNCR = locationParts[1] === 'Metro Manila';

        const regionSelect = document.getElementById('region');
        const provinceSelect = document.getElementById('province');
        const citySelect = document.getElementById('city');

        // First load regions
        const regionsResponse = await fetch('https://psgc.gitlab.io/api/regions/');
        const regions = await regionsResponse.json();

        // Populate regions
        regionSelect.innerHTML = '<option value="">Select Region</option>';
        regions.sort((a, b) => a.name.localeCompare(b.name)).forEach(region => {
            const option = new Option(region.name, region.code);
            if (isNCR && region.code === '130000000' || region.name === regionName) {
                option.selected = true;
            }
            regionSelect.add(option);
        });

        if (isNCR) {
            // Handle NCR case
            provinceSelect.innerHTML = '<option value="ncr">Metro Manila</option>';
            provinceSelect.disabled = true;

            const ncrResponse = await fetch('https://psgc.gitlab.io/api/regions/130000000/cities-municipalities/');
            const ncrCities = await ncrResponse.json();

            citySelect.innerHTML = '<option value="">Select City</option>';
            ncrCities.sort((a, b) => a.name.localeCompare(b.name)).forEach(city => {
                const option = new Option(city.name, city.code);
                if (city.name === cityName) {
                    option.selected = true;
                }
                citySelect.add(option);
            });
            citySelect.disabled = false;
        } else {
            // Handle non-NCR case
            const selectedRegion = Array.from(regionSelect.options)
                .find(option => option.text === regionName);

            if (selectedRegion) {
                // Fetch provinces for selected region
                const provincesResponse = await fetch(`https://psgc.gitlab.io/api/regions/${selectedRegion.value}/provinces/`);
                const provinces = await provincesResponse.json();

                // Populate provinces
                provinceSelect.innerHTML = '<option value="">Select Province</option>';
                provinceSelect.disabled = false;
                provinces.sort((a, b) => a.name.localeCompare(b.name)).forEach(province => {
                    const option = new Option(province.name, province.code);
                    if (province.name === provinceName) {
                        option.selected = true;
                    }
                    provinceSelect.add(option);
                });

                // Find selected province
                const selectedProvince = Array.from(provinceSelect.options)
                    .find(option => option.text === provinceName);

                if (selectedProvince) {
                    // Fetch cities for selected province
                    const citiesResponse = await fetch(`https://psgc.gitlab.io/api/provinces/${selectedProvince.value}/cities-municipalities/`);
                    const cities = await citiesResponse.json();

                    // Populate cities
                    citySelect.innerHTML = '<option value="">Select City</option>';
                    citySelect.disabled = false;
                    cities.sort((a, b) => a.name.localeCompare(b.name)).forEach(city => {
                        const option = new Option(city.name, city.code);
                        if (city.name === cityName) {
                            option.selected = true;
                        }
                        citySelect.add(option);
                    });
                }
            }
        }

        console.log("Final selections:", {
            region: regionSelect.selectedOptions[0]?.text,
            province: provinceSelect.selectedOptions[0]?.text,
            city: citySelect.selectedOptions[0]?.text
        });

    } catch (error) {
        console.error("Error initializing location dropdowns:", error);
        console.error("Error details:", error.message);
    }
}
//End of Initialize Location Dropdowns


//Ensures cities are properly loaded
async function loadNCRCities(selectedCity) {
    try {
        const response = await fetch('https://psgc.gitlab.io/api/regions/130000000/cities-municipalities/');
        const cities = await response.json();
        const citySelect = document.getElementById('city');

        citySelect.innerHTML = '<option value="">Select City</option>';
        cities.sort((a, b) => a.name.localeCompare(b.name)).forEach(city => {
            const option = new Option(city.name, city.code);
            if (city.name === selectedCity) {
                option.selected = true;
            }
            citySelect.add(option);
        });
        citySelect.disabled = false;

        return true;
    } catch (error) {
        console.error("Error loading NCR cities:", error);
        return false;
    }
}

// Add this new function to handle location dropdown population
async function populateLocationDropdowns(locationString) {
    if (!locationString) return;

    const locationParts = locationString.split(',').map(part => part.trim());
    const cityName = locationParts[0];

    // Check if it's NCR
    const isNCR = locationParts[1] === 'Metro Manila';

    const regionSelect = document.getElementById('region');
    const provinceSelect = document.getElementById('province');
    const citySelect = document.getElementById('city');

    // For NCR
    if (isNCR) {
        // Find NCR in region dropdown
        for (let option of regionSelect.options) {
            if (option.text === 'National Capital Region') {
                option.selected = true;
                await fetchProvinces(option.value);
                await fetchNCRCities();

                // Wait for cities to load
                await new Promise(resolve => setTimeout(resolve, 500));

                // Select the city
                for (let option of citySelect.options) {
                    if (option.text === cityName) {
                        option.selected = true;
                        break;
                    }
                }
                break;
            }
        }
    } else {
        // For other regions
        const regionName = locationParts[2];
        const provinceName = locationParts[1];

        // Select region
        for (let option of regionSelect.options) {
            if (option.text === regionName) {
                option.selected = true;
                await fetchProvinces(option.value);
                break;
            }
        }

        // Wait for provinces to load
        await new Promise(resolve => setTimeout(resolve, 500));

        // Select province
        for (let option of provinceSelect.options) {
            if (option.text === provinceName) {
                option.selected = true;
                await fetchCities(option.value);
                break;
            }
        }

        // Wait for cities to load
        await new Promise(resolve => setTimeout(resolve, 500));

        // Select city
        for (let option of citySelect.options) {
            if (option.text === cityName) {
                option.selected = true;
                break;
            }
        }
    }
}

// Upload button handler
if (uploadButton) {
uploadButton.addEventListener('click', async function(e) {
    e.preventDefault();

    try {
        // Get current employer ID first
        currentEmployerId = await getCurrentEmployerId();
        if (!currentEmployerId) {
            await Swal.fire({
                title: 'Error!',
                text: 'Could not verify employer account.',
                icon: 'error',
                confirmButtonColor: '#073884',
                allowOutsideClick: false,
                allowEscapeKey: false
            });
            return;
        }

        // Get form values
        const jobTitle = document.getElementById('jobTitle').value;
        const company = document.getElementById('company').value;
        const jobType = document.getElementById('job-type').value;
        const description = editor.innerHTML;
        const companyDescription = document.getElementById('companyDescription').value;

        // Get location values
        const region = document.getElementById('region').value;
        const province = document.getElementById('province').value;
        const city = document.getElementById('city').value;

        // Validate location fields first
        if (!region || !province || !city) {
            await Swal.fire({
                title: 'Location fields are missing',
                text: 'Please select all location fields (Region, Province, and City)',
                icon: 'error',
                confirmButtonColor: '#073884',
                allowOutsideClick: false,
                allowEscapeKey: false
            });
            return;
        }

        // Validate other required fields
        if (!jobTitle || !company || !jobType || !description) {
            await Swal.fire({
                title: 'Some fields are missing',
                text: 'Please fill in all required fields',
                icon: 'error',
                confirmButtonColor: '#073884',
                allowOutsideClick: false,
                allowEscapeKey: false
            });
            return;
        }

        // Get salary elements
        const salaryConfidentialCheckbox = document.getElementById('salaryConfidential');
        const salaryRangeCheckbox = document.getElementById('salaryRange');
        const salaryInput = document.getElementById('salary');
        const minSalary = document.getElementById('jobMinSalary');
        const maxSalary = document.getElementById('jobMaxSalary');

        // Validate salary fields
        if (!salaryConfidentialCheckbox.checked) {
            if (salaryRangeCheckbox.checked) {
                const minValue = Number(minSalary.value.replace(/[₱,]/g, ''));
                const maxValue = Number(maxSalary.value.replace(/[₱,]/g, ''));

                if (!minSalary.value || !maxSalary.value || minValue === 0 || maxValue === 0) {
                    await Swal.fire({
                        title: 'Validation Error',
                        html: 'Salary cannot be empty or zero.<br>Select confidential instead.',
                        icon: 'error',
                        confirmButtonColor: '#073884',
                        allowOutsideClick: false,
                        allowEscapeKey: false
                    });
                    return;
                }

                // Validate salary range
                if (minValue > 1000 || maxValue > 1000) {
                    const isRangeValid = await validateSalaryAmount(Math.max(minValue, maxValue));
                    if (!isRangeValid) return;
                }

                if (minValue >= maxValue) {
                    await Swal.fire({
                        title: 'Validation Error',
                        text: 'Minimum salary must be less than maximum salary',
                        icon: 'error',
                        confirmButtonColor: '#073884',
                        allowOutsideClick: false,
                        allowEscapeKey: false
                    });
                    return;
                }
            } else {
                const salaryValue = Number(salaryInput.value.replace(/[₱,]/g, ''));
                if (!salaryInput.value || salaryValue === 0) {
                    await Swal.fire({
                        title: 'Validation Error',
                        html: 'Salary cannot be empty or zero.<br>Select confidential instead.',
                        icon: 'error',
                        confirmButtonColor: '#073884',
                        allowOutsideClick: false,
                        allowEscapeKey: false
                    });
                    return;
                }

                // Validate fixed salary
                if (salaryValue > 1000) {
                    const isSalaryValid = await validateSalaryAmount(salaryValue);
                    if (!isSalaryValid) return;
                }
            }
        }

        // Prepare salary data
        let salaryData = getSalaryData();

        // Create job data object
        const jobData = {
            title: jobTitle,
            company: company,
            companyDescription: companyDescription,
            location: getFormattedLocation(),
            description: description,
            type: getJobTypeDisplay(jobType),
            typeClass: jobType,
            timestamp: isEditing ? currentJobData.timestamp : serverTimestamp(),
            employerId: currentEmployerId,
            archived: false,
            ...salaryData
        };

        // Add lastEdited timestamp if editing
        if (isEditing) {
            jobData.lastEdited = serverTimestamp();
        }

        // Show confirmation dialog
        const confirmMessage = isEditing ? 
            'Are you sure you want to update this job posting?' : 
            'Are you sure you want to post this job?';

        const result = await Swal.fire({
            title: isEditing ? 'Confirm Update' : 'Confirm Post',
            text: confirmMessage,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#073884',
            confirmButtonText: isEditing ? 'Yes, update it!' : 'Yes, post it!',
            cancelButtonText: 'Cancel',
            allowOutsideClick: false, // Add this line
            allowEscapeKey: false // Add this line
        });

        if (result.isConfirmed) {
            // Save to database
            if (isEditing) {
                const jobRef = doc(db, "jobs", currentJobData.id);
                await updateDoc(jobRef, {
                    ...jobData,
                    employerId: currentEmployerId // Ensure employerId is included in updates
                });
            } else {
                await addDoc(collection(db, "jobs"), jobData);
            }

            await Swal.fire({
                title: 'Success!',
                text: isEditing ? 'Job posting has been updated.' : 'Job has been posted successfully.',
                icon: 'success',
                confirmButtonColor: '#073884',
                allowOutsideClick: false,
                allowEscapeKey: false
            });

            resetForm();
            closeModal(addJobModal);
            window.location.reload();
        }
    } catch (error) {
        console.error("Error saving job: ", error);
        await Swal.fire({
            title: 'Error!',
            text: 'There was an error saving the job. Please try again.',
            icon: 'error',
            confirmButtonColor: '#073884',
            allowOutsideClick: false,
            allowEscapeKey: false
        });
    }
});
}

// Edit button handler
if (editButton) {
editButton.addEventListener('click', async function() {
    if (currentJobData) {
        try {
            // Change modal title to "Edit Job"
            const modalTitle = document.querySelector('#addJobModal .modal-header h2');
            if (modalTitle) {
                modalTitle.textContent = 'Edit Job';
            }

            // Fill the form with current job data
            document.getElementById('jobTitle').value = currentJobData.title;
            const companyInput = document.getElementById('company');
            const otherCompanyCheckbox = document.getElementById('otherCompany');
            const defaultCompany = "Yes We Can Manpower Services";

            if (currentJobData.company === defaultCompany) {
                otherCompanyCheckbox.checked = false;
                companyInput.disabled = true;
                companyInput.value = defaultCompany;
            } else {
                otherCompanyCheckbox.checked = true;
                companyInput.disabled = false;
                companyInput.value = currentJobData.company;
            }

            document.getElementById('job-type').value = currentJobData.typeClass;
            document.getElementById('company').value = currentJobData.company;
            document.getElementById('job-type').value = currentJobData.typeClass;
            
            // Set company description
            const companyDescriptionField = document.getElementById('companyDescription');
            if (companyDescriptionField) {
                companyDescriptionField.value = currentJobData.companyDescription || '';
            }
            
            editor.innerHTML = currentJobData.description;

            // Get salary elements
            const salaryConfidentialCheckbox = document.getElementById('salaryConfidential');
            const salaryRangeCheckbox = document.getElementById('salaryRange');
            const salaryInput = document.getElementById('salary');
            const jobMinSalary = document.getElementById('jobMinSalary');
            const jobMaxSalary = document.getElementById('jobMaxSalary');
            const singleSalaryInput = document.getElementById('singleSalaryInput');
            const rangeSalaryInputs = document.getElementById('rangeSalaryInputs');

            // Handle salary data properly
            if (currentJobData.isConfidential) {
                salaryConfidentialCheckbox.checked = true;
                salaryRangeCheckbox.checked = false;
                // Keep inputs visible but disabled
                singleSalaryInput.style.display = 'block';
                rangeSalaryInputs.style.display = 'none';
                
                if (salaryInput) {
                    salaryInput.value = '';
                    salaryInput.disabled = true;
                    salaryInput.placeholder = 'Confidential';
                }
                if (jobMinSalary) {
                    jobMinSalary.value = '';
                    jobMinSalary.disabled = true;
                }
                if (jobMaxSalary) {
                    jobMaxSalary.value = '';
                    jobMaxSalary.disabled = true;
                }
            } else if (currentJobData.isRange) {
                salaryConfidentialCheckbox.checked = false;
                salaryRangeCheckbox.checked = true;
                singleSalaryInput.style.display = 'none';
                rangeSalaryInputs.style.display = 'block';
                
                if (salaryInput) {
                    salaryInput.value = '';
                    salaryInput.disabled = false;
                }
                if (jobMinSalary && currentJobData.minSalary) {
                    jobMinSalary.value = Number(currentJobData.minSalary).toLocaleString('en-US');
                    jobMinSalary.disabled = false;
                }
                if (jobMaxSalary && currentJobData.maxSalary) {
                    jobMaxSalary.value = Number(currentJobData.maxSalary).toLocaleString('en-US');
                    jobMaxSalary.disabled = false;
                }
            } else {
                salaryConfidentialCheckbox.checked = false;
                salaryRangeCheckbox.checked = false;
                singleSalaryInput.style.display = 'block';
                rangeSalaryInputs.style.display = 'none';
                
                if (salaryInput && currentJobData.salary) {
                    let salaryValue = currentJobData.salary;
                    if (typeof salaryValue === 'string') {
                        salaryValue = salaryValue.replace(/[₱,]/g, '');
                    }
                    salaryInput.value = Number(salaryValue).toLocaleString('en-US');
                    salaryInput.disabled = false;
                }
                if (jobMinSalary) {
                    jobMinSalary.value = '';
                    jobMinSalary.disabled = false;
                }
                if (jobMaxSalary) {
                    jobMaxSalary.value = '';
                    jobMaxSalary.disabled = false;
                }
            }

            // Add event listener for confidential checkbox
            salaryConfidentialCheckbox.addEventListener('change', function() {
                const isConfidential = this.checked;
                
                // Enable/disable salary inputs based on confidential status
                if (salaryInput) {
                    salaryInput.disabled = isConfidential;
                    if (!isConfidential) {
                        salaryInput.value = '';
                    }
                    if (isConfidential) {
                        salaryInput.placeholder = 'Confidential';
                    } else {
                        salaryInput.placeholder = 'Enter rate';
                    }
                }
                if (jobMinSalary) {
                    jobMinSalary.disabled = isConfidential;
                    if (!isConfidential) {
                        jobMinSalary.value = '';
                    }
                }
                if (jobMaxSalary) {
                    jobMaxSalary.disabled = isConfidential;
                    if (!isConfidential) {
                        jobMaxSalary.value = '';
                    }
                }
            });

            // Initialize location dropdowns
            await initializeLocationDropdowns(currentJobData.location);

            // Validate location after initialization
            const region = document.getElementById('region').value;
            const province = document.getElementById('province').value;
            const city = document.getElementById('city').value;

            if (!region || !province || !city) {
                await Swal.fire({
                    title: 'Location Error',
                    text: 'Unable to load location data. Please try again.',
                    icon: 'error',
                    confirmButtonColor: '#073884',
                    allowOutsideClick: false,
                    allowEscapeKey: false
                });
                return;
            }

            // Change upload button text
            submitButton.textContent = 'Apply Changes';
            isEditing = true;

            // Close view modal and open add modal
            closeModal(viewJobModal);
            openModal(addJobModal);

        } catch (error) {
            console.error("Error in edit button handler:", error);
            await Swal.fire({
                title: 'Error!',
                text: 'Error loading job data for editing. Please try again.',
                icon: 'error',
                confirmButtonColor: '#073884',
                allowOutsideClick: false,
                allowEscapeKey: false
            });
        }
    }
});
}

// Function for relative time (for upload date)
function formatTimeAgo(timestamp) {
if (!timestamp || !timestamp.toDate) {
    return 'Date not available';
}

const date = timestamp.toDate();
const now = new Date();
const seconds = Math.floor((now - date) / 1000);
const minutes = Math.floor(seconds / 60);
const hours = Math.floor(minutes / 60);
const days = Math.floor(hours / 24);

if (seconds < 60) {
    return 'just now';
} else if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
} else if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
} else if (days < 7) {
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
} else {
    return formatFullDate(timestamp);
}
}

// Function for full date format (for last edited date)
function formatFullDate(timestamp) {
if (!timestamp || !timestamp.toDate) {
    return 'Date not available';
}

const date = timestamp.toDate();
const months = ['January', 'February', 'March', 'April', 'May', 'June', 
               'July', 'August', 'September', 'October', 'November', 'December'];

const month = months[date.getMonth()];
const day = date.getDate();
const year = date.getFullYear();
const hours = date.getHours() % 12 || 12;
const minutes = date.getMinutes().toString().padStart(2, '0');
const ampm = date.getHours() >= 12 ? 'pm' : 'am';

return `${month} ${day}, ${year} | ${hours}:${minutes} ${ampm}`;
}



// Update only the upload timestamps every minute
setInterval(() => {
document.querySelectorAll('.job-time-added').forEach((timeElement, index) => {
    if (window.allJobs && window.allJobs[index]) {
        timeElement.textContent = `Uploaded ${formatTimeAgo(window.allJobs[index].timestamp)}`;
    }
});
}, 60000); // Update every minute

// Function to reset the job form
function resetForm() {
const jobForm = document.getElementById('jobForm');
const editor = document.querySelector('.editor');
const salaryInput = document.getElementById('salary');
const jobMinSalary = document.getElementById('jobMinSalary');
const jobMaxSalary = document.getElementById('jobMaxSalary');
const salaryConfidentialCheckbox = document.getElementById('salaryConfidential');
const salaryRangeCheckbox = document.getElementById('salaryRange');
const singleSalaryInput = document.getElementById('singleSalaryInput');
const rangeSalaryInputs = document.getElementById('rangeSalaryInputs');
const companyDescription = document.getElementById('companyDescription');
if (companyDescription) companyDescription.value = '';

// Reset the form
if (jobForm) jobForm.reset();

// Reset the editor
if (editor) editor.innerHTML = '';

// Reset salary inputs
if (salaryInput) salaryInput.value = '';
if (jobMinSalary) jobMinSalary.value = '';
if (jobMaxSalary) jobMaxSalary.value = '';

// Reset checkboxes
if (salaryConfidentialCheckbox) salaryConfidentialCheckbox.checked = false;
if (salaryRangeCheckbox) salaryRangeCheckbox.checked = false;

// Reset salary input visibility
if (singleSalaryInput) singleSalaryInput.style.display = 'block';
if (rangeSalaryInputs) rangeSalaryInputs.style.display = 'none';

// Reset location dropdowns
const region = document.getElementById('region');
const province = document.getElementById('province');
const city = document.getElementById('city');

if (region) region.selectedIndex = 0;
if (province) {
    province.selectedIndex = 0;
    province.disabled = true;
}
if (city) {
    city.selectedIndex = 0;
    city.disabled = true;
}

// Reset any validation states or error messages if they exist
const errorMessages = document.querySelectorAll('.error-message');
errorMessages.forEach(error => error.remove());

// Reset the submit button text if it was changed
const submitButton = document.getElementById('uploadButton');
if (submitButton) submitButton.textContent = 'Upload Job';
}


// Update the addJobCardToPage function to handle potential missing data
function addJobCardToPage(jobData) {
    const container = document.querySelector('.container');
    const newJobCard = document.createElement('div');
    newJobCard.className = 'job-card';

    // Format rate display
    let rateDisplay;
    if (jobData.isConfidential) {
        salaryDisplay = ' ';
    } else if (jobData.isRange) {
        salaryDisplay = `₱${jobData.minSalary.toLocaleString('en-US')} - ₱${jobData.maxSalary.toLocaleString('en-US')} (Daily Rate)`;
    } else {
        salaryDisplay = `₱${jobData.salary.toLocaleString('en-US')} (Daily Rate)`;
    }

    // Clean up all data
    const cleanCompany = jobData.company.replace(/[•·]|\s+[•·]\s+/g, '').trim();
    const cleanLocation = jobData.location.replace(/[•·]|\s+[•·]\s+/g, '').trim();

    newJobCard.innerHTML = `
    <div class="job-header">
        <h2 class="job-title">${jobData.title}</h2>
        <span class="job-type ${jobData.typeClass}">${jobData.type}</span>
    </div>
    <div class="job-details">
        <div class="info-group">
            <div class="info-item">
                <i class="fas fa-building"></i>
                <span class="job-company">${cleanCompany}</span>
            </div>
            <div class="info-item">
                <i class="fas fa-map-marker-alt"></i>
                <span class="job-location">${cleanLocation}</span>
            </div>
            <div class="salary-item">
                <span class="job-salary-sub">${salaryDisplay}</span>
            </div>
        </div>
    </div>
    <div class="job-description">${jobData.description}</div>
    <div class="timestamp-container">
        ${jobData.lastEdited ? `<p class="job-last-edited">Last Edited ${formatFullDate(jobData.lastEdited)}</p>` : ''}
        <p class="job-time-added">Uploaded ${formatTimeAgo(jobData.timestamp)}</p>
    </div>
`;

    // Add click event to new job card
    newJobCard.addEventListener('click', () => {
        openJobModal(jobData);
    });

    const timeElement = card.querySelector('.job-time-added');
    if (timeElement) {
        timeElement.textContent = `Uploaded ${formatTimeAgo(jobData.timestamp)}`;
    }

    const lastEditedElement = card.querySelector('.job-last-edited');
    if (lastEditedElement && jobData.lastEdited) {
        lastEditedElement.textContent = `Last Edited ${formatTimeAgo(jobData.lastEdited)}`;
    }

    // Insert at the beginning of the container (after header)
    const headerText = document.getElementById('headerText-Job');
    const noResultsMessage = document.getElementById('noResultsMessage');

    if (headerText && headerText.nextSibling) {
        container.insertBefore(newJobCard, noResultsMessage);
    } else {
        container.appendChild(newJobCard);
    }

    // Remove existing pagination if it exists
    const existingPagination = document.getElementById('paginationContainer');
    if (existingPagination) {
        existingPagination.remove();
    }

    // Update location filter options
    populateLocationFilter();

    // Call setupPagination after adding the job card
    setupPagination();
}

// Update your job card creation or display function
function addJobCardToPage(jobData) {
const container = document.querySelector('.container');
const newJobCard = document.createElement('div');
newJobCard.className = 'job-card';

// Format salary display
let salaryDisplay;
if (jobData.isConfidential) {
    salaryDisplay = ' ';
} else if (jobData.isRange) {
    salaryDisplay = `₱${jobData.minSalary.toLocaleString('en-US')} - ₱${jobData.maxSalary.toLocaleString('en-US')} (Daily Rate)`;
} else {
    salaryDisplay = `₱${jobData.salary.toLocaleString('en-US')} (Daily Rate)`;
}

// Clean up all data
const cleanCompany = jobData.company.replace(/[•·]|\s+[•·]\s+/g, '').trim();
const cleanLocation = jobData.location.replace(/[•·]|\s+[•·]\s+/g, '').trim();

newJobCard.innerHTML = `
<div class="job-header">
    <h2 class="job-title">${jobData.title}</h2>
    <span class="job-type ${jobData.typeClass}">${jobData.type}</span>
</div>
<div class="job-details">
    <div class="info-group">
        <div class="info-item">
            <i class="fas fa-building"></i>
            <span class="job-company">${cleanCompany}</span>
        </div>
        <div class="info-item">
            <i class="fas fa-map-marker-alt"></i>
            <span class="job-location">${cleanLocation}</span>
        </div>
        <div class="salary-item">
            <span class="job-salary-sub">${salaryDisplay}</span>
        </div>
    </div>
</div>
<div class="job-description">${jobData.description}</div>
<div class="timestamp-container">
    ${jobData.lastEdited ? `<p class="job-last-edited">Last Edited ${formatFullDate(jobData.lastEdited)}</p>` : ''}
    <p class="job-time-added">Uploaded ${formatTimeAgo(jobData.timestamp)}</p>
</div>
`;

// Add click event to new job card
newJobCard.addEventListener('click', () => {
    openJobModal(jobData);
});

// Insert at the beginning of the container (after header)
const headerText = document.getElementById('headerText-Job');
const noResultsMessage = document.getElementById('noResultsMessage');

if (headerText && headerText.nextSibling) {
    container.insertBefore(newJobCard, noResultsMessage);
} else {
    container.appendChild(newJobCard);
}

// Remove existing pagination if it exists
const existingPagination = document.getElementById('paginationContainer');
if (existingPagination) {
    existingPagination.remove();
}

// Update location filter options
populateLocationFilter();

// Call setupPagination after adding the job card
setupPagination();
}

// Update loadJobsFromStorage to include better error handling
async function loadJobsFromStorage() {
    try {
        // Get current employer ID first
        currentEmployerId = await getCurrentEmployerId();
        console.log("Loading jobs for employerId:", currentEmployerId);

        if (!currentEmployerId) {
            console.error("No employer ID found");
            return;
        }

        const jobsRef = collection(db, "jobs");
        const q = query(jobsRef, 
            where("employerId", "==", currentEmployerId),
            where("archived", "in", [false, null])  // This will match both false and missing archived field
        );
        
        const querySnapshot = await getDocs(q);
        const jobs = []; // Define the jobs array here
        
        console.log("Query results:", {
            totalJobs: querySnapshot.size,
            employerId: currentEmployerId
        });
        
        querySnapshot.forEach((doc) => {
            const jobData = doc.data();
            jobs.push({
                id: doc.id,
                ...jobData,
                title: jobData.title || '',
                company: jobData.company || '',
                location: jobData.location || '',
                salary: jobData.salary || '₱0',
                description: jobData.description || '',
                type: jobData.type || '',
                typeClass: jobData.typeClass || '',
                timestamp: jobData.timestamp || Date.now()
            });
            console.log("Found job:", {
                id: doc.id,
                employerId: jobData.employerId,
                title: jobData.title,
                archived: jobData.archived
            });
        });

        const noDataFound = document.getElementById('noDataFound');
        const noResultsMessage = document.getElementById('noResultsMessage');
        const container = document.querySelector('.container');

        // Show/hide "No jobs yet!" message based on jobs array
        if (jobs.length === 0) {
            if (noDataFound) noDataFound.style.display = 'block';
            if (noResultsMessage) noResultsMessage.style.display = 'none';
            return;
        }

        // Hide the messages if there are jobs found
        if (noDataFound) noDataFound.style.display = 'none';
        if (noResultsMessage) noResultsMessage.style.display = 'none';

        // Sort jobs by timestamp (newest first)
        jobs.sort((a, b) => b.timestamp - a.timestamp);

        // Clear existing job cards
        const existingCards = document.querySelectorAll('.job-card');
        existingCards.forEach(card => card.remove());

        // Add sorted jobs to page
        jobs.forEach(jobData => {
            try {
                addJobCardToPage(jobData);
            } catch (error) {
                console.error("Error adding job card:", error, jobData);
            }
        });

        // Update timestamps every minute
        setInterval(() => {
            document.querySelectorAll('.job-time-added').forEach((timeElement, index) => {
                if (window.allJobs && window.allJobs[index]) {
                    timeElement.textContent = `Uploaded ${formatTimeAgo(window.allJobs[index].timestamp)}`;
                }
            });
        
            document.querySelectorAll('.job-last-edited').forEach((timeElement, index) => {
                if (window.allJobs && window.allJobs[index] && window.allJobs[index].lastEdited) {
                    timeElement.textContent = `Last Edited ${formatTimeAgo(window.allJobs[index].lastEdited)}`;
                }
            });
        }, 60000);

        // Add this line to call setupPagination after jobs are loaded
        if (typeof setupPagination === 'function') {
            setupPagination();
        }

    } catch (error) {
        console.error("Error loading jobs: ", error);
        await Swal.fire({
            title: 'Error!',
            text: 'Error loading jobs. Please refresh the page.',
            icon: 'error',
            confirmButtonColor: '#073884',
            allowOutsideClick: false,
            allowEscapeKey: false
        });
    }
}

// Load saved jobs when page loads
loadJobsFromStorage();

function getJobTypeDisplay(type) {
    const types = {
        'full-time': 'Full Time',
        'part-time': 'Part Time',
        'contractual': 'Contractual',
        'probational': 'Probational'
    };
    return types[type] || type;
}

function getLatestJobFromStorage() {
    return JSON.parse(localStorage.getItem('currentJob'));
}

// Function to open the job modal
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

    if (titleElement) titleElement.textContent = jobData.title;
    
    // Update company info section with icons and clean data
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

// ESC key handler
window.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal(addJobModal);
        closeModal(viewJobModal);
    }
});
});

window.onload = function() {
const savedContent = localStorage.getItem('editorContent');
if (savedContent) {
    editor.innerHTML = savedContent;
    undoStack.push(savedContent);
}
updateListButtons();
};

// PSGC API Integration
async function fetchRegions() {
try {
    const response = await fetch('https://psgc.gitlab.io/api/regions/');
    const regions = await response.json();
    const regionSelect = document.getElementById('region');

    regions.sort((a, b) => a.name.localeCompare(b.name)).forEach(region => {
        const option = new Option(region.name, region.code);
        regionSelect.add(option);
    });
} catch (error) {
    console.error('Error fetching regions:', error);
}
}

async function fetchProvinces(regionCode) {
try {
    const provinceSelect = document.getElementById('province');

    // Special handling for NCR
    if (regionCode === '130000000') { // NCR's region code
        provinceSelect.innerHTML = '<option value="ncr">Metro Manila</option>';
        provinceSelect.disabled = true; // Disable province selection for NCR
        // Directly fetch NCR cities
        fetchNCRCities();
        return;
    }

    // Normal flow for other regions
    const response = await fetch(`https://psgc.gitlab.io/api/regions/${regionCode}/provinces/`);
    const provinces = await response.json();

    provinceSelect.innerHTML = '<option value="">Select Province</option>';
    provinces.sort((a, b) => a.name.localeCompare(b.name)).forEach(province => {
        const option = new Option(province.name, province.code);
        provinceSelect.add(option);
    });
    provinceSelect.disabled = false;
} catch (error) {
    console.error('Error fetching provinces:', error);
}
}

async function fetchNCRCities() {
try {
    const response = await fetch('https://psgc.gitlab.io/api/regions/130000000/cities-municipalities/');
    const cities = await response.json();
    const citySelect = document.getElementById('city');

    citySelect.innerHTML = '<option value="">Select City</option>';
    cities.sort((a, b) => a.name.localeCompare(b.name)).forEach(city => {
        const option = new Option(city.name, city.code);
        citySelect.add(option);
    });
    citySelect.disabled = false;
} catch (error) {
    console.error('Error fetching NCR cities:', error);
}
}

async function fetchCities(provinceCode) {
try {
    const response = await fetch(`https://psgc.gitlab.io/api/provinces/${provinceCode}/cities-municipalities/`);
    const cities = await response.json();
    const citySelect = document.getElementById('city');

    citySelect.innerHTML = '<option value="">Select City/Municipality</option>';
    cities.sort((a, b) => a.name.localeCompare(b.name)).forEach(city => {
        const option = new Option(city.name, city.code);
        citySelect.add(option);
    });
    citySelect.disabled = false;
} catch (error) {
    console.error('Error fetching cities:', error);
}
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
fetchRegions();

document.getElementById('region').addEventListener('change', (e) => {
    const regionCode = e.target.value;
    document.getElementById('city').disabled = true;
    document.getElementById('city').innerHTML = '<option value="">Select City/Municipality</option>';
    if (regionCode) {
        fetchProvinces(regionCode);
    }
    updateLocationValue();
});

document.getElementById('province').addEventListener('change', (e) => {
    const provinceCode = e.target.value;
    if (provinceCode) {
        fetchCities(provinceCode);
    }
    updateLocationValue();
});

document.getElementById('city').addEventListener('change', () => {
    updateLocationValue();
});
});

// Add these event listeners after your dropdowns are created
document.getElementById('region').addEventListener('change', async function(e) {
const provinceSelect = document.getElementById('province');
const citySelect = document.getElementById('city');

if (this.value === '130000000') { // NCR
    provinceSelect.innerHTML = '<option value="ncr">Metro Manila</option>';
    provinceSelect.disabled = true;

    try {
        const response = await fetch('https://psgc.gitlab.io/api/regions/130000000/cities-municipalities/');
        const cities = await response.json();

        citySelect.innerHTML = '<option value="">Select City</option>';
        cities.sort((a, b) => a.name.localeCompare(b.name)).forEach(city => {
            const option = new Option(city.name, city.code);
            citySelect.add(option);
        });
        citySelect.disabled = false;
    } catch (error) {
        console.error("Error loading NCR cities:", error);
    }
} else {
    provinceSelect.disabled = false;
    provinceSelect.innerHTML = '<option value="">Select Province</option>';
    citySelect.innerHTML = '<option value="">Select City/Municipality</option>';
    citySelect.disabled = true;
    if (this.value) {
        await fetchProvinces(this.value);
    }
}
});

document.getElementById('province').addEventListener('change', async function(e) {
const citySelect = document.getElementById('city');
citySelect.innerHTML = '<option value="">Select City/Municipality</option>';

if (this.value && this.value !== 'ncr') {
    citySelect.disabled = false;
    try {
        const response = await fetch(`https://psgc.gitlab.io/api/provinces/${this.value}/cities-municipalities/`);
        const cities = await response.json();

        cities.sort((a, b) => a.name.localeCompare(b.name)).forEach(city => {
            const option = new Option(city.name, city.code);
            citySelect.add(option);
        });
    } catch (error) {
        console.error("Error loading cities:", error);
    }
} else {
    citySelect.disabled = true;
}
});

function updateLocationValue() {
const region = document.getElementById('region');
const province = document.getElementById('province');
const city = document.getElementById('city');
const locationInput = document.getElementById('location');

const selectedRegion = region.options[region.selectedIndex].text;
const selectedProvince = province.options[province.selectedIndex].text;
const selectedCity = city.options[city.selectedIndex].text;

// Special handling for NCR
if (region.value === '130000000') {
    locationInput.value = `${selectedCity}, Metro Manila`;
} else {
    const locationParts = [selectedCity, selectedProvince, selectedRegion]
        .filter(part => part && part !== 'Select Region' && part !== 'Select Province' && part !== 'Select City/Municipality');
    locationInput.value = locationParts.join(', ');
}
}

// Add this after your filterJobs function
function setupPagination() {
    const jobsPerPage = 10;
    let currentPage = 1;
    const jobCards = document.querySelectorAll('.job-card');
    
    // Count visible jobs (those that aren't hidden by display:none)
    const visibleJobs = Array.from(jobCards).filter(card => 
        card.style.display !== 'none'
    );
    
    const totalJobs = visibleJobs.length;
    const totalPages = Math.ceil(totalJobs / jobsPerPage) || 1;
    
    // Create pagination container if it doesn't exist
    let paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'paginationContainer';
        paginationContainer.className = 'pagination-container';
        document.querySelector('.container').appendChild(paginationContainer);
    }
    
    // Clear existing pagination
    paginationContainer.innerHTML = '';
    
    // Create pagination controls
    const paginationControls = document.createElement('div');
    paginationControls.className = 'pagination-controls';
    
    // Show only the jobs for the current page
    showJobsForPage(currentPage);
    
    function showJobsForPage(page) {
        const startIndex = (page - 1) * jobsPerPage;
        const endIndex = startIndex + jobsPerPage;
        
        // Hide all job cards first
        visibleJobs.forEach(card => {
            card.style.display = 'none';
        });
        
        // Show only the jobs for the current page
        visibleJobs.slice(startIndex, endIndex).forEach(card => {
            card.style.display = '';
        });
    }
}

async function validateSalaryAmount(salary) {
    if (salary > 1000) {
        const result = await Swal.fire({
            title: 'Validation Check',
            text: 'Are you sure about the salary? It should be a daily rate.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#073884',
            cancelButtonColor: '#d33',
            confirmButtonText: 'I know',
            cancelButtonText: 'Return and Edit',
            allowOutsideClick: false,
            allowEscapeKey: false
        });
        return result.isConfirmed;
    }
    return true;
}

// Modify the validateSalaryFields function
async function validateSalaryFields(isConfidential, isRange, salary, minSalary, maxSalary) {
if (!isConfidential) {
    if (isRange) {
        const minValue = Number(minSalary.replace(/,/g, ''));
        const maxValue = Number(maxSalary.replace(/,/g, ''));

        if (!minSalary || !maxSalary || minValue === 0 || maxValue === 0) {
            await Swal.fire({
                title: 'Validation Error',
                html: 'Salary cannot be empty or zero.<br>Select confidential instead.',
                icon: 'error',
                confirmButtonColor: '#073884',
                allowOutsideClick: false,
                allowEscapeKey: false
            });
            return false;
        }
        
        // Check salary range values
        const isMinSalaryValid = await validateSalaryAmount(minValue);
        if (!isMinSalaryValid) return false;
        
        const isMaxSalaryValid = await validateSalaryAmount(maxValue);
        if (!isMaxSalaryValid) return false;

        if (minValue >= maxValue) {
            await Swal.fire({
                title: 'Validation Error',
                text: 'Minimum salary must be less than maximum salary',
                icon: 'error',
                confirmButtonColor: '#073884',
                allowOutsideClick: false,
                allowEscapeKey: false
            });
            return false;
        }
    } else {
        const salaryValue = Number(salary.replace(/,/g, ''));

        if (!salary || salaryValue === 0) {
            await Swal.fire({
                title: 'Validation Error',
                html: 'Salary cannot be empty or zero.<br>Select confidential instead.',
                icon: 'error',
                confirmButtonColor: '#073884',
                allowOutsideClick: false,
                allowEscapeKey: false
            });
            return false;
        }

        // Check single salary value
        const isSalaryValid = await validateSalaryAmount(salaryValue);
        if (!isSalaryValid) return false;
    }
}
return true;
}

// Update the handleSubmit function
async function handleSubmit(event) {
event.preventDefault();

// Get salary-related values
const isConfidential = document.getElementById('salaryConfidential').checked;
const isRange = document.getElementById('salaryRange').checked;
const salary = document.getElementById('salary').value;
const minSalary = document.getElementById('minSalary').value;
const maxSalary = document.getElementById('maxSalary').value;

// Validate salary fields
const isValid = await validateSalaryFields(isConfidential, isRange, salary, minSalary, maxSalary);
if (!isValid) return;
}

// Update the editJob function
async function editJob(event) {
event.preventDefault();

// Get salary-related values
const isConfidential = document.getElementById('editSalaryConfidential').checked;
const isRange = document.getElementById('editSalaryRange').checked;
const salary = document.getElementById('editSalary').value;
const minSalary = document.getElementById('editMinSalary').value;
const maxSalary = document.getElementById('editMaxSalary').value;

// Validate salary fields
const isValid = await validateSalaryFields(isConfidential, isRange, salary, minSalary, maxSalary);
if (!isValid) return;
}

// Add this event listener after your document is loaded
document.addEventListener('DOMContentLoaded', function() {
const archivesButton = document.querySelector('#archivesButton');
const archivesModal = document.getElementById('archivesModal');
const selectAllBtn = document.getElementById('selectAllArchives');
let isAllSelected = false;

if (archivesButton && archivesModal) {
    // Function to reset selection and disable buttons
    function resetSelectionAndButtons() {
        const rows = document.querySelectorAll('#archivesTableBody tr');
        const restoreBtn = document.querySelector('.action-buttons .restore-btn');
        const deleteBtn = document.querySelector('.action-buttons .delete-btn');
        
        rows.forEach(r => r.classList.remove('selected'));
        restoreBtn.disabled = true;
        deleteBtn.disabled = true;
        if (selectAllBtn) {
            selectAllBtn.innerHTML = '<i class="fas fa-check-square"></i> Select All';
            isAllSelected = false;
        }
    }

    // Add select all functionality
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            const rows = document.querySelectorAll('#archivesTableBody tr');
            const restoreBtn = document.querySelector('.action-buttons .restore-btn');
            const deleteBtn = document.querySelector('.action-buttons .delete-btn');
            
            isAllSelected = !isAllSelected;
            
            rows.forEach(row => {
                if (!row.querySelector('td[colspan="3"]')) { // Skip the "No archived jobs found" row
                    row.classList.toggle('selected', isAllSelected);
                }
            });
            
            restoreBtn.disabled = !isAllSelected;
            deleteBtn.disabled = !isAllSelected;
            
            selectAllBtn.innerHTML = isAllSelected ? 
                '<i class="fas fa-square"></i> Deselect All' : 
                '<i class="fas fa-check-square"></i> Select All';
        });
    }

    archivesButton.addEventListener('click', async function(e) {
        e.preventDefault();
        try {
            // Get current employer ID first
            currentEmployerId = await getCurrentEmployerId();
            if (!currentEmployerId) {
                console.error("No employer ID found");
                await Swal.fire({
                    title: 'Error!',
                    text: 'Could not verify employer account.',
                    icon: 'error',
                    confirmButtonColor: '#073884',
                    allowOutsideClick: false,
                    allowEscapeKey: false
                });
                return;
            }

            console.log("Loading archives for employer:", currentEmployerId); // Added console log

            const jobsRef = collection(db, "jobs");
            const q = query(jobsRef, 
                where("employerId", "==", currentEmployerId),
                where("archived", "==", true)
            );
            const querySnapshot = await getDocs(q);
            
            const archivesTableBody = document.getElementById('archivesTableBody');
            if (archivesTableBody) {
                archivesTableBody.innerHTML = '';
                
                if (querySnapshot.empty) {
                    archivesTableBody.innerHTML = `
                        <tr>
                            <td colspan="3" style="text-align: center; padding: 20px; font-family: interRegular;">
                                No archived jobs found
                            </td>
                        </tr>
                    `;
                    if (selectAllBtn) selectAllBtn.style.display = 'none'; // Hide select all button when no items
                } else {
                    if (selectAllBtn) selectAllBtn.style.display = 'block'; // Show select all button
                    querySnapshot.forEach((doc) => {
                        const job = doc.data();
                        const row = document.createElement('tr');
                        row.setAttribute('data-id', doc.id);
                        row.innerHTML = `
                            <td style="font-family: interRegular;">${job.title || ''}</td>
                            <td style="font-family: interRegular;">${job.company || ''}</td>
                            <td style="font-family: interRegular;">${job.location || ''}</td>
                        `;
                        archivesTableBody.appendChild(row);
                    });

                    // Modify row click event to allow multiple selection
                    const rows = archivesTableBody.querySelectorAll('tr');
                    const restoreBtn = document.querySelector('.action-buttons .restore-btn');
                    const deleteBtn = document.querySelector('.action-buttons .delete-btn');

                    rows.forEach(row => {
                        row.addEventListener('click', function(e) {
                            e.stopPropagation();
                            this.classList.toggle('selected');
                            
                            // Update buttons based on any selection
                            const anySelected = archivesTableBody.querySelectorAll('tr.selected').length > 0;
                            restoreBtn.disabled = !anySelected;
                            deleteBtn.disabled = !anySelected;
                            
                            // Update select all button state
                            const allSelected = Array.from(rows).every(r => r.classList.contains('selected'));
                            if (selectAllBtn) {
                                selectAllBtn.innerHTML = allSelected ? 
                                    '<i class="fas fa-square"></i> Deselect All' : 
                                    '<i class="fas fa-check-square"></i> Select All';
                                isAllSelected = allSelected;
                            }
                        });
                    });

                    // Click event for the modal content to unselect
                    const modalContent = archivesModal.querySelector('.modal-content');
                    modalContent.addEventListener('click', function(e) {
                        if (e.target === modalContent) {
                            resetSelectionAndButtons();
                        }
                    });

                    // Restore button functionality
                    restoreBtn.addEventListener('click', async function(e) {
                        e.stopPropagation();
                        const selectedRows = archivesTableBody.querySelectorAll('tr.selected');
                        if (!selectedRows.length) return;

                        try {
                            const result = await Swal.fire({
                                title: 'Restore Jobs?',
                                text: selectedRows.length > 1 ? 
                                    'These jobs will be restored to active listings.' : 
                                    'This job will be restored to active listings.',
                                icon: 'question',
                                showCancelButton: true,
                                confirmButtonColor: '#073884',
                                cancelButtonColor: '#d33',
                                confirmButtonText: 'Yes, restore!',
                                cancelButtonText: 'Cancel',
                                allowOutsideClick: false,
                                allowEscapeKey: false
                            });

                            if (result.isConfirmed) {
                                // Create an array of promises for batch update
                                const updatePromises = Array.from(selectedRows).map(row => {
                                    const jobId = row.getAttribute('data-id');
                                    const jobRef = doc(db, "jobs", jobId);
                                    return updateDoc(jobRef, {
                                        archived: false
                                    });
                                });

                                await Promise.all(updatePromises);
                                
                                await Swal.fire({
                                    title: 'Restored!',
                                    text: selectedRows.length > 1 ? 
                                        'The jobs have been restored.' : 
                                        'The job has been restored.',
                                    icon: 'success',
                                    confirmButtonColor: '#073884',
                                    allowOutsideClick: false,
                                    allowEscapeKey: false
                                });
                                
                                window.location.reload();
                            }
                        } catch (error) {
                            console.error("Error restoring jobs:", error);
                            Swal.fire({
                                title: 'Error!',
                                text: 'Error restoring the selected jobs.',
                                icon: 'error',
                                confirmButtonColor: '#073884',
                                allowOutsideClick: false,
                                allowEscapeKey: false
                            });
                        }
                    });

                    // Delete button functionality
                    deleteBtn.addEventListener('click', async function(e) {
                        e.stopPropagation();
                        const selectedRows = archivesTableBody.querySelectorAll('tr.selected');
                        if (!selectedRows.length) return;

                        try {
                            // First confirmation - warning
                            const firstResult = await Swal.fire({
                                title: 'Delete Permanently?',
                                html: selectedRows.length > 1 ? 
                                    'This action cannot be undone! <br>You are deleting multiple jobs!' : 
                                    'This action cannot be undone!',
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonColor: '#d33',
                                cancelButtonColor: '#073884',
                                confirmButtonText: 'Continue',
                                cancelButtonText: 'Cancel',
                                allowOutsideClick: false,
                                allowEscapeKey: false
                            });

                            if (firstResult.isConfirmed) {
                                // Second confirmation - error for emphasis
                                const finalResult = await Swal.fire({
                                    title: 'Final Confirmation',
                                    text: selectedRows.length > 1 ? 
                                        'Are you sure? This will permanently delete these job listings.' : 
                                        'Are you sure? This will permanently delete this job listing.',
                                    icon: 'error',
                                    showCancelButton: true,
                                    confirmButtonColor: '#d33',
                                    cancelButtonColor: '#073884',
                                    confirmButtonText: 'Yes, I understand',
                                    cancelButtonText: 'Cancel',
                                    allowOutsideClick: false,
                                    allowEscapeKey: false
                                });

                                if (finalResult.isConfirmed) {
                                    // Create an array of promises for batch delete
                                    const deletePromises = Array.from(selectedRows).map(row => {
                                        const jobId = row.getAttribute('data-id');
                                        const jobRef = doc(db, "jobs", jobId);
                                        return deleteDoc(jobRef);
                                    });

                                    await Promise.all(deletePromises);
                                    
                                    await Swal.fire({
                                        title: 'Deleted!',
                                        text: selectedRows.length > 1 ? 
                                            'The jobs have been permanently deleted.' : 
                                            'The job has been permanently deleted.',
                                        icon: 'success',
                                        confirmButtonColor: '#073884',
                                        allowOutsideClick: false,
                                        allowEscapeKey: false
                                    });
                                    
                                    selectedRows.forEach(row => row.remove());
                                    resetSelectionAndButtons();
                                }
                            }
                        } catch (error) {
                            console.error("Error deleting jobs:", error);
                            Swal.fire({
                                title: 'Error!',
                                text: 'Error deleting the selected jobs.',
                                icon: 'error',
                                confirmButtonColor: '#073884',
                                allowOutsideClick: false,
                                allowEscapeKey: false
                            });
                        }
                    });
                }
            }
            
            archivesModal.style.display = 'block';
        } catch (error) {
            console.error("Error loading archives:", error);
            if (error.code) {
                Swal.fire({
                    title: 'Error!',
                    text: 'Error loading archived jobs.',
                    icon: 'error',
                    confirmButtonColor: '#073884',
                    allowOutsideClick: false,
                    allowEscapeKey: false
                });
            }
        }
    });

    // Close button handler
    const closeButton = archivesModal.querySelector('.close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            archivesModal.style.display = 'none';
            resetSelectionAndButtons();
        });
    }
}
});

async function fetchAndRenderJobs() {
try {
    const currentEmployerId = await getCurrentEmployerId();
    if (!currentEmployerId) {
        console.error("No employer ID found");
        return;
    }

    console.log("Loading jobs for employerId:", currentEmployerId);

    // Query jobs for this specific employer
    const jobsRef = collection(db, "jobs");
    const q = query(
        jobsRef, 
        where("employerId", "==", currentEmployerId),
        where("archived", "==", false)
    );
    
    const querySnapshot = await getDocs(q);
    const jobs = []; // Define the jobs array here
    
    querySnapshot.forEach((doc) => {
        const jobData = { id: doc.id, ...doc.data() };
        jobs.push(jobData);
    });

    // Get the noDataFound element
    const noDataFound = document.getElementById('noDataFound');

    // Simply toggle visibility based on jobs length
    if (noDataFound) {
        noDataFound.style.display = jobs.length === 0 ? 'block' : 'none';
    }

    // Continue with your existing job rendering logic
    window.allJobs = jobs;
    
    if (jobs.length > 0) {
        // Only populate filters and render jobs if we have jobs
        const locations = new Set();
        const jobTypes = new Set();
        
        jobs.forEach(job => {
            if (job.location) locations.add(job.location);
            if (job.type) jobTypes.add(job.type);
        });
        
        populateFilterDropdowns(locations, jobTypes);
        renderFilteredJobs();
    }

} catch (error) {
    console.error("Error fetching jobs:", error);
}
}

// Add this function to handle date formatting
function formatDateTime(timestamp) {
    if (!timestamp) return 'Date not available';

    // Check if timestamp is already a string
    if (typeof timestamp === 'string') {
        return timestamp;
    }

    // Handle Firebase Timestamp
    if (timestamp.toDate) {
        const date = timestamp.toDate();
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
        
        const month = months[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        const hours = date.getHours() % 12 || 12;
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = date.getHours() >= 12 ? 'AM' : 'AM';
        
        return `${month} ${day}, ${year}, ${hours}:${minutes} ${ampm}`;
    }

    // Handle regular Date object or timestamp number
    if (timestamp instanceof Date || typeof timestamp === 'number') {
        const date = new Date(timestamp);
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
        
        const month = months[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        const hours = date.getHours() % 12 || 12;
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = date.getHours() >= 12 ? 'AM' : 'AM';
        
        return `${month} ${day}, ${year}, ${hours}:${minutes} ${ampm}`;
    }

    return 'Date not available';
}