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
        jwks = createRemoteJWKSet(new URL("/api/auth/jwks", authUrl));
    }
    return jwks;
}

// 1) টোকেন যাচাই  2) ডাটাবেস থেকে role ও blocked দেখা
export async function verifyToken(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const header = req.headers.authorization;
        if (!header?.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Authentication required" });
        }
        const token = header.slice(7);

        const { payload } = await jwtVerify(token, getJwks(), {
            issuer: process.env.CLIENT_URL,
        });

        const userId = String(payload.sub || payload.id || "");
        if (!mongoose.isValidObjectId(userId)) {
            return res.status(401).json({ message: "Invalid token" });
        }

        const user = await mongoose.connection.db!
            .collection("users")
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
        next();
    } catch {
        res.status(401).json({ message: "Invalid or expired token" });
    }
}

export function requireRole(...roles: AuthUser["role"][]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Access denied" });
        }
        next();
    };
}