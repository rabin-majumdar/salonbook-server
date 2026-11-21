import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { connectDB } from "./config/db";
import servicesRouter from "./routes/services";
import appointmentsRouter from "./routes/appointments";
import usersRouter from "./routes/users";
import statsRouter from "./routes/stats";
import paymentsRouter, { stripeWebhook } from "./routes/payments";
import { verifyToken } from "./middleware/auth";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));


app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhook
);


app.use(express.json());


app.get("/", (_req, res) => {
    res.json({ message: "SalonBook API is running" });
});
app.get("/api/me", verifyToken, (req, res) => {
    res.json(req.user);
});
app.use("/api/services", servicesRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/users", usersRouter);
app.use("/api/stats", statsRouter);
app.use("/api/payments", paymentsRouter);

app.use((_req, res) => {
    res.status(404).json({ message: "Route not found" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(400).json({ message: err.message || "Something went wrong" });
});

const port = process.env.PORT || 5000;

connectDB()
    .then(() => app.listen(port, () => console.log(`Server on ${port}`)))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });