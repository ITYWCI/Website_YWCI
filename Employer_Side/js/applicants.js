        import {
            initializePage,
            db,
            auth } from './auth.js';
        import { getInitials, createInitialsAvatar, populateUserNav } from './utils.js';

            function hideLoader() {
                const loader = document.getElementById('loadingOverlay');
            if (loader) {
                loader.classList.add('hidden');
            }
        }

        async function initializeApplicants() {
            try {
                console.log("Initializing applicants...");
                
                // Wait for data to load
                await populateUserNav();
                console.log("User nav populated");
                
                // Make sure DOM is fully loaded
                if (document.readyState === 'loading') {
                    console.log("Document still loading, waiting...");
                    await new Promise(resolve => {
                        document.addEventListener('DOMContentLoaded', resolve);
                    });
                }
                console.log("Document ready");
                
                // Create filter elements if they don't exist
                createFilterElements();
                
                // Then fetch and render users (which will also populate filters)
                await fetchAndRenderUsers();
                
                // Add event listeners to filter elements
                const nameSearch = document.getElementById('nameSearch');
                const jobFilter = document.getElementById('jobFilter');
                const statusFilter = document.getElementById('statusFilter');
                const dateFromFilter = document.getElementById('dateFromFilter');
                const dateToFilter = document.getElementById('dateToFilter');
                const resetFilters = document.getElementById('resetFilters');
                
                if (nameSearch) {
                    nameSearch.addEventListener('input', function() {
                        if (this.value.length >= 2 || this.value.length === 0) {
                            applyFilters();
                        }
                    });
                }
                
                if (jobFilter) jobFilter.addEventListener('change', applyFilters);
                if (statusFilter) statusFilter.addEventListener('change', applyFilters);
                if (dateFromFilter) dateFromFilter.addEventListener('change', applyFilters);
                if (dateToFilter) dateToFilter.addEventListener('change', applyFilters);
                
                if (resetFilters) {
                    resetFilters.addEventListener('click', function() {
                        if (nameSearch) nameSearch.value = '';
                        if (jobFilter) jobFilter.value = 'all';
                        if (statusFilter) statusFilter.value = 'all';
                        if (dateFromFilter) dateFromFilter.value = '';
                        if (dateToFilter) dateToFilter.value = '';
                        applyFilters();
                    });
                }
                
                // Add event listener for clear filters button in no results message
                document.addEventListener('click', function(e) {
                    if (e.target && e.target.id === 'clearFiltersBtn') {
                        if (nameSearch) nameSearch.value = '';
                        if (jobFilter) jobFilter.value = 'all';
                        if (statusFilter) statusFilter.value = 'all';
                        if (dateFromFilter) dateFromFilter.value = '';
                        if (dateToFilter) dateToFilter.value = '';
                        applyFilters();
                    }
                });
                
                // Hide loader after everything is loaded
                hideLoader();
            } catch (error) {
                console.error("Error initializing applicants:", error);
                hideLoader(); // Hide loader even on error
            }
        }

    document.addEventListener('DOMContentLoaded', () => {
        // Save current URL if not on login page
        if (!window.location.pathname.includes('login.html')) {
            sessionStorage.setItem('lastVisitedUrl', window.location.pathname);
        }
        
        initializePage(initializeApplicants);

    });



    // Function to create a user row
    function createUserRow(user) {
        // Format the date to be more readable
        let formattedDate;
        try {
            const date = user.applicationDate?.toDate?.() || new Date(user.applicationDate);
            formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            console.error("Date formatting error:", error);
            formattedDate = "Invalid Date";
        }
    
        // Format full name
        const fullName = formatFullName(
            user.firstName || '',
            user.middleName || '',
            user.lastName || ''
        );
    
        // Debug: Log the email being set in the data attribute
        console.log("Setting data-email attribute for", fullName, "to:", user.email);
    
        return `
            <tr>
                <td>
                    <div class="user-info">
                        <div class="user-avatar">
                            ${createInitialsAvatar(user.firstName, user.lastName, 'small')}
                        </div>
                        ${fullName}
                    </div>
                </td>
                <td>${user.jobTitle}</td>
                <td>${formattedDate}</td>
                <td>
                    <span class="status-badge status-${user.status.toLowerCase().replace(' ', '-')}">
                        ${user.status}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="view-btn" data-email="${user.email}">View</button>
                    </div>
                </td>
            </tr>
        `;
    }
    //End of User Row

    function formatFullName(firstName, middleName, lastName) {
        if (middleName && middleName.trim() !== "") {
            return `${firstName} ${middleName.charAt(0)}. ${lastName}`;
        } else {
            return `${firstName} ${lastName}`;
        }
    }
    

    // Modal functionality
    const modal = document.getElementById('applicantModal');
    const closeBtn = document.querySelector('.close');
    const actionSelect = document.getElementById('actionSelect');
    const interviewSection = document.getElementById('interviewSection');
    const submitButton = document.getElementById('submitAction');

