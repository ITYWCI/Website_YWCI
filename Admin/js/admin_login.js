import {
    auth,
    db 
} from './firebase-config.js';

import { 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

import { 
    collection, 
    query, 
    where, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Get DOM elements
const loginForm = document.getElementById('adminLoginForm');
const emailInput = document.querySelector('input[name="identifier"]');
const passwordInput = document.querySelector('input[name="password"]');
const errorDiv = document.getElementById('error-message');
const loadingOverlay = document.getElementById('loadingOverlay');
const signInButton = document.querySelector('.sign-in-btn');

// Show/hide loader functions
function showLoader() {
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
}

function hideLoader() {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

function showError(message) {
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

// Email validation function
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Password validation function
function isValidPassword(password) {
    return password.length >= 6;
}

// Check if admin exists and get their email
async function getAdminEmail(identifier) {
    try {
        console.log('Checking admin with identifier:', identifier);
        const adminsRef = collection(db, "admins");
        let q;
        
        // Check if the identifier is an email
        if (identifier.includes('@')) {
            q = query(adminsRef, where("email", "==", identifier.toLowerCase()));
            console.log('Querying by email:', identifier.toLowerCase());
        } else {
            q = query(adminsRef, where("username", "==", identifier));
            console.log('Querying by username:', identifier);
        }
        
        const querySnapshot = await getDocs(q);
        console.log('Query result empty?', querySnapshot.empty);
        
        if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            console.log('Found admin data:', userData);
            return userData.email.toLowerCase();
        }
        return null;
    } catch (error) {
        console.error("Error checking admin:", error);
        return null;
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    console.log('Login attempt started');
    
    const identifier = emailInput.value.trim();
    const password = passwordInput.value.trim();

    console.log('Identifier:', identifier);
    console.log('Password length:', password.length);

    // Reset any previous error styles
    emailInput.style.borderColor = '';
    passwordInput.style.borderColor = '';

    // Validate identifier is not empty
    if (!identifier) {
        emailInput.style.borderColor = '#ff0000';
        confirm("Please enter your email or username.");
        emailInput.focus();
        return;
    }

    // Validate password
    if (!isValidPassword(password)) {
        passwordInput.style.borderColor = '#ff0000';
        confirm("Password must be at least 6 characters long.");
        passwordInput.focus();
        return;
    }

    try {
        // First check if this is an admin account
        const email = await getAdminEmail(identifier);
        console.log('Retrieved admin email:', email);
        
        if (!email) {
            emailInput.style.borderColor = '#ff0000';
            confirm("No admin account found with this email/username.");
            return;
        }

        try {
            console.log('Attempting Firebase auth with email:', email);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('Auth successful:', userCredential.user.email);
            
            // Double check admin status
            const adminsRef = collection(db, "admins");
            const q = query(adminsRef, where("email", "==", email));
            const adminSnapshot = await getDocs(q);
            
            if (adminSnapshot.empty) {
                console.log('Admin verification failed');
                await auth.signOut();
                confirm("This account does not have admin privileges.");
                return;
            }
            
            console.log('Admin verification successful');
            // Store admin email in session storage
            sessionStorage.setItem('adminEmail', email);
            
            // Redirect to dashboard
            window.location.href = 'admin_dashboard.html';
            
        } catch (authError) {
            console.error("Authentication error:", authError);
            
            if (authError.code === 'auth/invalid-login-credentials' || 
                authError.code === 'auth/wrong-password') {
                passwordInput.style.borderColor = '#ff0000';
                confirm("Incorrect password. Please try again.");
                passwordInput.value = '';
                passwordInput.focus();
            } else {
                confirm("Login failed: " + authError.message);
            }
        }
    } catch (error) {
        console.error("Login error:", error);
        confirm("An error occurred during login. Please try again.");
    }
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Get elements after DOM is loaded
    const loginForm = document.getElementById('adminLoginForm');
    const emailInput = document.querySelector('input[name="identifier"]');
    const passwordInput = document.querySelector('input[name="password"]');
    const signInButton = document.querySelector('.sign-in-btn');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (signInButton) {
        signInButton.addEventListener('click', handleLogin);
    }

    // Real-time validation as user types
    if (emailInput) {
        emailInput.addEventListener('input', () => {
            emailInput.style.borderColor = emailInput.value.trim() ? '#4CAF50' : '';
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            passwordInput.style.borderColor = passwordInput.value.trim() ? '#4CAF50' : '';
        });
    }
});

// Show/hide password functionality
const togglePassword = document.querySelector('#togglePassword');
const password = document.querySelector('#password');

if (togglePassword && password) {
    togglePassword.addEventListener('click', function () {
        const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
        password.setAttribute('type', type);
        
        // Toggle eye icon
        this.innerHTML = type === 'password' ? 
            '<i class="fas fa-eye"></i>' : 
            '<i class="fas fa-eye-slash"></i>';
    });
}
