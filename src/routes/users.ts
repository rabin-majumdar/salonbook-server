import { Router } from "express";
import mongoose, { isValidObjectId } from "mongoose";
import { z } from "zod";
import { verifyToken, requireRole } from "../middleware/auth";
import multer from "multer";
import { uploadToImgBB } from "../utils/imgbb";

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Only image files are allowed"));
    },
});

const users = () => mongoose.connection.db!.collection("users");
const PUBLIC_FIELDS = {
    name: 1,
    email: 1,
    image: 1,
    phone: 1,
    role: 1,
    isBlocked: 1,
    createdAt: 1,
};

const profileSchema = z.object({
    name: z.string().trim().min(1, "Name is required").optional(),
    image: z.string().trim().url("Invalid image URL").or(z.literal("")).optional(),
    phone: z.string().trim().max(20).optional(),
});


router.post("/me/avatar", verifyToken, upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Please choose an image" });
        }
        const url = await uploadToImgBB(req.file.buffer);
        res.json({ url });
    } catch {
        res.status(500).json({ message: "Image upload failed" });
    }
});

router.patch("/me", verifyToken, async (req, res) => {
    try {
        const parsed = profileSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0].message });
        }
        const update: Record<string, unknown> = { updatedAt: new Date() };
        const { name, image, phone } = parsed.data;
        if (name !== undefined) update.name = name;
        if (image !== undefined) update.image = image;
        if (phone !== undefined) update.phone = phone;

        await users().updateOne(
            { _id: new mongoose.Types.ObjectId(req.user!.id) },
            { $set: update }
        );
        const user = await users().findOne(
            { _id: new mongoose.Types.ObjectId(req.user!.id) },
            { projection: PUBLIC_FIELDS }
        );
        res.json(user);
    } catch {
        res.status(500).json({ message: "Failed to update profile" });
    }
});

router.get("/me", verifyToken, async (req, res) => {
    try {
        const user = await users().findOne(
            { _id: new mongoose.Types.ObjectId(req.user!.id) },
            { projection: PUBLIC_FIELDS }
        );
        res.json(user);
    } catch {
        res.status(500).json({ message: "Failed to fetch profile" });
    }
});


router.get("/", verifyToken, requireRole("admin"), async (_req, res) => {
    try {
        const list = await users()
            .find({ role: { $ne: "admin" } }, { projection: PUBLIC_FIELDS })
            .sort({ createdAt: -1 })
            .toArray();
        res.json(list);
    } catch {
        res.status(500).json({ message: "Failed to fetch users" });
    }
});

router.get("/:id", verifyToken, requireRole("admin"), async (req, res) => {
    try {
        const id = String(req.params.id);
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }
        const user = await users().findOne(
            { _id: new mongoose.Types.ObjectId(id) },
            { projection: PUBLIC_FIELDS }
        );
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch {
        res.status(500).json({ message: "Failed to fetch user" });
    }
});

function setBlocked(blocked: boolean) {
    return async (req: any, res: any) => {
        try {
            const id = String(req.params.id);
            if (!isValidObjectId(id)) {
                return res.status(400).json({ message: "Invalid user ID" });
            }
            const target = await users().findOne({ _id: new mongoose.Types.ObjectId(id) });
            if (!target) return res.status(404).json({ message: "User not found" });
            if (target.role === "admin") {
                return res.status(400).json({ message: "Admin accounts cannot be blocked" });
            }
            await users().updateOne(
                { _id: target._id },
                { $set: { isBlocked: blocked, updatedAt: new Date() } }
            );
            res.json({ message: blocked ? "User blocked" : "User unblocked" });
        } catch {
            res.status(500).json({ message: "Failed to update user" });
        }
    };
}

router.patch("/:id/block", verifyToken, requireRole("admin"), setBlocked(true));
router.patch("/:id/unblock", verifyToken, requireRole("admin"), setBlocked(false));

export default router;