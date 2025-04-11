// Add these imports at the top
import { auth, db } from './auth.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

export async function getCurrentUserData() {
    try {
        const user = auth.currentUser;
        if (user) {
            const employersRef = collection(db, "employers");
            const q = query(employersRef, where("email", "==", user.email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                return querySnapshot.docs[0].data();
            }
        }
        return null;
    } catch (error) {
        console.error("Error getting current user data:", error);
        return null;
    }
}

export function getInitials(firstName = '', lastName = '') {
    const firstInitial = firstName ? firstName.charAt(0) : '';
    const lastInitial = lastName ? lastName.charAt(0) : '';
    return (firstInitial + lastInitial).toUpperCase();
}

export function createInitialsAvatar(firstName, lastName, className = '') {
    return `
        <div class="img-profile rounded-circle initials-circle ${className}">
            <span class="initials">${getInitials(firstName, lastName)}</span>
        </div>
    `;
}

export async function populateUserNav() {
    const userData = await getCurrentUserData();
    if (userData) {
        // Update name display
        const userNameElement = document.querySelector('.mr-2.d-none.d-lg-inline.text-gray-600.small');
        if (userNameElement) {
            userNameElement.textContent = userData.username;
        }
        
        // Update avatar with initials
        const avatarContainer = document.querySelector('.img-profile');
        if (avatarContainer) {
            avatarContainer.outerHTML = createInitialsAvatar(userData.firstName, userData.lastName);
        }
    }
}