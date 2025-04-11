import {
    initializePage,
    db } from './auth.js';
import { populateUserNav } from './utils.js';
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    query,
    where,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

function hideLoader() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.classList.add('hidden');
    }
}

async function initializeAbout() {
    try {
        await populateUserNav();
        hideLoader();
    } catch (error) {
        console.error("Error initializing about page:", error);
        hideLoader(); // Hide loader even on error
    }
}

// Initialize when DOM is ready (fixed the recursive call to initializePage)
document.addEventListener('DOMContentLoaded', () => {
    initializePage(initializeAbout);
});
