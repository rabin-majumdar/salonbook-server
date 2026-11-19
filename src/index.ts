import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db";
import servicesRouter from "./routes/services";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use("/api/services", servicesRouter);

app.use((_req, res) => {
    res.status(404).json({ message: "Route not found" });
});

const port = process.env.PORT || 5000;

connectDB()
    .then(() => app.listen(port, () => console.log(`Server on ${port}`)))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });