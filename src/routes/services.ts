import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { Service } from "../models/Service";

const router = Router();

const escapeRegex = (text: string) =>
    text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/services?search=&category=&sort=price_asc|price_desc&limit=
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

        const services = await query;
        res.json(services);
    } catch {
        res.status(500).json({ message: "Failed to fetch services" });
    }
});

// GET /api/services/:id
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

export default router;