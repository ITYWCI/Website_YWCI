const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "ywci-website.firebasestorage.app"
});

const db = admin.firestore();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Authentication middleware
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await getAuth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Auth Error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password, userType } = req.body;
        
        // Query the appropriate collection based on userType
        const collection = userType === 'admin' ? 'admins' : 'employers';
        
        // Try to find user by username first
        let userQuery = await db.collection(collection)
            .where('username', '==', identifier)
            .get();

        // If no user found by username, try email
        if (userQuery.empty) {
            userQuery = await db.collection(collection)
                .where('email', '==', identifier.toLowerCase())
                .get();
        }

        if (userQuery.empty) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const userData = userQuery.docs[0].data();
        
        // Verify password (you should implement proper password verification here)
        if (userData.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Create a custom token for the user
        const uid = userQuery.docs[0].id;
        const customToken = await getAuth().createCustomToken(uid, {
            userType: userType,
            email: userData.email,
            username: userData.username
        });

        res.json({
            token: customToken,
            user: {
                uid: uid,
                email: userData.email,
                username: userData.username,
                userType: userType,
                ...userData
            }
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Verify token endpoint
app.post('/api/auth/verify', authenticateUser, (req, res) => {
    res.json({ user: req.user });
});

// Check credentials endpoint
app.post('/api/auth/check-credentials', async (req, res) => {
    try {
        const { identifier } = req.body;
        
        if (!identifier) {
            return res.status(400).json({ error: 'Identifier is required' });
        }
        
        // Check if the identifier is an email or username
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
        
        const employersRef = db.collection('employers');
        let queryRef;
        
        if (isEmail) {
            queryRef = employersRef.where('email', '==', identifier.toLowerCase());
        } else {
            queryRef = employersRef.where('username', '==', identifier);
        }
        
        const querySnapshot = await queryRef.get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'No employer found with this identifier' });
        }
        
        const userData = querySnapshot.docs[0].data();
        res.json({ email: userData.email.toLowerCase() });
    } catch (error) {
        console.error('Error checking credentials:', error);
        res.status(500).json({ error: 'Failed to check credentials' });
    }
});