// Function to create filter elements if they don't exist
function createFilterElements() {
    // This function can be empty if your HTML already has the filter elements
    console.log("Filter elements already exist in HTML");
}

// Function to fetch and render users from Firestore
async function fetchAndRenderUsers() {
    try {
        // Make sure auth is initialized and user is logged in
        if (!auth || !auth.currentUser) {
            console.log("Waiting for authentication...");
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit and try again
            return fetchAndRenderUsers();
        }
        
        // Fetch applicants from server endpoint
        const response = await fetch('/api/applicants', {
            headers: {
                'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch applicants: ${response.statusText}`);
        }
        
        const applicants = await response.json();
        const users = [];
        
        // Collect unique job titles and statuses for filters
        const jobTitles = new Set();
        const statuses = new Set();

        applicants.forEach((userData) => {
            const status = userData.status || 'application received';
            
            users.push({
                firstName: userData.firstName || '',
                middleName: userData.middleName || '',
                lastName: userData.lastName || '',
                email: userData.email || '',
                jobTitle: userData.jobTitle || '',
                applicationDate: userData.applicationDate,
                status: status,
                phone: userData.phone || '',
                company: userData.company || '',
                resumeFileName: userData.resumeFileName || ''
            });
            
            if (userData.jobTitle) jobTitles.add(userData.jobTitle);
            statuses.add(status);
        });

        // Sort users by applicationDate in descending order
        users.sort((a, b) => {
            const dateA = a.applicationDate?.toDate?.() || new Date(a.applicationDate);
            const dateB = b.applicationDate?.toDate?.() || new Date(b.applicationDate);
            return dateB - dateA;
        });

        // Store users in a global variable for filtering
        window.allUsers = users;
        
        // Get UI elements
        const tableBody = document.getElementById('userTableBody');
        const table = document.querySelector('.users-list table');
        const headerRow = document.querySelector('.users-list table thead tr');
        const noResultsMessage = document.getElementById('noResultsMessage');
        const noDataFound = document.getElementById('noDataFound');

        // Check if there are any users at all
        if (users.length === 0) {
            // No data case
            if (tableBody) tableBody.style.display = 'none';
            if (headerRow) headerRow.style.display = 'none';
            if (table) table.style.border = 'none';
            if (noResultsMessage) noResultsMessage.style.display = 'none';
            if (noDataFound) noDataFound.style.display = 'block';
        } else {
            // Has data case
            if (noDataFound) noDataFound.style.display = 'none';
            
            // Populate filter dropdowns
            populateFilterDropdowns(jobTitles, statuses);
            
            // Render users with current filters
            renderFilteredUsers();
        }

    } catch (error) {
        console.error("Error fetching users:", error);
    }
}

// Function to populate filter dropdowns
function populateFilterDropdowns(jobTitles, statuses) {
    const jobFilter = document.getElementById('jobFilter');
    const statusFilter = document.getElementById('statusFilter');
    
    if (!jobFilter || !statusFilter) {
        console.error("Filter elements not found");
        return;
    }
    
    // Save current selections
    const currentJobValue = jobFilter.value;
    const currentStatusValue = statusFilter.value;
    
    // Clear existing options except the first one (All)
    while (jobFilter.options.length > 1) {
        jobFilter.remove(1);
    }
    
    while (statusFilter.options.length > 1) {
        statusFilter.remove(1);
    }
    
    // Add job title options
    jobTitles.forEach(title => {
        const option = document.createElement('option');
        option.value = title;
        option.textContent = title;
        jobFilter.appendChild(option);
    });
    
    // Add status options
    statuses.forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        statusFilter.appendChild(option);
    });
    
    // Restore previous selections if they exist in the new options
    if (currentJobValue !== 'all') {
        for (let i = 0; i < jobFilter.options.length; i++) {
            if (jobFilter.options[i].value === currentJobValue) {
                jobFilter.selectedIndex = i;
                break;
            }
        }
    }
    
    if (currentStatusValue !== 'all') {
        for (let i = 0; i < statusFilter.options.length; i++) {
            if (statusFilter.options[i].value === currentStatusValue) {
                statusFilter.selectedIndex = i;
                break;
            }
        }
    }
}

