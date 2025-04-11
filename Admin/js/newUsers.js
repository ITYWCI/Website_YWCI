import { db } from './firebase-config.js';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

async function displayRecentUsers() {
    try {
        // Calculate date 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Query for employers
        const employersRef = collection(db, "employers");
        const employersQuery = query(
            employersRef,
            where("createdAt", ">=", sevenDaysAgo),
            orderBy("createdAt", "desc")
        );

        // Query for users
        const usersRef = collection(db, "users");
        const usersQuery = query(
            usersRef,
            where("createdAt", ">=", sevenDaysAgo),
            orderBy("createdAt", "desc")
        );

        // Get both query results
        const [employersSnapshot, usersSnapshot] = await Promise.all([
            getDocs(employersQuery),
            getDocs(usersQuery)
        ]);

        // Combine and sort users
        const recentUsers = [];

        employersSnapshot.forEach(doc => {
            const data = doc.data();
            recentUsers.push({
                name: `${data.firstName} ${data.middleName ? data.middleName + ' ' : ''}${data.lastName}`,
                type: 'Employer',
                email: data.email || 'N/A',
                createdAt: data.createdAt?.toDate() || new Date(),
            });
        });

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            recentUsers.push({
                name: `${data.firstName} ${data.middleName ? data.middleName + ' ' : ''}${data.lastName}`,
                type: data.userType || 'User', // Include userType if available
                email: data.email || 'N/A',
                createdAt: data.createdAt?.toDate() || new Date(),
            });
        });

        // Sort all users by date
        recentUsers.sort((a, b) => b.createdAt - a.createdAt);

        // Get and style the container
        const chartArea = document.querySelector('#newUsers').closest('.chart-area');
        if (!chartArea) return;

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

        // Find the card-body parent and remove its padding
        const cardBody = chartArea.closest('.card-body');
        if (cardBody) {
            cardBody.style.padding = '0';
        }

        // Create new users list
        const usersList = document.createElement('div');
        usersList.className = 'recent-users-list';
        usersList.style.cssText = `
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
            .recent-users-list::-webkit-scrollbar {
                width: 6px;
            }
            .recent-users-list::-webkit-scrollbar-track {
                background: #edf2f7;
                border-radius: 3px;
            }
            .recent-users-list::-webkit-scrollbar-thumb {
                background-color: #a0aec0;
                border-radius: 3px;
            }
        `;
        document.head.appendChild(style);

        if (recentUsers.length === 0) {
            usersList.innerHTML = `
                <div class="no-users" style="
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
                    <i class="fas fa-users" style="
                        font-size: 48px;
                        color: #e3e6f0;
                        margin-bottom: 10px;
                    "></i>
                    <div>No recent users within 7 days</div>
                </div>
            `;
        } else {
            recentUsers.forEach(user => {
                const userElement = document.createElement('div');
                userElement.className = 'user-item';
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

                const formattedDate = user.createdAt.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                userElement.innerHTML = `
                    <div class="user-info" style="flex: 1; min-width: 200px;">
                        <div class="user-name" style="font-family: interBold; color: #073884; word-break: break-word;">
                            ${user.name}
                        </div>
                        <div class="user-details" style="font-family: interRegular; color: #666; font-size: 0.9em; word-break: break-word;">
                            <span class="user-type">${user.type}</span> • 
                            <span class="user-email">${user.email}</span>
                        </div>
                    </div>
                    <div class="user-date" style="font-family: interRegular; color: #666; font-size: 0.9em; text-align: right; white-space: nowrap;">
                        Account created on <br> ${formattedDate}
                    </div>
                `;

                usersList.appendChild(userElement);
            });
        }

        chartArea.appendChild(usersList);

    } catch (error) {
        console.error("Error fetching recent users:", error);
        const chartArea = document.querySelector('#newUsers').closest('.chart-area');
        if (chartArea) {
            chartArea.innerHTML = `
                <div style="text-align: center; padding: 20px; font-family: interRegular; color: #666;">
                    Error loading recent users. Please try again later.
                </div>
            `;
        }
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', displayRecentUsers);