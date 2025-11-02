// Server.js - COMPLETE SERVER CODE READY FOR RENDER DEPLOYMENT

// ------------------------------------------------------------------
// 🎯 0. Module Imports and Initial Setup
// ------------------------------------------------------------------
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
// CRITICAL DEPLOYMENT CHANGE: Use environment variable for port (e.g., set by Render)
const port = process.env.PORT || 3001; 

// ------------------------------------------------------------------
// 🎯 1. MongoDB Connection Setup
// ------------------------------------------------------------------

// ⚠️ NOTE: Do NOT store credentials in source control or comments.
// Set the full connection string in the MONGO_URI environment variable.
// SRV_URI can be used as an optional local fallback (not recommended for production).
const SRV_URI = "mongodb+srv://anjanmahadev02_db_user:Aysspsarma1@colabxcluster.ibqs9ym.mongodb.net/?appName=CoLabXCluster";

const uri = process.env.MONGO_URI || SRV_URI;

// Create the MongoClient. Use a short server selection timeout to fail fast on startup
// when the DB is unreachable.
const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
});

let db;
const DB_NAME = 'CoLabX';

async function connectToMongo() {
    try {
        await client.connect();
        db = client.db(DB_NAME);
        console.log("✅ Connected successfully to MongoDB Atlas!");
    } catch (err) {
        console.error("❌ Failed to connect to MongoDB Atlas:", err);
        console.error("Connection URI used:", uri);
            // Re-throw so callers (startServer) know the connection failed and can stop startup.
            throw err;
    }
}

