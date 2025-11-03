// ------------------------------------------------------------
// ✅ 4. Get Profile by ID (GET /api/profile/:id)
// ------------------------------------------------------------
app.get('/api/profile/:id', async (req, res) => {
    if (!db) return res.status(503).send({ message: "DB unavailable" });

    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });

        if (!user) return res.status(404).send({ message: "User not found" });

        delete user.password;
        user.uid = user._id.toString();
        delete user._id;

        res.send(user);
    } catch (err) {
        res.status(500).send({ message: "Error fetching profile" });
    }
});

// ------------------------------------------------------------
// ✅ 5. Update Profile (PUT /api/profile/:id)
// ------------------------------------------------------------
app.put('/api/profile/:id', async (req, res) => {
    if (!db) return res.status(503).send({ message: "DB unavailable" });

    const { name, city, skills, experience, portfolio } = req.body;

    try {
        await db.collection('users').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { name, city, skills, experience, portfolio }}
        );

        const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });
        delete user.password;
        user.uid = user._id.toString();
        delete user._id;

        res.send(user);
    } catch {
        res.status(500).send({ message: "Failed to update profile" });
    }
});
