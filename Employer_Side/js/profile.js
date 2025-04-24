import { 
    initializePage, 
    auth, 
    db 
} from './auth.js';
import { 
    populateUserNav, 
    getInitials, 
    createInitialsAvatar 
} from './utils.js';

function hideLoader() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.classList.add('hidden');
    }
}

async function initializeProfile() {
    try {
        const user = auth.currentUser;
        if (user) {
            const userData = await getEmployerData(user.email);
            if (userData) {
                await populateUserNav();
                populateProfilePage(userData);
                
                // Update profile image with initials
                const profileImage = document.getElementById('profileInitials');
                if (profileImage) {
                    profileImage.innerHTML = createInitialsAvatar(
                        userData.firstName || '', 
                        userData.lastName || '',
                        'large'
                    );
                }
                
                hideLoader();
            } else {
                console.error("User data not found");
                hideLoader();
                window.location.href = 'login.html';
            }
        }
    } catch (error) {
        console.error("Error initializing profile:", error);
        hideLoader();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializePage(initializeProfile);
});

// Function to format full name
function formatFullName(firstName, middleName, lastName) {
    if (middleName && middleName.trim() !== "") {
        return `${firstName} ${middleName.charAt(0)}. ${lastName}`;
    } else {
        return `${firstName} ${lastName}`;
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

// Function to populate profile page
function populateProfilePage(userData) {
    // Update profile header with formatted full name and username
    const fullName = formatFullName(
        userData.firstName || '',
        userData.middleName || '',
        userData.lastName || ''
    );
    
    document.querySelector('.profile-name').textContent = fullName;
    document.querySelector('.profile-subtitle').textContent = 
        `${userData.username} | ${userData.email} - ${userData.role || 'Employer'}`;

    // Update form fields
    document.getElementById('username').value = userData.username || '';
    document.getElementById('email').value = userData.email || '';
    document.getElementById('firstName').value = userData.firstName || '';
    document.getElementById('lastName').value = userData.lastName || '';

    // Handle middle name field
    const middleNameInput = document.getElementById('middleName');
    if (!userData.middleName) {
        middleNameInput.value = '';
        middleNameInput.disabled = true;
        middleNameInput.style.backgroundColor = '#f9f9fc';
        middleNameInput.style.cursor = 'not-allowed';
        middleNameInput.style.color = '#6e707e';
    } else {
        middleNameInput.value = userData.middleName;
        middleNameInput.disabled = false;
        middleNameInput.style.backgroundColor = '';
        middleNameInput.style.cursor = '';
        middleNameInput.style.color = '';
    }

    // Update navbar name
    const navbarName = document.querySelector('.mr-2.d-none.d-lg-inline.text-gray-600.small');
    if (navbarName) {
        navbarName.textContent = `${userData.username}`;
    }
}

// Function to save profile changes
async function saveProfileChanges(e) {
    e.preventDefault();
    
    const form = document.getElementById('profile-form');
    const userData = {
        username: form.username.value.trim(),
        firstName: form.firstName.value.trim(),
        middleName: form.middleName.value.trim(),
        lastName: form.lastName.value.trim()
    };

    // Validate required fields
    if (!userData.firstName || !userData.lastName || !userData.username) {
        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                title: 'Required Fields',
                text: 'Username, First Name, and Last Name are required.',
                icon: 'warning',
                confirmButtonColor: '#3085d6',
                allowOutsideClick: false,
                allowEscapeKey: false
            });
        } else {
            alert('Username, First Name, and Last Name are required.');
        }
        return;
    }

    try {
        const user = auth.currentUser;
        
        if (user) {
            // Use the server endpoint to update the employer profile
            const response = await fetch('/api/employer/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await user.getIdToken()}`
                },
                body: JSON.stringify(userData)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to update profile: ${response.statusText}`);
            }
            
            // Show success message with SweetAlert2
            if (typeof Swal !== 'undefined') {
                await Swal.fire({
                    title: 'Success',
                    text: 'Profile is updated',
                    icon: 'success',
                    confirmButtonColor: '#3085d6',
                    allowOutsideClick: false,
                    allowEscapeKey: false
                });
            } else {
                alert('Profile is updated');
            }
            
            // Refresh the page to show updated data
            window.location.reload();
        }
    } catch (error) {
        console.error("Error updating profile:", error);
        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                title: 'Error',
                text: 'Failed to update profile. Please try again.',
                icon: 'error',
                confirmButtonColor: '#073884',
                allowOutsideClick: false,
                allowEscapeKey: false
            });
        } else {
            alert('Failed to update profile. Please try again.');
        }
    }
}

// Function to handle password toggle visibility
function setupPasswordToggles() {
    // Add event listeners to all password toggle icons
    const toggleIcons = document.querySelectorAll('.password-toggle');
    
    toggleIcons.forEach(icon => {
        icon.addEventListener('click', function() {
            // Get the target input field
            const targetId = this.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            
            // Toggle password visibility for the current field
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                this.classList.remove('fa-eye');
                this.classList.add('fa-eye-slash');
                
                // If this is either newPassword or confirmPassword, sync the other field
                if (targetId === 'newPassword' || targetId === 'confirmPassword') {
                    const otherFieldId = targetId === 'newPassword' ? 'confirmPassword' : 'newPassword';
                    const otherField = document.getElementById(otherFieldId);
                    const otherIcon = document.querySelector(`.password-toggle[data-target="${otherFieldId}"]`);
                    
                    // Set the other field to match this field's visibility
                    otherField.type = 'text';
                    if (otherIcon) {
                        otherIcon.classList.remove('fa-eye');
                        otherIcon.classList.add('fa-eye-slash');
                    }
                }
            } else {
                passwordInput.type = 'password';
                this.classList.remove('fa-eye-slash');
                this.classList.add('fa-eye');
                
                // If this is either newPassword or confirmPassword, sync the other field
                if (targetId === 'newPassword' || targetId === 'confirmPassword') {
                    const otherFieldId = targetId === 'newPassword' ? 'confirmPassword' : 'newPassword';
                    const otherField = document.getElementById(otherFieldId);
                    const otherIcon = document.querySelector(`.password-toggle[data-target="${otherFieldId}"]`);
                    
                    // Set the other field to match this field's visibility
                    otherField.type = 'password';
                    if (otherIcon) {
                        otherIcon.classList.remove('fa-eye-slash');
                        otherIcon.classList.add('fa-eye');
                    }
                }
            }
        });
    });
}

// Function to check if passwords match and update validation message
function setupPasswordValidation() {
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const validationMessage = document.getElementById('passwordMatchMessage');
    
    // Function to check password match
    function checkPasswordMatch() {
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Only show message if confirm password field has some input
        if (confirmPassword.length > 0) {
            if (newPassword === confirmPassword) {
                validationMessage.textContent = "Looks good!";
                validationMessage.classList.add('match');
                validationMessage.classList.remove('no-match');
            } else {
                validationMessage.textContent = "Passwords don't match";
                validationMessage.classList.add('no-match');
                validationMessage.classList.remove('match');
            }
        } else {
            validationMessage.textContent = "";
            validationMessage.classList.remove('match', 'no-match');
        }
    }
    
    // Add event listeners for input changes
    if (newPasswordInput && confirmPasswordInput) {
        newPasswordInput.addEventListener('input', checkPasswordMatch);
        confirmPasswordInput.addEventListener('input', checkPasswordMatch);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializePage(initializeProfile);
    
    // Add form submit handler
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', saveProfileChanges);
    }
    
    // Add event listener for password change
    const savePasswordBtn = document.getElementById('savePasswordBtn');
    if (savePasswordBtn) {
        savePasswordBtn.addEventListener('click', handlePasswordChange);
    }
    
    // Add event listener for password toggle
    setupPasswordToggles();
    
    // Setup password validation
    setupPasswordValidation();
});

// Function to handle password change
async function handlePasswordChange(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validate passwords
    if (!currentPassword || !newPassword || !confirmPassword) {
        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                title: 'Required Fields',
                text: 'All password fields are required.',
                icon: 'warning',
                confirmButtonColor: '#3085d6'
            });
        } else {
            alert('All password fields are required.');
        }
        return;
    }
    
    if (newPassword !== confirmPassword) {
        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                title: 'Password Mismatch',
                text: 'New password and confirm password do not match.',
                icon: 'error',
                confirmButtonColor: '#3085d6'
            });
        } else {
            alert('New password and confirm password do not match.');
        }
        return;
    }
    
    try {
        const user = auth.currentUser;
        
        if (user) {
            // We need to use the Firebase Auth SDK directly for password changes
            // First, dynamically import the required Firebase auth modules
            const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = 
                await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js");
            
            // Reauthenticate user before changing password
            const credential = EmailAuthProvider.credential(
                user.email,
                currentPassword
            );
            
            await reauthenticateWithCredential(user, credential);
            
            // Change password
            await updatePassword(user, newPassword);
            
            // Show success message
            if (typeof Swal !== 'undefined') {
                await Swal.fire({
                    title: 'Success',
                    text: 'Password has been updated successfully.',
                    icon: 'success',
                    confirmButtonColor: '#3085d6'
                });
            } else {
                alert('Password has been updated successfully.');
            }
            
            // Clear password fields
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            
            // Hide validation messages
            document.getElementById('passwordMatch').style.display = 'none';
            document.getElementById('passwordStrength').style.display = 'none';
        }
    } catch (error) {
        console.error("Error changing password:", error);
        
        let errorMessage = 'Failed to change password. Please try again.';
        
        // Handle specific error cases
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'Current password is incorrect.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'New password is too weak. Please use a stronger password.';
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = 'This operation requires recent authentication. Please log in again before retrying.';
            // Redirect to login page after a short delay
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        }
        
        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                title: 'Error',
                text: errorMessage,
                icon: 'error',
                confirmButtonColor: '#3085d6'
            });
        } else {
            alert(errorMessage);
        }
    }
}   
