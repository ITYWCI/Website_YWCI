// Dropdown functionality
document.addEventListener('DOMContentLoaded', function() {
    // Updated dropdown functionality
    const userDropdown = document.getElementById('userDropdown');
    
    if (userDropdown) {
        const dropdownMenu = document.querySelector('.dropdown-menu');
        
        if (dropdownMenu) {
            // Toggle dropdown on click
            userDropdown.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation(); // Prevent event bubbling
                dropdownMenu.classList.toggle('show');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', function(e) {
                if (!userDropdown.contains(e.target)) {
                    dropdownMenu.classList.remove('show');
                }
            });
        }
    }
});