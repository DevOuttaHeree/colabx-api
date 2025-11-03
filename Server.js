import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongodb";
import profileRoutes from "./routes/profileRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";

dotenv.config();

const app = express();

// ✅ Allowed CORS origins
const allowedOrigins = (process.env.CORS_ORIGINS ||
 "https://colabx-frontend.vercel.app,http://localhost:5500"
).split(",");

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error("CORS policy does not allow this origin."), false);
    },
    credentials: true,
  })
);

app.use(express.json());

// ✅ Routes
app.use("/api/profiles", profileRoutes);
app.use("/api/search", searchRoutes);

// ✅ Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Backend is running 🚀" });
});

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, { dbName: "colabx" })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ DB Connection Error:", err));

// ✅ Start server
const port = process.env.PORT || 5000;
app.listen(port, () =>
  console.log(`🚀 Server running on port ${port}`)
);