// Admin-specific endpoints
app.get('/api/admin/jobs', authenticateUser, async (req, res) => {
    try {
        if (req.user.userType !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const jobsSnapshot = await db.collection('jobs').get();
        const jobs = [];
        jobsSnapshot.forEach(doc => {
            jobs.push({ id: doc.id, ...doc.data() });
        });
        
        res.json(jobs);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

app.post('/api/admin/jobs', authenticateUser, async (req, res) => {
    try {
        if (req.user.userType !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const jobData = req.body;
        const jobRef = await db.collection('jobs').add({
            ...jobData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ id: jobRef.id });
    } catch (error) {
        console.error('Error creating job:', error);
        res.status(500).json({ error: 'Failed to create job' });
    }
});

app.put('/api/admin/jobs/:jobId', authenticateUser, async (req, res) => {
    try {
        if (req.user.userType !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { jobId } = req.params;
        const jobData = req.body;

        await db.collection('jobs').doc(jobId).update({
            ...jobData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating job:', error);
        res.status(500).json({ error: 'Failed to update job' });
    }
});

app.delete('/api/admin/jobs/:jobId', authenticateUser, async (req, res) => {
    try {
        if (req.user.userType !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { jobId } = req.params;
        await db.collection('jobs').doc(jobId).delete();

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting job:', error);
        res.status(500).json({ error: 'Failed to delete job' });
    }
});

app.get('/api/admin/jobs/:jobId', authenticateUser, async (req, res) => {
    try {
        if (req.user.userType !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { jobId } = req.params;
        const jobDoc = await db.collection('jobs').doc(jobId).get();

        if (!jobDoc.exists) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json({ id: jobDoc.id, ...jobDoc.data() });
    } catch (error) {
        console.error('Error fetching job:', error);
        res.status(500).json({ error: 'Failed to fetch job' });
    }
});

// Employer-specific endpoints
app.get('/api/employer/jobs/:employerId', authenticateUser, async (req, res) => {
    try {
        const { employerId } = req.params;
        
        // For now, allow access to any authenticated user
        // We can implement more strict checks later if needed

        const jobsSnapshot = await db.collection('jobs')
            .where('employerId', '==', employerId)
            .get();
        
        const jobs = [];
        jobsSnapshot.forEach(doc => {
            jobs.push({ id: doc.id, ...doc.data() });
        });
        
        res.json(jobs);
    } catch (error) {
        console.error('Error fetching employer jobs:', error);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

// Firebase Client SDK Configuration
const firebaseClientConfig = {
    apiKey: "AIzaSyBL-HNBhP3mkb4Bp2BUDy4FbJl3M15MxSY",
    authDomain: "ywci-website.firebaseapp.com",
    projectId: "ywci-website",
    storageBucket: "ywci-website.firebasestorage.app",
    messagingSenderId: "718233699603",
    appId: "1:718233699603:web:fca95cafc62593fc04c6e6",
    measurementId: "G-3JJ5BD37DG"
};

// Serve Firebase SDK and configuration
app.get('/api/firebase-sdk', (req, res) => {
    res.json({
        config: firebaseClientConfig
    });
});

// Serve Firebase SDK modules
app.get('/api/firebase-sdk/:module', (req, res) => {
    const { module } = req.params;
    const allowedModules = ['app', 'auth', 'firestore', 'storage', 'functions', 'analytics'];
    
    if (!allowedModules.includes(module)) {
        return res.status(404).json({ error: 'Module not found' });
    }
    
    // Redirect to the appropriate Firebase SDK module
    res.redirect(`https://www.gstatic.com/firebasejs/9.6.1/firebase-${module}.js`);
});

// Critical functions moved from client-side JavaScript files

// From applicants.js
app.get('/api/applicants', authenticateUser, async (req, res) => {
    try {
        const applicationsRef = db.collection('applications');
        const querySnapshot = await applicationsRef.get();
        const applicants = [];
        
        querySnapshot.forEach(doc => {
            applicants.push({ id: doc.id, ...doc.data() });
        });
        
        res.json(applicants);
    } catch (error) {
        console.error('Error fetching applicants:', error);
        res.status(500).json({ error: 'Failed to fetch applicants' });
    }
});

app.put('/api/applicants/:email/status', authenticateUser, async (req, res) => {
    try {
        const { email } = req.params;
        const { status, message } = req.body;
        
        const applicationsRef = db.collection('applications');
        const querySnapshot = await applicationsRef.where('email', '==', email).get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'Applicant not found' });
        }
        
        const applicationDoc = querySnapshot.docs[0];
        await applicationDoc.ref.update({
            status: status,
            statusMessage: message || '',
            statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating applicant status:', error);
        res.status(500).json({ error: 'Failed to update applicant status' });
    }
});

// From jobs.js
app.get('/api/employer/current-id', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const employersRef = db.collection('employers');
        const querySnapshot = await employersRef.where('email', '==', user.email.toLowerCase()).get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'Employer not found' });
        }
        
        const employerId = querySnapshot.docs[0].data().employerId;
        res.json({ employerId });
    } catch (error) {
        console.error('Error getting employer ID:', error);
        res.status(500).json({ error: 'Failed to get employer ID' });
    }
});

app.post('/api/jobs', authenticateUser, async (req, res) => {
    try {
        const jobData = req.body;
        const employersRef = db.collection('employers');
        const querySnapshot = await employersRef.where('email', '==', req.user.email.toLowerCase()).get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'Employer not found' });
        }
        
        const employerId = querySnapshot.docs[0].data().employerId;
        
        const jobRef = await db.collection('jobs').add({
            ...jobData,
            employerId: employerId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({ id: jobRef.id });
    } catch (error) {
        console.error('Error creating job:', error);
        res.status(500).json({ error: 'Failed to create job' });
    }
});

// Employer job endpoints

// Archive job endpoint
app.put('/api/employer/jobs/:jobId/archive', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const { jobId } = req.params;

        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const employersRef = db.collection('employers');
        const querySnapshot = await employersRef.where('email', '==', user.email.toLowerCase()).get();

        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'Employer not found' });
        }

        const employerId = querySnapshot.docs[0].data().employerId;
        const jobRef = db.collection('jobs').doc(jobId);
        const jobDoc = await jobRef.get();

        if (!jobDoc.exists) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (jobDoc.data().employerId !== employerId) {
            return res.status(403).json({ error: 'Not authorized to archive this job' });
        }

        await jobRef.update({
            archived: true,
            archivedDate: new Date().toISOString()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error archiving job:', error);
        res.status(500).json({ error: 'Failed to archive job' });
    }
});


app.get('/api/employer/jobs', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const employersRef = db.collection('employers');
        const querySnapshot = await employersRef.where('email', '==', user.email.toLowerCase()).get();

        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'Employer not found' });
        }

        const employerId = querySnapshot.docs[0].data().employerId;
        const jobsRef = db.collection('jobs');
        const jobsQuery = await jobsRef.where('employerId', '==', employerId).get();

        const jobs = [];
        jobsQuery.forEach(doc => {
            jobs.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.json(jobs);
    } catch (error) {
        console.error('Error fetching employer jobs:', error);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

app.post('/api/employer/jobs', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const jobData = req.body;

        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const employersRef = db.collection('employers');
        const querySnapshot = await employersRef.where('email', '==', user.email.toLowerCase()).get();

        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'Employer not found' });
        }

        const employerId = querySnapshot.docs[0].data().employerId;
        const jobRef = await db.collection('jobs').add({
            ...jobData,
            employerId: employerId,
            archived: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ id: jobRef.id });
    } catch (error) {
        console.error('Error creating job:', error);
        res.status(500).json({ error: 'Failed to create job' });
    }
});

