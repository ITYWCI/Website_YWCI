import { 
    collection, 
    getDocs, 
    query, 
    where,
    orderBy,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

import { 
    deleteUser,
    signInWithEmailAndPassword,
    getAuth,
    createUserWithEmailAndPassword,
    signOut,
    signInWithCustomToken
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

import { auth, db, functions } from './firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";

// Delete employer completely (both auth and firestore)
async function deleteEmployerCompletely(employerId) {
    try {
        console.log("Starting employer deletion process with ID:", employerId);
        console.log("Type of document ID:", typeof employerId);
        
        // More robust check for employerId
        if (!employerId || typeof employerId !== 'string') {
            console.error("Invalid document ID provided:", employerId);
            throw new Error('No document ID provided or invalid ID type');
        }
        
        // Get admin credentials from session storage
        const adminEmail = sessionStorage.getItem('adminEmail');
        
        if (!adminEmail) {
            throw new Error('Admin email not found in session storage');
        }
        
        console.log("Admin email retrieved:", adminEmail);
        console.log("Document ID to delete:", employerId);
        
        // Create the request body
        const requestBody = {
            adminEmail: adminEmail,
            userId: employerId
        };
        
        console.log("Sending request with body:", JSON.stringify(requestBody));
        
        // Delete the Authentication user using XMLHttpRequest
        const deleteUserPromise = new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://us-central1-ywci-website.cloudfunctions.net/adminDeleteUserHttp', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            
            xhr.onload = function() {
                try {
                    const response = JSON.parse(xhr.responseText);
                    console.log("Server response:", response);
                    
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(response);
                    } else {
                        reject(new Error(`Request failed with status ${xhr.status}: ${xhr.responseText}`));
                    }
                } catch (e) {
                    reject(new Error(`Invalid response format: ${xhr.responseText}`));
                }
            };
            
            xhr.onerror = function() {
                reject(new Error('Network error occurred'));
            };
            
            const jsonBody = JSON.stringify(requestBody);
            console.log("Sending JSON body:", jsonBody);
            xhr.send(jsonBody);
        });
        
        const result = await deleteUserPromise;
        console.log("Delete user result:", result);
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to delete authentication user');
        }
        
        console.log("Authentication user deleted successfully");
        
        // Delete the employer document
        const employerRef = doc(db, "employers", employerId);
        await deleteDoc(employerRef);
        console.log("Employer document deleted");
        
        return {
            success: true,
            message: 'Employer and authentication completely deleted'
        };
        
    } catch (error) {
        console.error("Error in deleteEmployerCompletely:", error);
        throw error;
    }
}

// Update employer details
async function updateEmployer(employerId, employerData) {
    try {
        // Reference to the employer document
        const employerRef = doc(db, "employers", employerId);
        
        // Update the document with the new data
        await updateDoc(employerRef, {
            firstName: employerData.firstName,
            lastName: employerData.lastName,
            middleName: employerData.middleName,
            email: employerData.email,
            username: employerData.username // Make sure username is included
        });
        
        return { success: true };
    } catch (error) {
        console.error("Error updating employer:", error);
        return { 
            success: false, 
            message: error.message || 'Failed to update employer'
        };
    }
}

// Create new employer
async function createEmployer(employerData, password) {
    try {
        // Store current admin credentials
        const adminEmail = sessionStorage.getItem('adminEmail');
        const adminPassword = sessionStorage.getItem('adminPassword');
        
        if (!adminEmail || !adminPassword) {
            throw new Error('Admin credentials not found');
        }

        // Create auth user first
        const userCredential = await createUserWithEmailAndPassword(auth, employerData.email, password);
        const uid = userCredential.user.uid;

        // Remove password from employerData before storing in Firestore
        const { password: _, ...employerDataWithoutPassword } = employerData;

        // Add employer to Firestore without the password
        const employerRef = doc(db, "employers", uid);
        await setDoc(employerRef, {
            ...employerDataWithoutPassword,
            createdAt: serverTimestamp()
        });

        // Sign back in as admin
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

        return {
            success: true,
            message: "Employer created successfully",
            employerId: uid
        };
    } catch (error) {
        // If any error occurs, try to sign back in as admin
        const adminEmail = sessionStorage.getItem('adminEmail');
        const adminPassword = sessionStorage.getItem('adminPassword');
        if (adminEmail && adminPassword) {
            await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        }
        
        console.error("Error creating employer:", error);
        throw error;
    }
}

// Get next employer ID
async function getNextEmployerId() {
    try {
        const employersRef = collection(db, "employers");
        const querySnapshot = await getDocs(employersRef);
        const nextNumber = querySnapshot.size + 1;
        return `employer${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
        console.error("Error getting next employer ID:", error);
        throw error;
    }
}

export {
    deleteEmployerCompletely,
    updateEmployer,
    createEmployer,
    getNextEmployerId
}; 