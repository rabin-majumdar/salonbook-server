import { Router } from "express";
import mongoose from "mongoose";
import { Appointment } from "../models/Appointment";
import { Service } from "../models/Service";
import { verifyToken, requireRole } from "../middleware/auth";

const router = Router();

router.get("/admin", verifyToken, requireRole("admin"), async (_req, res) => {
    try {
        const [
            totalCustomers,
            activeServices,
            totalAppointments,
            pending,
            confirmed,
            successfulPayments,
        ] = await Promise.all([
            mongoose.connection.db!.collection("users").countDocuments({ role: { $ne: "admin" } }),
            Service.countDocuments({ status: "active" }),
            Appointment.countDocuments(),
            Appointment.countDocuments({ status: "pending" }),
            Appointment.countDocuments({ status: "confirmed" }),
            Appointment.countDocuments({ paymentStatus: "paid" }),
        ]);
        res.json({
            totalCustomers,
            activeServices,
            totalAppointments,
            pending,
            confirmed,
            successfulPayments,
        });
    } catch {
        res.status(500).json({ message: "Failed to fetch stats" });
    }
});

router.get("/customer", verifyToken, requireRole("customer"), async (req, res) => {
    try {
        const customerId = req.user!.id;
        const [total, pending, confirmed, cancelled] = await Promise.all([
            Appointment.countDocuments({ customerId }),
            Appointment.countDocuments({ customerId, status: "pending" }),
            Appointment.countDocuments({ customerId, status: "confirmed" }),
            Appointment.countDocuments({ customerId, status: "cancelled" }),
        ]);
        res.json({ total, pending, confirmed, cancelled });
    } catch {
        res.status(500).json({ message: "Failed to fetch stats" });
    }
});

export default router;