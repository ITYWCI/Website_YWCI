import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

// Replace XLSX CDN with ExcelJS
const excelScript = document.createElement('script');
excelScript.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js';
document.head.appendChild(excelScript);

async function generateReport() {
    try {
        // Show loading state
        Swal.fire({
            title: 'Generating Report',
            text: 'Please wait...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // Fetch data from collections with ordering
        const [users, employers, jobs, applications] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(query(
                collection(db, 'employers'),
                orderBy('employerId', 'asc') // Order employers by employerId ascending
            )),
            getDocs(collection(db, 'jobs')),
            getDocs(collection(db, 'applications'))
        ]);

        // Format numeric timestamp to readable date
        const formatDate = (timestamp) => {
            if (!timestamp || !timestamp.seconds) return '';
            try {
                // Convert Firebase Timestamp to JavaScript Date
                const date = new Date(timestamp.seconds * 1000);
                if (isNaN(date.getTime())) return '';
                
                const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
                
                const month = months[date.getMonth()];
                const day = date.getDate();
                const year = date.getFullYear();
                const hours = date.getHours() % 12 || 12;
                const minutes = date.getMinutes().toString().padStart(2, '0');
                const ampm = date.getHours() >= 12 ? 'pm' : 'am';
                
                return `${month} ${day}, ${year}, ${hours}:${minutes}${ampm}`;
            } catch (error) {
                return '';
            }
        };

        // Process data for Excel
        const userData = users.docs.map(doc => {
            const data = doc.data();
            return {
                lastName: data.lastName || '',
                firstName: data.firstName || '',
                middleName: data.middleName || '',
                email: data.email || '',
                birthday: data.birthday || '',
                lastSignIn: data.lastSignIn ? formatDate(data.lastSignIn) : ''
            };
        });

        const employerData = employers.docs.map(doc => {
            const data = doc.data();
            return {
                lastName: data.lastName || '',
                firstName: data.firstName || '',
                middleName: data.middleName || '',
                username: data.username || '',
                email: data.email || '',
                employerId: data.employerId || '',
                createdAt: data.createdAt ? formatDate(data.createdAt) : ''
            };
        });

        const jobData = jobs.docs.map(doc => {
            const data = doc.data();
            const { uid, ...rest } = data;


            // Format description to maintain formatting
            const formatDescription = (description) => {
                if (!description) return '';
                
                return description
                    // Handle bold text with asterisks
                    .replace(/<strong[^>]*>(.*?)<\/strong>/g, '*$1*')
                    .replace(/<b[^>]*>(.*?)<\/b>/g, '*$1*')
                    .replace(/<span style="font-weight: bold;">(.*?)<\/span>/g, '*$1*')
                    
                    // Handle line breaks and spacing
                    .replace(/<br\s*\/?>/g, '\n')
                    .replace(/<\/p>/g, '\n')
                    .replace(/<[^>]+>/g, '') // Remove any remaining HTML tags
                    
                    // Format bullets with proper indentation
                    .replace(/•\s*/g, '\n• ')
                    .replace(/·\s*/g, '\n• ')
                    
                    // Clean up extra spaces and lines
                    .replace(/\n\s*\n/g, '\n') // Remove multiple blank lines
                    .replace(/^\s+|\s+$/g, '') // Trim start and end
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line) // Remove empty lines
                    .join('\n');
            };

            // Create ordered object with specific fields
            return {
                jobTitle: data.title || '',
                company: data.company || '',
                companyDescription: data.companyDescription || '',
                location: data.location || '',
                type: data.type || '',
                isRange: data.isRange || false,
                isConfidential: data.isConfidential || false,
                salary: data.salary || '',
                minSalary: data.minSalary || '',
                maxSalary: data.maxSalary || '',
                description: formatDescription(data.description) || '',
                archived: data.archived || false,
                archivedDate: data.archived ? formatDate(data.archivedDate) : '',
                createdDate: formatDate(data.timestamp),
                lastEdited: data.lastEdited ? formatDate(data.lastEdited) : ''
            };
        });

        const applicationData = applications.docs.map(doc => {
            const data = doc.data();
            const { uid, ...rest } = data; // Exclude uid
            return {
                ...rest,
                createdAt: data.createdAt ? formatDate(data.createdAt) : ''
            };
        });

        // Create workbook
        const workbook = new ExcelJS.Workbook();

        // Define column mappings
        const userColumnMap = {
            'lastName': 'Last Name',
            'firstName': 'First Name',
            'middleName': 'Middle Name',
            'email': 'Email',
            'birthday': 'Birthday',
            'lastSignIn': 'Last Sign In'
        };

        const employerColumnMap = {
            'lastName': 'Last Name',
            'firstName': 'First Name',
            'middleName': 'Middle Name',
            'username': 'Username',
            'email': 'Email',
            'employerId': 'Employer ID',
            'createdAt': 'Date Created'
        };

        const jobColumnMap = {
            'jobTitle': 'Job Title',
            'company': 'Company',
            'companyDescription': 'Company Description',
            'location': 'Location',
            'type': 'Job Type',
            'isRange': 'Is Range',
            'isConfidential': 'Is Confidential',
            'salary': 'Salary',
            'minSalary': 'Minimum Salary',
            'maxSalary': 'Maximum Salary',
            'description': 'Job Description',
            'archived': 'Is Archived',
            'archivedDate': 'Archived Date',
            'createdDate': 'Date Uploaded',
            'lastEdited': 'Last Edited'
        };

        // Create and format worksheets
        const createWorksheet = (workbook, data, columnMap, sheetName) => {
            const worksheet = workbook.addWorksheet(sheetName);
            
            // Add headers
            const headers = Object.values(columnMap);
            worksheet.columns = headers.map(header => ({
                header: header,
                key: header,
                width: 15 // Adjust width as needed
            }));

            // Style headers
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

            // Add data
            const formattedData = data.map(item => {
                const newItem = {};
                Object.keys(columnMap).forEach(key => {
                    newItem[columnMap[key]] = item[key];
                });
                return newItem;
            });
            worksheet.addRows(formattedData);
        };

        // Create worksheets
        createWorksheet(workbook, userData, userColumnMap, 'Users');
        createWorksheet(workbook, employerData, employerColumnMap, 'Employers');
        createWorksheet(workbook, jobData, jobColumnMap, 'Jobs');

        // Generate filename with current date
        const date = new Date().toISOString().split('T')[0];
        const fileName = `YWCI_Report_${date}-ADMIN.xlsx`;

        // Write file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        window.URL.revokeObjectURL(url);

        // Show success message
        Swal.fire({
            icon: 'success',
            title: 'Report Generated',
            text: 'Your report has been downloaded successfully!',
            confirmButtonText: 'OK',
            customClass: {
                confirmButton: 'btn btn-primary',
                title: 'interSemiBold',
                text: 'interRegular'
            }
        });

    } catch (error) {
        console.error('Error generating report:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to generate report. Please try again.',
            customClass: {
                title: 'interSemiBold',
                text: 'interRegular'
            }
        });
    }
}

// Add event listener to the button
document.addEventListener('DOMContentLoaded', () => {
    const reportBtn = document.getElementById('generateReportBtn');
    if (reportBtn) {
        reportBtn.addEventListener('click', generateReport);
    }
}); 