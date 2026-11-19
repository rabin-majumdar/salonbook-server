import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

app.get("/", (_req, res) => {
    res.json({ message: "SalonBook API is running" });
});

const port = process.env.PORT || 5000;

connectDB()
    .then(() => app.listen(port, () => console.log(`Server on ${port}`)))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });