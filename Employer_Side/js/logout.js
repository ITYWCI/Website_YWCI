// Add this function to each of your JS files (dashboard.js, profile.js, applicants.js, inbox.js, jobs.js)

// Make sure you have the signOut import in your Firebase auth imports
import { 
    getAuth, 
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Add this function
async function handleLogout() {
    try {
        const auth = getAuth();
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Error signing out:", error);
        alert('Error signing out. Please try again.');
    }
}

// Add this event listener in your DOMContentLoaded event or at the bottom of your file
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.querySelector('.logout-button'); // Add this class to your logout button
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
});