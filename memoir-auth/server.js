const express = require('express');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file
const { OAuth2Client } = require('google-auth-library'); // Import Google OAuth2 Client
const { google } = require('googleapis'); // Import Google APIs library for Calendar API

const app = express();
const port = 3000;

// Initialize the OAuth2 Client for Google Sign-In
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// OAuth2 Client for Google Calendar API (same client ID and secret)
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/auth/callback' // Redirect URI after authorization
);

// Middleware to parse incoming JSON requests
app.use(express.json());

// Serve static files (HTML, CSS, JS) from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to verify the Google ID token for Sign-In
app.post('/verify-token', async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ success: false, message: "No credential provided" });
        }

        // Verify the token using Google's OAuth2 API
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID, // Ensure this is your client ID
        });

        const payload = ticket.getPayload(); // Extract user's information
        console.log('User verified:', payload);

        // If token is valid, send success response
        res.json({ success: true });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({ success: false, message: "Token verification failed" });
    }
});

// Route to serve redirect.html after successful login
app.get('/redirect', (req, res) => {
    console.log('Google sign-in successful, redirecting to main app.');
    res.sendFile(path.join(__dirname, 'public', 'redirect.html')); // Send redirect.html file
});

// Google Calendar API: Route to initiate OAuth process for Calendar API
app.get('/auth/calendar', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'],
    });
    res.redirect(authUrl);
});

// Callback route to handle Calendar API OAuth response
app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        console.log('Access token acquired for Google Calendar API');
        res.redirect('/calender.html'); // Redirect to mem.html or another relevant page
    } catch (error) {
        console.error('Error retrieving access token for Calendar API:', error);
        res.status(500).send('Authentication failed');
    }
});

// API route to fetch events from Google Calendar
app.get('/api/calendar/events', async (req, res) => {
    try {
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const events = await calendar.events.list({
            calendarId: 'primary',
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        });
        res.json(events.data.items);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).send('Error retrieving events');
    }
});

// Serve the login page (index route)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
