import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import rateLimiter from "./middleware/rateLimiter.js";

import transactionsRoute from "./routes/transactionsRoute.js";
import plaidRoute from "./routes/plaidRoute.js";
import job from "./config/cron.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === "production") job.start();

app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// middleware
app.use(cors());
app.use(rateLimiter);
app.use(express.json());

app.use("/api/transactions", transactionsRoute);
app.use("/api/plaid", plaidRoute);

// Connect to the database before starting the server
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    })
});