// Function to render filtered users
function renderFilteredUsers() {
    if (!window.allUsers) return;
    
    const nameFilter = document.getElementById('nameSearch')?.value.toLowerCase() || '';
    const jobFilter = document.getElementById('jobFilter')?.value || 'all';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const dateFromFilter = document.getElementById('dateFromFilter')?.value ? new Date(document.getElementById('dateFromFilter').value) : null;
    const dateToFilter = document.getElementById('dateToFilter')?.value ? new Date(document.getElementById('dateToFilter').value) : null;
    
    if (dateToFilter) {
        dateToFilter.setHours(23, 59, 59);
    }
    
    // Filter users based on criteria
    const filteredUsers = window.allUsers.filter(user => {
        const fullName = `${user.firstName} ${user.middleName} ${user.lastName}`.toLowerCase();
        const matchesName = !nameFilter || fullName.includes(nameFilter);
        const matchesJob = jobFilter === 'all' || user.jobTitle === jobFilter;
        const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
        
        const userDate = user.applicationDate?.toDate?.() || new Date(user.applicationDate);
        const matchesDateFrom = !dateFromFilter || userDate >= dateFromFilter;
        const matchesDateTo = !dateToFilter || userDate <= dateToFilter;
        
        return matchesName && matchesJob && matchesStatus && matchesDateFrom && matchesDateTo;
    });
    
    // Get UI elements
    const tableBody = document.getElementById('userTableBody');
    const table = document.querySelector('.users-list table');
    const headerRow = document.querySelector('.users-list table thead tr');
    const noResultsMessage = document.getElementById('noResultsMessage');
    const noDataFound = document.getElementById('noDataFound');

    // Check if we have any users at all
    if (window.allUsers.length === 0) {
        // No data case
        if (tableBody) tableBody.style.display = 'none';
        if (headerRow) headerRow.style.display = 'none';
        if (table) table.style.border = 'none';
        if (noResultsMessage) noResultsMessage.style.display = 'none';
        if (noDataFound) noDataFound.style.display = 'block';
        return;
    }

    // Hide noDataFound when we have data
    if (noDataFound) noDataFound.style.display = 'none';
    
    // Show/hide elements based on filtered results
    if (filteredUsers.length === 0) {
        // No results from filtering
        if (tableBody) tableBody.style.display = 'none';
        if (headerRow) headerRow.style.display = 'none';
        if (table) table.style.border = 'none';
        if (noResultsMessage) noResultsMessage.style.display = 'block';
    } else {
        // Has results
        if (tableBody) {
            tableBody.style.display = '';
            tableBody.innerHTML = filteredUsers.map(user => createUserRow(user)).join('');
        }
        if (headerRow) headerRow.style.display = '';
        if (table) table.style.border = '';
        if (noResultsMessage) noResultsMessage.style.display = 'none';
        
        addViewButtonListeners();
    }
    
    console.log(`Filtered users: ${filteredUsers.length} of ${window.allUsers.length}`);
}