app.put('/api/employer/jobs/:jobId', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const { jobId } = req.params;
        const jobData = req.body;

        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const employersRef = db.collection('employers');
        const querySnapshot = await employersRef.where('email', '==', user.email.toLowerCase()).get();

        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'Employer not found' });
        }

        const employerId = querySnapshot.docs[0].data().employerId;
        const jobRef = db.collection('jobs').doc(jobId);
        const jobDoc = await jobRef.get();

        if (!jobDoc.exists) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (jobDoc.data().employerId !== employerId) {
            return res.status(403).json({ error: 'Not authorized to edit this job' });
        }

        await jobRef.update({
            ...jobData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating job:', error);
        res.status(500).json({ error: 'Failed to update job' });
    }
});

app.delete('/api/employer/jobs/:jobId', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const { jobId } = req.params;

        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const employersRef = db.collection('employers');
        const querySnapshot = await employersRef.where('email', '==', user.email.toLowerCase()).get();

        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'Employer not found' });
        }

        const employerId = querySnapshot.docs[0].data().employerId;
        const jobRef = db.collection('jobs').doc(jobId);
        const jobDoc = await jobRef.get();

        if (!jobDoc.exists) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (jobDoc.data().employerId !== employerId) {
            return res.status(403).json({ error: 'Not authorized to delete this job' });
        }

        await jobRef.delete();

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting job:', error);
        res.status(500).json({ error: 'Failed to delete job' });
    }
});

app.put('/api/employer/jobs/:jobId/archive', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const { jobId } = req.params;

        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const employersRef = db.collection('employers');
        const querySnapshot = await employersRef.where('email', '==', user.email.toLowerCase()).get();

        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'Employer not found' });
        }

        const employerId = querySnapshot.docs[0].data().employerId;
        const jobRef = db.collection('jobs').doc(jobId);
        const jobDoc = await jobRef.get();

        if (!jobDoc.exists) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (jobDoc.data().employerId !== employerId) {
            return res.status(403).json({ error: 'Not authorized to archive this job' });
        }

        await jobRef.update({
            archived: true,
            archivedDate: new Date().toISOString()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error archiving job:', error);
        res.status(500).json({ error: 'Failed to archive job' });
    }
});


// Archive job endpoint
app.put('/api/employer/jobs/:jobId/archive', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const { jobId } = req.params;

        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const employersRef = db.collection('employers');
        const querySnapshot = await employersRef.where('email', '==', user.email.toLowerCase()).get();

        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'Employer not found' });
        }

        const employerId = querySnapshot.docs[0].data().employerId;
        const jobRef = db.collection('jobs').doc(jobId);
        const jobDoc = await jobRef.get();

        if (!jobDoc.exists) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (jobDoc.data().employerId !== employerId) {
            return res.status(403).json({ error: 'Not authorized to archive this job' });
        }

        await jobRef.update({
            archived: true,
            archivedDate: new Date().toISOString()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error archiving job:', error);
        res.status(500).json({ error: 'Failed to archive job' });
    }
});

// From profile.js
app.get('/api/employer/profile', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const employersRef = db.collection('employers');
        const querySnapshot = await employersRef.where('email', '==', user.email.toLowerCase()).get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'Employer not found' });
        }
        
        const userData = querySnapshot.docs[0].data();
        userData.id = querySnapshot.docs[0].id;
        
        res.json(userData);
    } catch (error) {
        console.error('Error fetching employer profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

app.put('/api/employer/profile', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const userData = req.body;
        
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const employersRef = db.collection('employers');
        const querySnapshot = await employersRef.where('email', '==', user.email.toLowerCase()).get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'Employer not found' });
        }
        
        const employerDoc = querySnapshot.docs[0];
        await employerDoc.ref.update(userData);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating employer profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Serve static files
app.use('/Employer_Side', express.static(path.join(__dirname, 'Employer_Side')));
app.use('/User', express.static(path.join(__dirname, 'User')));
app.use('/Admin', express.static(path.join(__dirname, 'Admin')));

// HTML routes
app.get('/Employer_Side/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'Employer_Side', req.path.replace('/Employer_Side/', '')));
});

app.get('/User/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'User', req.path.replace('/User/', '')));
});

app.get('/Admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'Admin', req.path.replace('/Admin/', '')));
});

// Default routes
app.get('/Employer_Side', (req, res) => {
    res.redirect('/Employer_Side/login.html');
});

app.get('/Admin', (req, res) => {
    res.redirect('/Admin/login.html');
});

app.get('/', (req, res) => {
    res.redirect('/Employer_Side/login.html');
});

// Add direct route for login.html (to fix 404 error)
app.get('/login.html', (req, res) => {
    res.redirect('/Employer_Side/login.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});