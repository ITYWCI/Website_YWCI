import { db } from './auth.js';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

async function displayRecentApplicants() {
    try {
        // Calculate date 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Query for applications
        const applicationsRef = collection(db, "applicants");
        const applicationsQuery = query(
            applicationsRef,
            where("createdAt", ">=", sevenDaysAgo),
            orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(applicationsQuery);
        const recentApplicants = [];

        querySnapshot.forEach(doc => {
            const data = doc.data();
            recentApplicants.push({
                name: `${data.firstName} ${data.middleName ? data.middleName + ' ' : ''}${data.lastName}`,
                jobTitle: data.jobTitle || 'N/A',
                company: data.company || 'N/A',
                createdAt: data.createdAt?.toDate() || new Date(),
            });
        });

        // Get and style the container
        const chartArea = document.querySelector('#newApplicants').closest('.chart-area');
        if (!chartArea) return;

        // Clear existing content
        chartArea.innerHTML = '';
        chartArea.style.cssText = `
            height: 300px;
            overflow: hidden;
            position: relative;
            padding: 0;
            margin: 0;
        `;

        // Create new applicants list
        const applicantsList = document.createElement('div');
        applicantsList.className = 'recent-applicants-list';
        applicantsList.style.cssText = `
            height: 100%;
            overflow-y: auto;
            padding: 10px;
            width: 100%;
            scrollbar-width: thin;
            scrollbar-color: #a0aec0 #edf2f7;
            margin: 0;
            box-sizing: border-box;
        `;

        // Add webkit scrollbar styles to the head
        const style = document.createElement('style');
        style.textContent = `
            .recent-applicants-list::-webkit-scrollbar {
                width: 6px;
            }
            .recent-applicants-list::-webkit-scrollbar-track {
                background: #edf2f7;
                border-radius: 3px;
            }
            .recent-applicants-list::-webkit-scrollbar-thumb {
                background-color: #a0aec0;
                border-radius: 3px;
            }
        `;
        document.head.appendChild(style);

        if (recentApplicants.length === 0) {
            applicantsList.innerHTML = `
                <div class="no-applicants" style="
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
                    <i class="fas fa-user-tie" style="
                        font-size: 48px;
                        color: #e3e6f0;
                        margin-bottom: 10px;
                    "></i>
                    <div>No recent applicants within 7 days</div>
                </div>
            `;
        } else {
            recentApplicants.forEach(applicant => {
                const applicantElement = document.createElement('div');
                applicantElement.className = 'applicant-item';
                applicantElement.style.cssText = `
                    padding: 8px;
                    border-bottom: 1px solid #e3e6f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 10px;
                    width: 100%;
                    flex-wrap: wrap;
                `;

                const formattedDate = applicant.createdAt.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                applicantElement.innerHTML = `
                    <div class="applicant-info" style="flex: 1; min-width: 200px;">
                        <div class="applicant-name" style="font-family: interBold; color: #073884; word-break: break-word;">
                            ${applicant.name}
                        </div>
                        <div class="applicant-details" style="font-family: interRegular; color: #666; font-size: 0.9em; word-break: break-word;">
                            <span class="job-title">${applicant.jobTitle}</span> • 
                            <span class="company">${applicant.company}</span>
                        </div>
                    </div>
                    <div class="applicant-date" style="font-family: interRegular; color: #666; font-size: 0.9em; text-align: right; white-space: nowrap;">
                        ${formattedDate}
                    </div>
                `;

                applicantsList.appendChild(applicantElement);
            });
        }

        chartArea.appendChild(applicantsList);

    } catch (error) {
        console.error("Error fetching recent applicants:", error);
        const chartArea = document.querySelector('#newApplicants').closest('.chart-area');
        if (chartArea) {
            chartArea.innerHTML = `
                <div style="text-align: center; padding: 20px; font-family: interRegular; color: #666;">
                    Error loading recent applicants. Please try again later.
                </div>
            `;
        }
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', displayRecentApplicants);