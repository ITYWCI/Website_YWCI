import { getCurrentUserData } from './auth.js';

// Format date to a readable string
export function formatDate(timestamp) {
    if (!timestamp || !timestamp._seconds) return 'N/A';
    const date = new Date(timestamp._seconds * 1000);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format currency
export function formatCurrency(amount) {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
    }).format(amount);
}

// Get current user data
export async function getUserData() {
    return await getCurrentUserData();
}

// Show loading spinner
export function showSpinner(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="d-flex justify-content-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">Loading...</span>
                </div>
            </div>`;
    }
}

// Hide loading spinner
export function hideSpinner(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
}

// Show error message
export function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="alert alert-danger" role="alert">
                ${message}
            </div>`;
    }
}

// Format phone number
export function formatPhoneNumber(phone) {
    if (!phone) return 'N/A';
    // Assuming Philippine format
    const cleaned = ('' + phone).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
        return '(' + match[1] + ') ' + match[2] + '-' + match[3];
    }
    return phone;
}

// Validate email
export function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

// Truncate text
export function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

// Get initials
export function getInitials(firstName = '', lastName = '') {
    const firstInitial = firstName ? firstName.charAt(0) : '';
    const lastInitial = lastName ? lastName.charAt(0) : '';
    return (firstInitial + lastInitial).toUpperCase();
}

// Create initials avatar
export function createInitialsAvatar(firstName, lastName, className = '') {
    return `
        <div class="img-profile rounded-circle initials-circle ${className}">
            ${getInitials(firstName, lastName)}
        </div>
    `;
}

// Populate user nav
export async function populateUserNav() {
    const userData = await getUserData();
    if (userData) {
        // Update name display
        const userNameElement = document.querySelector('.mr-2.d-none.d-lg-inline.text-gray-600.small');
        if (userNameElement) {
            userNameElement.textContent = `${userData.firstName} ${userData.lastName}`;
        }

        // Update avatar
        const userImgElement = document.querySelector('.img-profile');
        if (userImgElement) {
            userImgElement.outerHTML = createInitialsAvatar(userData.firstName, userData.lastName, 'img-profile');
        }
    }
}
