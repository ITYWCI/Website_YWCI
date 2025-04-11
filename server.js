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
        
        // Verify the requesting user owns these jobs
        if (req.user.uid !== employerId && req.user.userType !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});