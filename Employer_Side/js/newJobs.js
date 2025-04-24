import { db, auth, initializeFirebase } from './auth.js';


// Initialize Firebase first
initializeFirebase().then(() => {
    console.log('Firebase initialized in newJobs.js');
    // Call displayRecentJobs after Firebase is initialized
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', displayRecentJobs);
    } else {
        displayRecentJobs();
    }
}).catch(error => {
    console.error("Error initializing Firebase in newJobs:", error);
});

async function displayRecentJobs() {
    try {
        // Make sure Firebase is initialized
        if (!auth.currentUser) {
            console.log('Waiting for authentication...');
            return;
        }

        // Calculate date 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        console.log('Fetching jobs after:', sevenDaysAgo); // Debug log

        // Use the server endpoint to get jobs
        const response = await fetch('/api/employer/jobs/' + await getCurrentEmployerId(), {
            headers: {
                'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch jobs: ${response.statusText}`);
        }
        
        const jobs = await response.json();
        const recentJobs = jobs.filter(job => {
            const timestamp = job.timestamp?.toDate?.() || new Date(job.timestamp);
            return timestamp >= sevenDaysAgo;
        }).sort((a, b) => {
            const dateA = a.timestamp?.toDate?.() || new Date(a.timestamp);
            const dateB = b.timestamp?.toDate?.() || new Date(b.timestamp);
            return dateB - dateA; // Sort in descending order (newest first)
        });

        console.log('Found recent jobs uploaded within 7 days:', recentJobs.length); // Debug log
        
        // We've already processed the jobs data in the filter/sort above
        // No need to iterate through querySnapshot anymore

        // Get and style the container
        const chartArea = document.querySelector('#recentJobsArea');
        if (!chartArea) {
            chartArea = document.querySelector('.chart-pie');
            if (!chartArea) {
                console.error('Chart area not found with either selector');
                return;
            }
        }

        // Remove any existing classes that might add padding
        chartArea.className = 'chart-area';

        // Clear existing content and set styles
        chartArea.innerHTML = '';
        chartArea.style.cssText = `
            height: 300px;
            overflow: hidden;
            position: relative;
            padding: 0;
            margin: 0;
        `;

        async function getEmployerName(employerId) {
            try {
                if (!employerId) {
                    console.log("No employerId provided"); // Debug log
                    return 'N/A';
                }
                
                console.log("Fetching employer with ID:", employerId); // Debug log
                
                const employersRef = collection(db, "employers");
                const q = query(employersRef, where("employerId", "==", employerId));
                const querySnapshot = await getDocs(q);
                
                console.log("Query results:", querySnapshot.size); // Debug log
                
                if (!querySnapshot.empty) {
                    const employerData = querySnapshot.docs[0].data();
                    console.log("Employer data found:", employerData); // Debug log
                    
                    const firstName = employerData.firstName || '';
                    const middleName = employerData.middleName || '';
                    const lastName = employerData.lastName || '';
                    
                    if (firstName && lastName) {
                        if (middleName) {
                            return `${firstName} ${middleName}. ${lastName}`;
                        }
                        return `${firstName} ${lastName}`;
                    }
                }
                
                console.log("No employer found for ID:", employerId); // Debug log
                return 'N/A';
            } catch (error) {
                console.error("Error getting employer name:", error);
                return 'N/A';
            }
        }

        // Find the card-body parent and remove its padding
        const cardBody = chartArea.closest('.card-body');
        if (cardBody) {
            cardBody.style.padding = '0';
        }

        // Create new jobs list
        const jobsList = document.createElement('div');
        jobsList.className = 'recent-jobs-list';
        jobsList.style.cssText = `
            height: 100%;
            overflow-y: auto;
            padding: 0;
            width: 100%;
            scrollbar-width: thin;
            scrollbar-color: #a0aec0 #edf2f7;
            margin: 0;
            box-sizing: border-box;
        `;

        // Add webkit scrollbar styles to the head
        const style = document.createElement('style');
        style.textContent = `
            .recent-jobs-list::-webkit-scrollbar {
                width: 6px;
            }
            .recent-jobs-list::-webkit-scrollbar-track {
                background: #edf2f7;
                border-radius: 3px;
            }
            .recent-jobs-list::-webkit-scrollbar-thumb {
                background-color: #a0aec0;
                border-radius: 3px;
            }
        `;
        document.head.appendChild(style);

        if (recentJobs.length === 0) {
            jobsList.innerHTML = `
                <div class="no-jobs" style="
                    text-align: center; 
                    padding: 20px 0;
                    font-family: interRegular; 
                    color: #666;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                ">
                    <i class="fas fa-briefcase" style="
                        font-size: 48px;
                        color: #e3e6f0;
                        margin-bottom: 10px;
                    "></i>
                    <div>No recent jobs within 7 days</div>
                </div>
            `;
        } else {
            recentJobs.forEach(async job => {
                const userElement = document.createElement('div');
                userElement.className = 'job-item';
                userElement.style.cssText = `
                    padding: 8px;
                    border-bottom: 1px solid #e3e6f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 10px;
                    width: 100%;
                    flex-wrap: wrap;
                `;
            
                // Get employer name
                const employerName = await getEmployerName(job.employerId);
            
                // Format the dates using the Firebase Timestamp
                const uploadDate = formatTimeAgo(job.timestamp);
                const lastEditedDate = job.lastEdited ? formatFullDate(job.lastEdited) : '';
            
                userElement.innerHTML = `
                    <div class="job-info" style="flex: 1; min-width: 200px;">
                        <div class="job-title" style="font-family: interBold; color: #073884; word-break: break-word;">
                            ${job.title}
                        </div>
                        <div class="job-details" style="font-family: interRegular; color: #666; font-size: 0.9em; word-break: break-word;">
                            <span class="job-company">${job.company}</span> • 
                            <span class="job-type">${job.type}</span> • 
                            <span class="job-location">${job.location}</span>
                        </div>
                    </div>
                    <div class="timestamp-container" style="font-family: interRegular; color: #666; font-size: 0.9em; text-align: right;">
                        <div class="job-time-added">Uploaded by ${employerName} ${uploadDate}</div>
                    </div>
                `;
            
                jobsList.appendChild(userElement);
            });
        }

        chartArea.appendChild(jobsList);

    } catch (error) {
        console.error("Error fetching recent jobs:", error);
        console.error("Error details:", error.message);
        const chartArea = document.querySelector('#recentJobsArea');
        if (chartArea) {
            chartArea.innerHTML = `
                <div style="text-align: center; padding: 20px; font-family: interRegular; color: #666;">
                    Error loading recent jobs. Please try again later.
                </div>
            `;
        }
    }
}

// We're now initializing in the initializeFirebase().then() call above

// Helper function to get current employer ID
async function getCurrentEmployerId() {
    try {
        const response = await fetch('/api/employer/current-id', {
            headers: {
                'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to get employer ID: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.employerId;
    } catch (error) {
        console.error("Error getting employer ID:", error);
        return null;
    }
}

// Add these helper functions at the end of your file
function formatTimeAgo(timestamp) {
    if (!timestamp || !timestamp.toDate) {
        return 'Date not available';
    }

    const date = timestamp.toDate();
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
        return 'just now';
    } else if (minutes < 60) {
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (hours < 24) {
        return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else if (days < 7) {
        return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    } else {
        return formatFullDate(timestamp);
    }
}

function formatFullDate(timestamp) {
    if (!timestamp || !timestamp.toDate) {
        return 'Date not available';
    }

    const date = timestamp.toDate();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours() % 12 || 12;
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = date.getHours() >= 12 ? 'pm' : 'am';
    
    return `${month} ${day}, ${year}, ${hours}:${minutes} ${ampm}`;
} 