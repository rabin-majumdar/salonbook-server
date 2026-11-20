import { Router } from "express";
import mongoose, { isValidObjectId } from "mongoose";
import { z } from "zod";
import { Appointment, TIME_SLOTS } from "../models/Appointment";
import { Service } from "../models/Service";
import { verifyToken, requireRole } from "../middleware/auth";

const router = Router();

const bookingSchema = z.object({
    serviceId: z.string().refine(isValidObjectId, "Invalid service ID"),
    appointmentDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid appointment date"),
    timeSlot: z.enum(TIME_SLOTS, { message: "Invalid time slot" }),
    message: z.string().trim().max(500).optional(),
});

const SERVICE_FIELDS = "serviceName category image price duration";


router.post("/", verifyToken, requireRole("customer"), async (req, res) => {
    try {
        const parsed = bookingSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0].message });
        }
        const { serviceId, appointmentDate, timeSlot, message } = parsed.data;

        const today = new Date().toISOString().slice(0, 10);
        if (appointmentDate < today) {
            return res.status(400).json({ message: "Appointment date cannot be in the past" });
        }

        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ message: "Service not found" });
        }
        if (service.status !== "active") {
            return res.status(400).json({ message: "This service is not available for booking" });
        }

        const conflict = await Appointment.findOne({
            appointmentDate,
            timeSlot,
            status: { $in: ["pending", "confirmed"] },
        });
        if (conflict) {
            return res.status(409).json({ message: "This time slot is already booked" });
        }

        const appointment = await Appointment.create({
            serviceId,
            customerId: req.user!.id,
            appointmentDate,
            timeSlot,
            message,
            servicePrice: service.price,
        });
        res.status(201).json(appointment);
    } catch {
        res.status(500).json({ message: "Failed to create appointment" });
    }
});


router.get("/my", verifyToken, requireRole("customer"), async (req, res) => {
    try {
        const appointments = await Appointment.find({ customerId: req.user!.id })
            .populate("serviceId", SERVICE_FIELDS)
            .sort({ createdAt: -1 });
        res.json(appointments);
    } catch {
        res.status(500).json({ message: "Failed to fetch appointments" });
    }
});


router.get("/booked", verifyToken, async (req, res) => {
    try {
        const date = String(req.query.date || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ message: "Invalid date" });
        }
        const booked = await Appointment.find({
            appointmentDate: date,
            status: { $in: ["pending", "confirmed"] },
        }).select("timeSlot");
        res.json({ bookedSlots: booked.map((a) => a.timeSlot) });
    } catch {
        res.status(500).json({ message: "Failed to fetch booked slots" });
    }
});


router.get("/admin/all", verifyToken, requireRole("admin"), async (_req, res) => {
    try {
        const appointments = await Appointment.find()
            .populate("serviceId", SERVICE_FIELDS)
            .sort({ createdAt: -1 })
            .lean();

        const ids = [...new Set(appointments.map((a) => String(a.customerId)))].map(
            (id) => new mongoose.Types.ObjectId(id)
        );
        const users = await mongoose.connection
            .db!.collection("users")
            .find({ _id: { $in: ids } })
            .project({ name: 1, email: 1, image: 1 })
            .toArray();
        const userMap = new Map(users.map((u) => [String(u._id), u]));

        res.json(
            appointments.map((a) => ({
                ...a,
                customer: userMap.get(String(a.customerId)) || null,
            }))
        );
    } catch {
        res.status(500).json({ message: "Failed to fetch appointments" });
    }
});


router.get("/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid appointment ID" });
        }
        const appointment = await Appointment.findById(id).populate(
            "serviceId",
            SERVICE_FIELDS
        );
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }
        const isOwner = String(appointment.customerId) === req.user!.id;
        if (req.user!.role !== "admin" && !isOwner) {
            return res.status(403).json({ message: "Access denied" });
        }
        res.json(appointment);
    } catch {
        res.status(500).json({ message: "Failed to fetch appointment" });
    }
});


router.patch("/:id/confirm", verifyToken, requireRole("admin"), async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid appointment ID" });
        }
        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }
        if (appointment.status !== "pending") {
            return res.status(400).json({ message: "Only pending appointments can be confirmed" });
        }
        appointment.status = "confirmed";
        await appointment.save();
        res.json(appointment);
    } catch {
        res.status(500).json({ message: "Failed to confirm appointment" });
    }
});


router.patch("/:id/cancel", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid appointment ID" });
        }
        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        if (req.user!.role === "admin") {
            if (!["pending", "confirmed"].includes(appointment.status)) {
                return res.status(400).json({ message: "This appointment is already cancelled" });
            }
        } else {
            if (String(appointment.customerId) !== req.user!.id) {
                return res.status(403).json({ message: "Access denied" });
            }
            if (appointment.status !== "pending") {
                return res
                    .status(400)
                    .json({ message: "Only pending appointments can be cancelled" });
            }
        }

        appointment.status = "cancelled";
        await appointment.save();
        res.json(appointment);
    } catch {
        res.status(500).json({ message: "Failed to cancel appointment" });
    }
});

export default router;