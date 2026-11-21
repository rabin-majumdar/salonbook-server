import type { IncomingMessage, ServerResponse } from "http";
import app from "../src/app";
import { connectDB } from "../src/config/db";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    try {
        await connectDB();
    } catch (err) {
        console.error("Database connection failed:", err);
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ message: "Database connection failed" }));
        return;
    }
    return app(req, res);
}