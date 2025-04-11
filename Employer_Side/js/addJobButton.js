// Handler for the Add New Job button
document.addEventListener('DOMContentLoaded', function() {
    const addNewJobBtn = document.querySelector('[data-action="add-new-job"]');
    
    if (addNewJobBtn) {
        addNewJobBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Store a flag in sessionStorage to indicate we want to open the add job modal
            sessionStorage.setItem('openAddJobModal', 'true');
            window.location.href = 'jobs.html';
        });
    }
});