// Middleware
// 🎯 CRITICAL DEPLOYMENT CHANGE: CORS configuration FIX
// This allows requests ONLY from your Vercel frontend domain: https://colabx-frontend.vercel.app
app.use(cors({ 
    origin: 'http://localhost:5500', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
})); 
    // Configure CORS to allow the deployed frontend and localhost during development.
    // Example: set CORS_ORIGINS=https://colabx-frontend.vercel.app,http://localhost:3000
    const allowedOrigins = (process.env.CORS_ORIGINS || 'https://colabx-frontend.vercel.app,http://localhost:5500')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    app.use(cors({
        origin: function(origin, callback) {
            // Allow non-browser requests like curl or server-to-server (no origin)
            if (!origin) return callback(null, true);
            if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
            return callback(new Error('CORS policy does not allow this origin.'), false);
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
    }));

// Use Express's built-in body parsing. Avoid duplicate body-parser usage.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger to help debug network/CORS issues from browser
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - Origin: ${req.get('origin') || 'no-origin'}`);
    next();
});

// Start the app only after Mongo connection succeeds. This prevents routes from
// being used when `db` is not available.
async function startServer() {
    try {
        await connectToMongo();
        app.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
            console.log(`Frontend should access endpoints at /api/...`);
        });
    } catch (err) {
        console.error('Failed to start server due to DB connection error:', err);
        process.exit(1);
    }
}

startServer();

// ------------------------------------------------------------------
// 🎯 2. Registration Endpoint (POST /api/register)
// ------------------------------------------------------------------
app.post('/api/register', async (req, res) => {
    const { name, email, password, city, skills, experience, portfolio } = req.body;
    if (!db) return res.status(503).send({ message: "Database service unavailable. Connection failed." });
    if (!email || !password || !name) return res.status(400).send({ message: "Name, email, and password are required." });
    try {
        const existingUser = await db.collection('users').findOne({ email: email });
        if (existingUser) return res.status(409).send({ message: "Account already exists with this email." });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        // Normalize skills: support array or comma-separated string
        let skillsArray = [];
        if (Array.isArray(skills)) skillsArray = skills.map(s => String(s).trim()).filter(Boolean);
        else if (typeof skills === 'string') skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);

        const newUser = {
            name,
            email,
            password: hashedPassword,
            city: city || '',
            skills: skillsArray,
            experience: Number(experience) || 0,
            portfolio: portfolio || '',
            profilePic: '',
            createdAt: new Date(),
        };
        const result = await db.collection('users').insertOne(newUser);
        res.status(201).send({ message: "User registered successfully!", uid: result.insertedId });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).send({ message: "Registration failed due to a server error." });
    }
});

// ------------------------------------------------------------------
// 🎯 3. Login Endpoint (POST /api/login)
// ------------------------------------------------------------------
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!db) return res.status(503).send({ message: "Database service unavailable. Connection failed." });
    if (!email || !password) return res.status(400).send({ message: "Email and password are required." });

    try {
        const user = await db.collection('users').findOne({ email: email });
        if (!user) return res.status(401).send({ message: "Invalid email or password." });
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) return res.status(401).send({ message: "Invalid email or password." });

        delete user.password;
        const userData = { ...user, uid: user._id.toString() };
        delete userData._id;
        res.status(200).send({ message: "Login successful", user: userData });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).send({ message: "Server error during login." });
    }
});

// ------------------------------------------------------------------
// 🎯 4. Profile Fetch Endpoint (GET /api/profile/:uid)
// ------------------------------------------------------------------
app.get('/api/profile/:uid', async (req, res) => {
    const { uid } = req.params;
    if (!db) return res.status(503).send({ message: "Database service unavailable. Connection failed." });
    if (!ObjectId.isValid(uid)) return res.status(400).send({ message: "Invalid user ID format." });

    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(uid) });
        if (!user) return res.status(404).send({ message: "Profile not found." });
        delete user.password;
        const profileData = { ...user, uid: user._id.toString() };
        delete profileData._id;
        res.status(200).send(profileData);
    } catch (error) {
        console.error("Profile fetch error:", error);
        res.status(500).send({ message: "Server error fetching profile." });
    }
});

// ------------------------------------------------------------------
// 🎯 5. Profile Update Endpoint (PUT /api/profile/:uid)
// ------------------------------------------------------------------
app.put('/api/profile/:uid', async (req, res) => {
    const { uid } = req.params;
    const { name, city, skills, experience, portfolio, profilePic } = req.body;
    if (!db) return res.status(503).send({ message: "Database service unavailable. Connection failed." });
    if (!ObjectId.isValid(uid)) return res.status(400).send({ message: "Invalid user ID format." });

    const updateFields = {};
    if (name) updateFields.name = name;
    if (city) updateFields.city = city;
    // Accept skills as array or comma-separated string
    if (skills) {
        if (Array.isArray(skills)) updateFields.skills = skills.map(s => String(s).trim()).filter(Boolean);
        else if (typeof skills === 'string') updateFields.skills = skills.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (experience !== undefined) updateFields.experience = Number(experience);
    if (portfolio) updateFields.portfolio = portfolio;
    if (profilePic !== undefined) updateFields.profilePic = profilePic;

    try {
        const result = await db.collection('users').updateOne({ _id: new ObjectId(uid) }, { $set: updateFields });
        if (result.matchedCount === 0) return res.status(404).send({ message: "User not found." });

        const updatedUser = await db.collection('users').findOne({ _id: new ObjectId(uid) });
        delete updatedUser.password;
        const updatedProfile = { ...updatedUser, uid: updatedUser._id.toString() };
        delete updatedProfile._id;
        res.status(200).send(updatedProfile);
    } catch (error) {
        console.error("Profile update error:", error);
        res.status(500).send({ message: "Server error updating profile." });
    }
});

// ------------------------------------------------------------------
// 🎯 6. All Profiles Endpoint (GET /api/profiles)
// ------------------------------------------------------------------
app.get('/api/profiles', async (req, res) => {
    if (!db) return res.status(503).send({ message: "Database service unavailable. Connection failed." });

    try {
        const profiles = await db.collection('users').find({}).sort({ createdAt: -1 }).toArray();
        const cleanedProfiles = profiles.map(user => {
            delete user.password;
            const userData = { ...user, uid: user._id.toString() };
            delete userData._id;
            return userData;
        });
        res.status(200).send(cleanedProfiles);
    } catch (error) {
        console.error("All profiles fetch error:", error);
        res.status(500).send({ message: "Server error fetching profiles." });
    }
});


// ------------------------------------------------------------------
// 🎯 7. Health & graceful shutdown
// ------------------------------------------------------------------
// Health check endpoint
app.get('/health', (req, res) => {
    if (db) return res.status(200).send({ status: 'ok' });
    return res.status(503).send({ status: 'unavailable' });
});

// Graceful shutdown: close Mongo client before exiting
async function shutdown(signal) {
    console.log(`Received ${signal}. Closing Mongo client and exiting.`);
    try {
        await client.close();
        console.log('Mongo client closed.');
    } catch (err) {
        console.error('Error closing Mongo client:', err);
    }
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
