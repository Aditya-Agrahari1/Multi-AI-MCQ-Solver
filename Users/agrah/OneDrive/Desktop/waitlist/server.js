const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const EMAILS_FILE = path.join(__dirname, 'emails.json');

// --- Middleware ---
// To parse JSON data from the form
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// To serve static files like index.html, css, etc. from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));
// Set EJS as the templating engine for displaying the emails
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// --- Helper Function to read emails ---
const readEmails = () => {
    if (!fs.existsSync(EMAILS_FILE)) {
        return [];
    }
    const data = fs.readFileSync(EMAILS_FILE);
    return JSON.parse(data);
};

// --- Helper Function to write emails ---
const writeEmails = (emails) => {
    fs.writeFileSync(EMAILS_FILE, JSON.stringify(emails, null, 2));
};


// --- Routes ---
// 1. API Route to handle new waitlist signups
app.post('/join', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    const emails = readEmails();
    if (emails.includes(email)) {
        return res.status(409).json({ message: 'This email is already on the waitlist.' });
    }
    
    emails.push(email);
    writeEmails(emails);

    console.log(`New email joined: ${email}`);
    res.status(200).json({ message: 'Successfully joined the waitlist!' });
});


// 2. Page Route to view all submitted emails
app.get('/view/mail', (req, res) => {
    const emails = readEmails();
    // Render the 'mails.ejs' template and pass the emails array to it
    res.render('mails', { emails: emails });
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
    console.log(`📋 View submitted emails at http://localhost:${PORT}/view/mail`);
});