// Function to apply filters (wrapper for renderFilteredUsers)
function applyFilters() {
    renderFilteredUsers();
}

    // Function to add view button listeners
    function addViewButtonListeners() {
        const viewButtons = document.querySelectorAll('.view-btn');
        viewButtons.forEach(button => {
            button.addEventListener('click', async function(e) {
                e.preventDefault();
                const email = this.getAttribute('data-email');
                
                // Debug: Log the email we're trying to find
                console.log("Looking for user with email:", email);
                
                try {
                    const applicationsRef = collection(db, "applications");
                    const q = query(applicationsRef, where("email", "==", email));
                    const querySnapshot = await getDocs(q);
                    
                    if (!querySnapshot.empty) {
                        const userData = querySnapshot.docs[0].data();
                        
                        // Make sure we're getting the correct user data
                        console.log("Retrieved user data:", userData);
                        
                        // Then open the modal with updated data
                        openUserModal(userData);
                    } else {
                        console.error("No user found with email:", email);
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                }
            });
        });
    }
    //End of Add View Button Listeners

    // Function to update application status
    async function updateApplicationStatus(email, newStatus, message) {
        try {
            // Update application status using server endpoint
            const response = await fetch(`/api/applicants/${email}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
                },
                body: JSON.stringify({
                    status: newStatus,
                    message: message || ''
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to update status: ${response.statusText}`);
                // Close modal
                document.getElementById('resumeModal').style.display = 'none';
                document.body.classList.remove('modal-open');
                
                // Refresh the table
                await fetchAndRenderUsers();
            }
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Error updating application status");
        }
    }
    //End of Update Application Status

        // Initial call to add listeners
        addViewButtonListeners();

        // Also call it after table population
        const observer = new MutationObserver(function(mutations) {
            addViewButtonListeners();
        });

        // Watch for changes in the table body
        document.addEventListener('DOMContentLoaded', () => {
            fetchAndRenderUsers();
            
            // Watch for changes in the table body
            const tableBody = document.getElementById('userTableBody');
            if (tableBody) {
                const observer = new MutationObserver(function(mutations) {
                    addViewButtonListeners();
                });
                
                observer.observe(tableBody, { childList: true });
            }
        });
    // Variables to store PDF data
    let currentPdf = null;
    let currentPageNum = 1;
    let totalPages = 1;

    // Add fullscreen button to PDF container
    function addFullscreenButton() {
        const pdfContainer = document.getElementById('pdfContainer');
        
        // Remove any existing fullscreen button to avoid duplicates
        const existingBtn = document.getElementById('pdfFullscreenBtn');
        if (existingBtn) {
            existingBtn.remove();
        }
        
        // Create fullscreen button
        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'pdf-view-fullscreen';
        fullscreenBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg> View Full Screen';
        fullscreenBtn.id = 'pdfFullscreenBtn';
        
        // Add CSS styles for overlay positioning
        fullscreenBtn.style.position = 'absolute';
        fullscreenBtn.style.top = '10px';
        fullscreenBtn.style.right = '10px';
        fullscreenBtn.style.zIndex = '1000';
        fullscreenBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.9)'; // Semi-transparent background
        fullscreenBtn.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
        
        // Make sure the PDF container has relative positioning
        pdfContainer.style.position = 'relative';
        
        // Add the button to the PDF container
        pdfContainer.appendChild(fullscreenBtn);
    }
    //End of Add Fullscreen Button


    // The rest of your loadPDF function remains the same
    async function loadPDF(pdfPath) {
        try {
            // Get document
            const loadingTask = pdfjsLib.getDocument(pdfPath);
            const pdf = await loadingTask.promise;
            currentPdf = pdf;
            totalPages = pdf.numPages;
            
            // Store for fullscreen use
            window.currentPdfDocument = pdf;
            
            const pdfContainer = document.getElementById('pdfContainer');
            pdfContainer.innerHTML = ''; // Clear existing content
            
            // Create canvas for PDF rendering
            const canvas = document.createElement('canvas');
            canvas.id = 'pdfViewer';
            pdfContainer.appendChild(canvas);
            const context = canvas.getContext('2d');

            // Add fullscreen button
            addFullscreenButton();

            // Render first page only (no navigation controls in normal view)
            const page = await pdf.getPage(1);
            const pdfContainerWidth = pdfContainer.clientWidth;
            const viewport = page.getViewport({ scale: 1 });

            const scale = pdfContainerWidth / viewport.width;
            const scaledViewport = page.getViewport({ scale });

            canvas.width = scaledViewport.width;
            canvas.height = scaledViewport.height;

            const renderContext = {
                canvasContext: context,
                viewport: scaledViewport
            };

            await page.render(renderContext);
            currentPageNum = 1; // Reset current page

            // Setup fullscreen button handler
            document.getElementById('pdfFullscreenBtn').onclick = openFullscreenPDF;

        } catch (error) {
            console.error('Error loading PDF:', error);
            document.getElementById('pdfContainer').innerHTML = 'Error loading PDF';
        }
    }
    //End of Load PDF

    let fullscreenScale = 1.0;
    const SCALE_STEP = 0.25;
    const MAX_SCALE = 3.0;
    const MIN_SCALE = 0.5;

    // Function to update fullscreen PDF rendering
    async function renderFullscreenPage(pageNum) {
        if (!currentPdf) return;

        const page = await currentPdf.getPage(pageNum);
        const canvas = document.getElementById('pdfViewerFullscreen');
        const context = canvas.getContext('2d');

        // Apply zoom scale when getting viewport
        const viewport = page.getViewport({ scale: fullscreenScale });

        // Resize canvas based on new viewport size
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Clear canvas before rendering
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Render PDF page
        await page.render({
            canvasContext: context,
            viewport: viewport
        });

        // Update navigation buttons and page numbers
        document.getElementById('prevPageFullscreen').disabled = pageNum <= 1;
        document.getElementById('nextPageFullscreen').disabled = pageNum >= totalPages;
        document.getElementById('pageNumFullscreen').textContent = `Page ${pageNum} of ${totalPages}`;
    }
    //End of Render Fullscreen Page

    // Function to open fullscreen PDF view
    function openFullscreenPDF() {
        const fullscreenView = document.getElementById('pdfFullscreen');
        fullscreenView.classList.add('active');
        document.body.classList.add('modal-open');
        
        // Reset zoom level when opening fullscreen
        fullscreenScale = 1.0;
        renderFullscreenPage(currentPageNum);

        // Setup navigation controls
        document.getElementById('prevPageFullscreen').onclick = async () => {
            if (currentPageNum > 1) {
                currentPageNum--;
                await renderFullscreenPage(currentPageNum);
            }
        };

        document.getElementById('nextPageFullscreen').onclick = async () => {
            if (currentPageNum < totalPages) {
                currentPageNum++;
                await renderFullscreenPage(currentPageNum);
            }
        };

        // Setup zoom controls
        document.getElementById('zoomInFullscreen').onclick = async () => {
            if (fullscreenScale < MAX_SCALE) {
                fullscreenScale += SCALE_STEP;
                await renderFullscreenPage(currentPageNum);
            }
        };

        document.getElementById('zoomOutFullscreen').onclick = async () => {
            if (fullscreenScale > MIN_SCALE) {
                fullscreenScale -= SCALE_STEP;
                await renderFullscreenPage(currentPageNum);
            }
        };

        document.getElementById('fullscreenClose').onclick = () => {
            fullscreenView.classList.remove('active');
            document.body.classList.remove('modal-open');
        };
    }
    //End of Open Fullscreen PDF

