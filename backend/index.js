const express = require("express");

const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
const supabase = require("./db");
const cors = require("cors");

// routes
const notificationsRouter = require("./routes/notifications.routes");

const eventRoutes = require("./routes/events.routes");
const ratingsRoutes = require("./routes/ratings.routes");
const eventListRoutes = require("./routes/eventlist.routes");

const interestsRouter = require("./routes/interests.routes");
const userAuthRoutes = require("./routes/auth/userAuthRoutes");
const userinterestsRouter = require("./routes/userinterests.routes");
const adminRoutes = require("./routes/admin.routes");
const adminAuthRoutes = require("./routes/auth/adminAuthRoutes");


const app = express();
const PORT = 3000;

const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(
    cors({
        origin: allowedOrigin,
        credentials: true,
    })
);

app.use(express.json());
app.use(cookieParser());

// Set a stable userId cookie if missing
app.use((req, res, next) => {
    if (!req.cookies.userId) {
        res.cookie("userId", uuidv4(), {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            maxAge: 31536000000, // 1 year
            path: "/",
        });
    }
    next();
});

// ------------------- TEST ROUTE -------------------
app.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("events")
            .select("*")
            .limit(8);
        if (error) throw error;
        res.send({ message: "✅ Connected to Supabase!", sampleRows: data });
    } catch (err) {
        console.error("❌ Supabase error:", err.message);
        res.status(500).send("Connection failed!");
    }
});

// ------------------- USE ROUTES -------------------
app.use("/api/auth", userAuthRoutes);
app.use("/api/auth/admin", adminAuthRoutes);

// Other feature routes
app.use("/api/notifications", notificationsRouter);
app.use("/api/interests", userinterestsRouter);
app.use("/api/admin", adminRoutes);
app.use("/api/events", eventListRoutes); // /api/events list
app.use("/api", ratingsRoutes);
app.use("/api", interestsRouter); // includes /events/recommended, /events/discover, etc.
app.use("/api", eventRoutes); // includes /events/:id and related



// ------------------- START SERVER -------------------

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
