// Import Firebase modules
import {
    auth,
    db 
} from './auth.js';

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
const loginForm = document.getElementById('loginForm');
const emailInput = document.querySelector('input[type="email"]');
const passwordInput = document.querySelector('input[type="password"]');
const signInButton = document.querySelector('.sign-in-btn');

// Email validation function
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Password validation function
function isValidPassword(password) {
    return password.length >= 6;
}

// Check if employer exists and get their email
async function getEmployerEmail(identifier) {
    try {
        const employersRef = collection(db, "employers");
        let q;
        
        // Check if the identifier is an email or username
        if (isValidEmail(identifier)) {
            q = query(employersRef, where("email", "==", identifier.toLowerCase()));
        } else {
            q = query(employersRef, where("username", "==", identifier));
        }
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            return userData.email.toLowerCase();
        }
        return null;
    } catch (error) {
        console.error("Error checking employer:", error);
        return null;
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const identifier = emailInput.value.trim();
    const password = passwordInput.value.trim();

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
        // Get the email if user entered a username
        const email = await getEmployerEmail(identifier);
        
        if (!email) {
            emailInput.style.borderColor = '#ff0000';
            confirm("No employer account found with this email/username.");
            return;
        }

        // Try to sign in with Firebase Auth
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Store user email in session storage for dashboard
            sessionStorage.setItem('userEmail', email);
            
            // Get the last visited URL or default to dashboard
            const lastVisitedUrl = sessionStorage.getItem('lastVisitedUrl');
            // Clear the saved URL
            sessionStorage.removeItem('lastVisitedUrl');
            
            // Redirect to the last visited page or dashboard
            if (lastVisitedUrl && !lastVisitedUrl.includes('login.html')) {
                window.location.href = lastVisitedUrl;
            } else {
                window.location.href = 'dashboard.html';
            }
            
        } catch (authError) {
            console.error("Authentication error:", authError);
            switch (authError.code) {
                case 'auth/wrong-password':
                    passwordInput.style.borderColor = '#ff0000';
                    confirm("Incorrect password. Please try again.");
                    passwordInput.value = '';
                    passwordInput.focus();
                    break;
                case 'auth/user-not-found':
                    emailInput.style.borderColor = '#ff0000';
                    confirm("No account found with this email/username.");
                    break;
                case 'auth/too-many-requests':
                    confirm("Too many failed login attempts. Please try again later.");
                    break;
                default:
                    confirm("Login failed. Please try again.");
                    console.error("Auth error:", authError);
            }
        }
    } catch (error) {
        console.error("Login error:", error);
        confirm("An error occurred during login. Please try again.");
    }
}

// Add event listeners
if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
}

if (signInButton) {
    signInButton.addEventListener('click', handleLogin);
}

// Real-time validation as user types
if (emailInput) {
    emailInput.addEventListener('input', () => {
        if (emailInput.value.trim() !== '') {
            emailInput.style.borderColor = '#4CAF50';
        } else {
            emailInput.style.borderColor = '';
        }
    });
}

if (passwordInput) {
    passwordInput.addEventListener('input', () => {
        if (passwordInput.value.trim() !== '') {
            if (!isValidPassword(passwordInput.value.trim())) {
                passwordInput.style.borderColor = '#ff0000';
            } else {
                passwordInput.style.borderColor = '#4CAF50';
            }
        } else {
            passwordInput.style.borderColor = '';
        }
    });
}