// Function to open user modal
function openUserModal(user) {
    const modal = document.getElementById('resumeModal');
    
    // Format full name for modal
    const fullName = formatFullName(
        user.firstName || '',
        user.middleName || '',
        user.lastName || ''
    );
    
    // Populate modal content with initials avatar
    const modalAvatar = document.getElementById('modalAvatar');
    if (modalAvatar) {
        modalAvatar.outerHTML = createInitialsAvatar(
            user.firstName || '', 
            user.lastName || '',
            'large'
        );
    }
    
    // Update modal content
    document.getElementById('modalName').textContent = fullName;
    document.getElementById('modalContact').textContent = user.phone || 'No phone number';
    document.getElementById('modalEmail').textContent = user.email || 'No email';
    
    // Setup action dropdown
    const actionSelect = document.getElementById('actionSelect');
    const submitButton = document.getElementById('submitAction');
    const messageInput = document.getElementById('interviewMessage');
    const closeBtn = document.querySelector('.close');
    
    // Reset fields
    messageInput.value = ''; // Clear message
    
    // Set dropdown value based on current status
    actionSelect.value = user.status === 'application received' ? '' : user.status;
    
    // Add event listener for submit button
    submitButton.onclick = async function() {
        const newStatus = actionSelect.value;
        let message = messageInput.value.trim();

        // First validate action selection
        if (!newStatus) {
            alert('Please select an action first');
            return;
        }

        // Require message for all statuses
        if (!message) {
            alert('Please enter a message');
            return;
        }

        // Show confirmation dialog
        if (confirm(`Are you sure you want to mark this application as "${newStatus}"?`)) {
            await updateApplicationStatus(user.email, newStatus, message);
        }
    };
    
    // Add event listener for close button
    closeBtn.onclick = function() {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    };
    
    // Show modal
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
}
    //End of User Modal

    // Toggle interview section based on action selected
    document.getElementById('actionSelect').addEventListener('change', function() {
        const interviewSection = document.getElementById('interviewSection');
        const dateTimeGroup = document.getElementById('dateTimeGroup');
        const messageLabel = document.getElementById('messageLabel');

        if (this.value === '') {
            interviewSection.style.display = 'none';
        } else if (this.value === 'interview') {
            // Show both message and date/time for interview
            interviewSection.style.display = 'block';
            dateTimeGroup.style.display = 'block';
            messageLabel.textContent = 'Interview Details:';
        } else {
            // Show only message for other actions
            interviewSection.style.display = 'block';
            dateTimeGroup.style.display = 'none';
            
            // Update message label based on action
            switch(this.value) {
                case 'shortlisted':
                    messageLabel.textContent = 'Shortlist Message:';
                    break;
                case 'under-review':
                    messageLabel.textContent = 'Review Message:';
                    break;
                case 'rejected':
                    messageLabel.textContent = 'Rejection Message:';
                    break;
                case 'application-received':
                    messageLabel.textContent = 'Acknowledgment Message:';
                    break;
            }
        }
    });
    //End of Toggle Interview Section

    // Handle form submission
    submitButton.addEventListener('click', function() {

        // Validate required fields
        if (action === 'interview') {
            const interviewDate = document.getElementById('interviewDate').value;
            const interviewTime = document.getElementById('interviewTime').value;
            if (!interviewDate || !interviewTime) {
                alert('Please set both date and time for the interview');
                return;
            }
        }

        const message = document.getElementById('interviewMessage').value;
        if (!message) {
            alert('Please enter a message');
            return;
        }

        const formData = {
            action: action,
            message: message
        };

        // Add date and time only for interview action
        if (action === 'interview') {
            formData.interviewDate = document.getElementById('interviewDate').value;
            formData.interviewTime = document.getElementById('interviewTime').value;
        }

        // Handle the form submission as needed
        console.log('Form submitted:', formData);   
        
        // Close modal
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    });

    // Open date and time pickers when focused
    document.getElementById("interviewDate").addEventListener("focus", function () {
        this.showPicker(); // Force open the date picker
        document.getElementById("dateTimeGroup").style.display = "block";
    });

    document.getElementById("interviewTime").addEventListener("focus", function () {
        this.showPicker(); // Force open the time picker
        document.getElementById("dateTimeGroup").style.display = "block";
    });
