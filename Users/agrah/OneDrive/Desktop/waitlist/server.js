const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser'); // Import cookie-parser

const app = express();
const PORT = 3000;
const EMAILS_FILE = path.join(__dirname, 'emails.json');

// --- IMPORTANT: Set your secret admin password here ---
const ADMIN_PASSWORD = "your_secret_password_123"; 

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Use cookie-parser middleware
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// --- Helper Functions (No changes needed here) ---
const readEmails = () => {
    if (!fs.existsSync(EMAILS_FILE)) {
        return [];
    }
    const data = fs.readFileSync(EMAILS_FILE, 'utf8');
    try {
        return JSON.parse(data);
    } catch (e) {
        return []; // Return empty array if JSON is invalid
    }
};

const writeEmails = (emails) => {
    fs.writeFileSync(EMAILS_FILE, JSON.stringify(emails, null, 2));
};

// --- Authentication Middleware ---
// This function checks if the user is logged in before allowing access to a route
const checkAuth = (req, res, next) => {
    if (req.cookies.loggedIn === 'true') {
        // If the 'loggedIn' cookie exists and is true, proceed
        next();
    } else {
        // Otherwise, redirect to the login page
        res.redirect('/login');
    }
};


// --- Routes ---
// API Route to handle new waitlist signups (no change)
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

// --- NEW: Admin Login and Logout Routes ---
// Show the login page
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Handle the login form submission
app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        // If password is correct, set a cookie named 'loggedIn' to 'true'
        // This cookie will expire in 1 hour (3600000 milliseconds)
        res.cookie('loggedIn', 'true', { maxAge: 3600000, httpOnly: true });
        res.redirect('/view/mail');
    } else {
        // If password is incorrect, re-render the login page with an error message
        res.render('login', { error: 'Incorrect password. Please try again.' });
    }
});

// Handle logout
app.get('/logout', (req, res) => {
    res.clearCookie('loggedIn');
    res.redirect('/login');
});


// --- PROTECTED Route to view emails ---
// We add our `checkAuth` middleware here. It will run before the main route logic.
app.get('/view/mail', checkAuth, (req, res) => {
    const emails = readEmails();
    res.render('mails', { emails: emails });
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
    console.log(`🔒 Admin panel (requires login): http://localhost:${PORT}/view/mail`);
});