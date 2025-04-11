import {
    initializePage,
    auth,
    db } from './auth.js';
import { getInitials, createInitialsAvatar, populateUserNav } from './utils.js';
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

Chart.defaults.global.defaultFontFamily = 'Nunito', '-apple-system,system-ui,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
Chart.defaults.global.defaultFontColor = '#858796';

async function updatePieChart() {
    try {
        const applicationsRef = collection(db, "applications");
        const querySnapshot = await getDocs(applicationsRef);
        
        let stats = {
            total: 0,
            pending: 0,
            underReview: 0,
            shortlisted: 0,
            rejected: 0,
            hired: 0
        };

        // Count applications by status
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            stats.total++; // Increment total for each application
            
            switch(data.status?.toLowerCase()) {
                case 'application received':
                case null:
                case undefined:
                    stats.pending++;
                    break;
                case 'under-review':
                    stats.underReview++;
                    break;
                case 'shortlist':
                    stats.shortlisted++;
                    break;
                case 'rejected':
                    stats.rejected++;
                    break;
                case 'hired':
                    stats.hired++;
                    break;
            }
        });

        var ctx = document.getElementById("myPieChart");
        var myPieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    // Outer ring (Total Applications)
                    data: [100],
                    backgroundColor: ['#073884'],
                    hoverBackgroundColor: ['#052557'],
                    hoverBorderColor: "rgba(234, 236, 244, 1)",
                    weight: 1
                }, {
                    // Inner ring (other statuses)
                    data: [
                        stats.pending || 0,
                        stats.underReview || 0,
                        stats.shortlisted || 0,
                        stats.rejected || 0,
                        stats.hired || 0
                    ],
                    backgroundColor: [
                        '#f2e700', // Pending - Yellow
                        '#e78604', // Under Review - Orange
                        '#36b9cc', // Shortlisted - Cyan
                        '#e74a3b', // Rejected - Red
                        '#1cc88a', // Hired - Green
                    ],
                    hoverBackgroundColor: [
                        '#9cac00', // Darker Yellow
                        '#b77a00', // Darker Orange
                        '#207C8A', // Darker Cyan
                        '#cb0808', // Darker Red
                        '#139E6B', // Darker Green
                    ],
                    hoverBorderColor: "rgba(234, 236, 244, 1)",
                    weight: 1
                }],
                labels: [
                    `Total Applications (${stats.total})`,
                    `Pending (${stats.pending})`,
                    `Under Review (${stats.underReview})`,
                    `Shortlisted (${stats.shortlisted})`,
                    `Rejected (${stats.rejected})`,
                    `Hired (${stats.hired})`
                ]
            },
            options: {
                maintainAspectRatio: false,
                tooltips: {
                    backgroundColor: "rgb(255,255,255)",
                    bodyFontColor: "#858796",
                    borderColor: '#dddfeb',
                    borderWidth: 1,
                    xPadding: 15,
                    yPadding: 15,
                    displayColors: false,
                    caretPadding: 10,
                    callbacks: {
                        label: function(tooltipItem, data) {
                            var dataset = tooltipItem.datasetIndex;
                            var index = tooltipItem.index;
                            if (dataset === 0) {
                                return `Total Applications: ${stats.total}`;
                            } else {
                                return data.labels[index + 1];
                            }
                        }
                    }
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        generateLabels: function(chart) {
                            var datasets = chart.data.datasets;
                            var labels = chart.data.labels;
                            
                            var allLabels = [];
                            
                            // Add total applications (outer ring)
                            allLabels.push({
                                text: labels[0],
                                fillStyle: datasets[0].backgroundColor[0],
                                hidden: false,
                                lineWidth: 0,
                                strokeStyle: datasets[0].backgroundColor[0]
                            });
                            
                            // Add other statuses (inner ring)
                            datasets[1].backgroundColor.forEach((color, i) => {
                                allLabels.push({
                                    text: labels[i + 1],
                                    fillStyle: color,
                                    hidden: false,
                                    lineWidth: 0,
                                    strokeStyle: color
                                });
                            });
                            
                            return allLabels;
                        }
                    }
                },
                cutoutPercentage: 65,
                rotation: -0.5 * Math.PI,
                elements: {
                    arc: {
                        borderWidth: 0
                    }
                }
            },
        });

    } catch (error) {
        console.error("Error updating pie chart:", error);
    }
}

// Initialize the chart when the page loads
document.addEventListener('DOMContentLoaded', updatePieChart);