import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import mongoose from "mongoose";

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: "admin" | "customer";
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
    if (!jwks) {
        const authUrl = process.env.CLIENT_URL;
        if (!authUrl) throw new Error("CLIENT_URL is not set");
        jwks = createRemoteJWKSet(new URL("/api/auth/jwks", authUrl), {
            timeoutDuration: 20000,
            cooldownDuration: 1000,
        });
    }
    return jwks;
}

export async function verifyToken(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Authentication required" });
    }
    const token = header.slice(7);

    let userId = "";
    try {
        const { payload } = await jwtVerify(token, getJwks(), {
            issuer: process.env.CLIENT_URL,
        });
        userId = String(payload.sub || payload.id || "");
    } catch (err) {
        console.error("Token verification failed:", err);
        return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (!mongoose.isValidObjectId(userId)) {
        return res.status(401).json({ message: "Invalid token" });
    }

    try {
        const user = await mongoose.connection
            .db!.collection("users")
            .findOne({ _id: new mongoose.Types.ObjectId(userId) });

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }
        if (user.isBlocked) {
            return res.status(403).json({ message: "Your account is blocked" });
        }

        req.user = {
            id: String(user._id),
            name: user.name,
            email: user.email,
            role: user.role === "admin" ? "admin" : "customer",
        };
    } catch (err) {
        console.error("User lookup failed:", err);
        return res
            .status(500)
            .json({ message: "Could not verify your account. Please try again." });
    }

    next();
}

export function requireRole(...roles: AuthUser["role"][]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Access denied" });
        }
        next();
    };
}