import {
    initializePage,
    db } from './auth.js';
import { 
    getAuth, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
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

// Page-specific initialization
async function initializeInbox() { 
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializePage(initializeInbox);
});

document.addEventListener('DOMContentLoaded', () => {
    // Save current URL if not on login page
    if (!window.location.pathname.includes('login.html')) {
        sessionStorage.setItem('lastVisitedUrl', window.location.pathname);
    }
    
    initializePage(initializeInbox);
});

document.addEventListener('DOMContentLoaded', function() {
    const contactItems = document.querySelectorAll('.contact-item');
    const chatArea = document.querySelector('.chat-area');
    const contactsList = document.querySelector('.contacts-list');
    const searchInput = document.getElementById('messageSearch');

    // Initialize empty state
    chatArea.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <h2>You have messages</h2>
            <p>Select a conversation to read</p>
        </div>
    `;

    function showChatView(contactName, contactImage) {
        const isMobile = window.innerWidth <= 768;
        
        chatArea.innerHTML = `
            <div class="current-chat-info">
                ${isMobile ? '<button class="back-button"><i class="fas fa-arrow-left"></i></button>' : ''}
                <div class="current-chat-avatar">
                    <img src="${contactImage}" alt="${contactName}">
                </div>
                <div class="current-chat-name">${contactName}</div>
            </div>
            <div class="chat-messages" id="chatMessages">
                <div class="message sent">
                    <div class="message-content">
                        I recently came across the Dub [TD1] platform on product hunt today and was pleasantly surprised. I was able to add my link and the redirect process. Thank you!
                        <div class="time-stamp">10:00 AM</div>
                    </div>
                </div>
            </div>
            <div class="message-input">
                <input type="text" placeholder="Type a message..." id="messageInput">
            </div>
        `;

        if (isMobile) {
            contactsList.classList.add('hidden');
            chatArea.classList.add('active');
            
            // Add back button functionality
            const backButton = document.querySelector('.back-button');
            backButton.addEventListener('click', function() {
                contactsList.classList.remove('hidden');
                chatArea.classList.remove('active');
                chatArea.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h2>You have messages</h2>
                        <p>Select a conversation to read</p>
                    </div>
                `;
            });
        }

        // Message input handler
        const messageInput = document.getElementById('messageInput');
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && this.value.trim()) {
                const chatMessages = document.getElementById('chatMessages');
                const messageElement = document.createElement('div');
                messageElement.className = 'message sent';
                messageElement.innerHTML = `
                    <div class="message-content">
                        ${this.value.trim()}
                        <div class="time-stamp">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                `;
                chatMessages.appendChild(messageElement);
                this.value = '';
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        });
    }

    // Contact click handler
    contactItems.forEach(contact => {
        contact.addEventListener('click', function() {
            const contactName = this.querySelector('.contact-name')?.textContent;
            const contactImage = this.querySelector('.contact-avatar img')?.src;
            
            if (contactName && contactImage) {
                showChatView(contactName, contactImage);
            }
        });
    });

    // Compose button click handler
    const composeBtn = document.querySelector('.compose-btn');
    composeBtn.addEventListener('click', function() {
        // Create new message entry at the top
        const newMessageEntry = document.createElement('div');
        newMessageEntry.className = 'contact-item';
        newMessageEntry.innerHTML = `
            <div class="contact-info">
                <div class="contact-name">New Message</div>
                <div class="contact-preview">Start a new conversation</div>
            </div>
        `;
        contactsList.insertBefore(newMessageEntry, contactsList.firstChild);

        // Replace the clicked contact's name with To: input
        const toField = document.createElement('div');
        toField.className = 'to-field-container';
        toField.innerHTML = `
            <input type="text" id="recipientSearch" placeholder="To:">
        `;
        const firstContactInfo = document.querySelector('.contact-item .contact-info');
        firstContactInfo.replaceWith(toField);

        const recipientSearch = document.getElementById('recipientSearch');
        recipientSearch.focus();

        // Handle recipient search
        recipientSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const contacts = document.querySelectorAll('.contact-item:not(:first-child)');
            let hasResults = false;

            contacts.forEach(contact => {
                const name = contact.querySelector('.contact-name')?.textContent.toLowerCase();
                if (name && name.includes(searchTerm)) {
                    contact.style.display = '';
                    hasResults = true;
                } else {
                    contact.style.display = 'none';
                }
            });

            if (!hasResults && searchTerm) {
                const existingNoResults = contactsList.querySelector('.no-results');
                if (!existingNoResults) {
                    const noResults = document.createElement('div');
                    noResults.className = 'no-results';
                    noResults.innerHTML = `
                        <div class="empty-search">
                            <i class="fas fa-search"></i>
                            <p>No results found</p>
                        </div>
                    `;
                    contactsList.insertBefore(noResults, contactsList.children[1]);
                }
            } else {
                const existingNoResults = contactsList.querySelector('.no-results');
                if (existingNoResults) {
                    existingNoResults.remove();
                }
            }
        });
    });

    // Main search functionality
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const contacts = document.querySelectorAll('.contact-item');
        let hasResults = false;
    
        contacts.forEach(contact => {
            const name = contact.querySelector('.contact-name')?.textContent.toLowerCase();
            const preview = contact.querySelector('.contact-preview')?.textContent.toLowerCase();
            
            if (name && (name.includes(searchTerm) || (preview && preview.includes(searchTerm)))) {
                contact.style.display = '';
                hasResults = true;
            } else {
                contact.style.display = 'none';
            }
        });
    
        // Update empty state based on search results
        if (!searchTerm) {
            // Reset to default empty state when search is cleared
            chatArea.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h2>You have messages</h2>
                    <p>Select a conversation to read</p>
                </div>
            `;
        } else if (!hasResults) {
            // Show no results state
            chatArea.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h2>No results found</h2>
                    <p>Try searching with different terms</p>
                </div>
            `;
        } else if (chatArea.querySelector('.empty-state')) {
            // Reset to default empty state when results are found
            chatArea.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h2>You have messages</h2>
                    <p>Select a conversation to read</p>
                </div>
            `;
        }
    });

    // Contact click handler
    function attachContactClickHandlers() {
        const contacts = document.querySelectorAll('.contact-item');
        contacts.forEach(contact => {
            contact.addEventListener('click', function() {
                const contactName = this.querySelector('.contact-name')?.textContent;
                const contactImage = this.querySelector('.contact-avatar img')?.src;
                
                if (contactName && contactImage) {
                    // Clear search
                    if (searchInput) searchInput.value = '';
                    
                    // Show all contacts
                    contacts.forEach(c => c.style.display = '');
                    
                    // Remove any "New Message" or recipient search
                    const newMessage = document.querySelector('.to-field-container');
                    if (newMessage) newMessage.remove();
                    
                    showChatView(contactName, contactImage);
                }
            });
        });
    }

    // Initial attachment of click handlers
    attachContactClickHandlers();
});