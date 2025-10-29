// Server.js - COMPLETE SERVER CODE READY FOR RENDER DEPLOYMENT

// ------------------------------------------------------------------
// 🎯 0. Module Imports and Initial Setup
// ------------------------------------------------------------------
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const cors = require('cors'); // CORS module imported
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
// CRITICAL DEPLOYMENT CHANGE: Use environment variable for port (e.g., set by Render)
const port = process.env.PORT || 3001; 

// ------------------------------------------------------------------
// 🎯 1. MongoDB Connection Setup
// ------------------------------------------------------------------

// ⚠️ FINAL SRV CONNECTION STRING: Updated with the correct password 'Aysspsarma1'.
// NOTE: Use an environment variable (MONGO_URI) in production for security.
const SRV_URI = "mongodb+srv://anjanmahadev02_db_user:Aysspsarma1@colabxcluster.ibqs9ym.mongodb.net/?appName=CoLabXCluster";

const uri = process.env.MONGO_URI || SRV_URI;

const client = new MongoClient(uri, { 
    useUnifiedTopology: true 
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
    }
}

// Middleware
// 🎯 CRITICAL DEPLOYMENT CHANGE: CORS configuration FIX
// This allows requests ONLY from your Vercel frontend domain.
app.use(cors({ 
    origin: 'https://colabx-frontend.vercel.app', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
})); 

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

connectToMongo();

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
        const newUser = {
            name, email, password: hashedPassword,
            city: city || '',
            skills: (skills || '').split(',').map(s => s.trim()).filter(Boolean),
            experience: Number(experience) || 0,
            portfolio: portfolio || '', profilePic: '', createdAt: new Date(),
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
    if (skills) updateFields.skills = (skills || '').split(',').map(s => s.trim()).filter(Boolean);
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
// 🎯 7. Start Server
// ------------------------------------------------------------------
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`Frontend should access endpoints at /api/...`);
});