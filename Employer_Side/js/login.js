// Import Firebase modules
import {
    auth,
    db,
    initializeFirebase
} from './auth.js';

// Get DOM elements
const loginForm = document.getElementById('loginForm');
const emailInput = document.querySelector('input[type="email"]');
const passwordInput = document.querySelector('input[type="password"]');
const signInButton = document.querySelector('.sign-in-btn');
const adminLogo = document.getElementById('adminLogo');

// Email validation function
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Password validation function
function isValidPassword(password) {
    return password.length >= 6;
}

// Initialize Firebase first
initializeFirebase().then(() => {
    console.log('Firebase initialized in login.js');
    
    // Add event listener to login form after Firebase is initialized
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}).catch(error => {
    console.error("Error initializing Firebase in login:", error);
});

// Check if employer exists and get their email
async function getEmployerEmail(identifier) {
    try {
        // Make sure Firebase is initialized
        if (!auth || !db) {
            await initializeFirebase();
        }
        
        // Use the server API to check credentials
        const response = await fetch('/api/auth/check-credentials', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ identifier })
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.email;
        }
        
        return null;
    } catch (error) {
        console.error("Error checking credentials:", error);
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
            // Dynamically import Firebase auth for login
            const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js");
            
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
                // Make sure to use the full path to dashboard
                window.location.href = '/Employer_Side/dashboard.html';
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

// Add click counter for admin redirect
let logoClickCount = 0;
let lastClickTime = 0;
const CLICK_TIMEOUT = 2000; // Reset counter after 2 seconds of inactivity

if (adminLogo) {
    adminLogo.addEventListener('click', () => {
        const currentTime = new Date().getTime();
        
        // Reset counter if more than 2 seconds have passed since last click
        if (currentTime - lastClickTime > CLICK_TIMEOUT) {
            logoClickCount = 0;
        }
        
        lastClickTime = currentTime;
        logoClickCount++;
        
        // Redirect to admin login after 3 clicks
        if (logoClickCount === 3) {
            window.location.href = '../Admin/admin_login.html';
        }
    });
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