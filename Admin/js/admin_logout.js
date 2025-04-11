import { 
    getAuth, 
    signOut 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Logout function
async function handleAdminLogout() {
    try {
        const auth = getAuth();
        await signOut(auth);
        localStorage.removeItem('adminAuthData');
        localStorage.removeItem('adminToken');
        window.location.href = 'admin_login.html';
    } catch (error) {
        console.error("Error signing out:", error);
        alert('Error signing out. Please try again.');
    }
}

// Add event listener when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleAdminLogout);
    }
}); 