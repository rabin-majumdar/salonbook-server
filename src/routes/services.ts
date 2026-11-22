import { Router } from "express";
import { isValidObjectId } from "mongoose";
import multer from "multer";
import { z } from "zod";
import { Service, SERVICE_CATEGORIES } from "../models/Service";
import { verifyToken, requireRole } from "../middleware/auth";
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

const serviceSchema = z.object({
    serviceName: z.string().trim().min(1, "Service name is required"),
    category: z.enum(SERVICE_CATEGORIES),
    description: z.string().trim().min(1, "Description is required"),
    price: z.coerce.number().positive("Price must be a positive number"),
    duration: z.coerce.number().positive("Duration must be a positive number"),
    status: z.enum(["active", "inactive"]).optional(),
});

const escapeRegex = (text: string) =>
    text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");



router.get("/", async (req, res) => {
    try {
        const { search, category, sort, limit } = req.query;
        const filter: Record<string, unknown> = { status: "active" };

        if (typeof search === "string" && search.trim()) {
            filter.serviceName = { $regex: escapeRegex(search.trim()), $options: "i" };
        }
        if (typeof category === "string" && category.trim()) {
            filter.category = category;
        }

        let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
        if (sort === "price_asc") sortOption = { price: 1 };
        if (sort === "price_desc") sortOption = { price: -1 };

        let query = Service.find(filter).sort(sortOption);
        const limitNum = Number(limit);
        if (limitNum > 0) query = query.limit(limitNum);

        res.json(await query);
    } catch {
        res.status(500).json({ message: "Failed to fetch services" });
    }
});


router.get("/admin/all", verifyToken, requireRole("admin"), async (_req, res) => {
    try {
        res.json(await Service.find().sort({ createdAt: -1 }));
    } catch {
        res.status(500).json({ message: "Failed to fetch services" });
    }
});


router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid service ID" });
        }
        const service = await Service.findById(id);
        if (!service) {
            return res.status(404).json({ message: "Service not found" });
        }
        res.json(service);
    } catch {
        res.status(500).json({ message: "Failed to fetch service" });
    }
});


router.post(
    "/",
    verifyToken,
    requireRole("admin"),
    upload.single("image"),
    async (req, res) => {
        try {
            const parsed = serviceSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ message: parsed.error.issues[0].message });
            }
            if (!req.file) {
                return res.status(400).json({ message: "Service image is required" });
            }

            const image = await uploadToImgBB(req.file.buffer);
            const service = await Service.create({ ...parsed.data, image });
            res.status(201).json(service);
        } catch {
            res.status(500).json({ message: "Failed to create service" });
        }
    }
);

router.put(
    "/:id",
    verifyToken,
    requireRole("admin"),
    upload.single("image"),
    async (req, res) => {
        try {
            const { id } = req.params;
            if (!isValidObjectId(id)) {
                return res.status(400).json({ message: "Invalid service ID" });
            }

            const parsed = serviceSchema.partial().safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ message: parsed.error.issues[0].message });
            }

            const update: Record<string, unknown> = { ...parsed.data };
            if (req.file) update.image = await uploadToImgBB(req.file.buffer);

            const service = await Service.findByIdAndUpdate(id, update, {
                new: true,
                runValidators: true,
            });
            if (!service) {
                return res.status(404).json({ message: "Service not found" });
            }
            res.json(service);
        } catch {
            res.status(500).json({ message: "Failed to update service" });
        }
    }
);

router.delete("/:id", verifyToken, requireRole("admin"), async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid service ID" });
        }
        const service = await Service.findByIdAndDelete(id);
        if (!service) {
            return res.status(404).json({ message: "Service not found" });
        }
        res.json({ message: "Service deleted" });
    } catch {
        res.status(500).json({ message: "Failed to delete service" });
    }
});

export default router;