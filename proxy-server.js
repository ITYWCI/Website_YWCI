const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

// Enable CORS for all routes
app.use(cors());

// Proxy endpoint for PDFs
app.get('/proxy-pdf', async (req, res) => {
    try {
        const pdfUrl = req.query.url;
        if (!pdfUrl) {
            return res.status(400).send('URL parameter is required');
        }

        const response = await fetch(pdfUrl);
        if (!response.ok) {
            return res.status(response.status).send('Failed to fetch PDF');
        }

        // Forward the PDF data and content type
        res.setHeader('Content-Type', response.headers.get('content-type'));
        response.body.pipe(res);
    } catch (error) {
        console.error('Error proxying PDF:', error);
        res.status(500).send('Error fetching PDF');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});
