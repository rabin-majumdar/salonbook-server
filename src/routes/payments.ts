import { Request, Response, Router } from "express";
import mongoose, { isValidObjectId } from "mongoose";
import type Stripe from "stripe";
import { getStripe } from "../config/stripe";
import { Appointment } from "../models/Appointment";
import { Transaction } from "../models/Transaction";
import { verifyToken, requireRole } from "../middleware/auth";

const router = Router();

router.post("/checkout", verifyToken, requireRole("customer"), async (req, res) => {
    try {
        const appointmentId = String(req.body?.appointmentId || "");
        if (!isValidObjectId(appointmentId)) {
            return res.status(400).json({ message: "Invalid appointment ID" });
        }

        const appointment = await Appointment.findById(appointmentId).populate(
            "serviceId",
            "serviceName"
        );
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }
        if (String(appointment.customerId) !== req.user!.id) {
            return res.status(403).json({ message: "Access denied" });
        }
        if (appointment.status !== "confirmed") {
            return res
                .status(400)
                .json({ message: "Only confirmed appointments can be paid" });
        }
        if (appointment.paymentStatus === "paid") {
            return res.status(400).json({ message: "This appointment is already paid" });
        }

        const service = appointment.serviceId as unknown as {
            serviceName?: string;
        } | null;
        const currency = (process.env.STRIPE_CURRENCY || "bdt").toLowerCase();

        const session = await getStripe().checkout.sessions.create({
            mode: "payment",
            customer_email: req.user!.email,
            line_items: [
                {
                    quantity: 1,
                    price_data: {
                        currency,
                        unit_amount: Math.round(appointment.servicePrice * 100),
                        product_data: {
                            name: service?.serviceName || "Salon appointment",
                            description: `${appointment.appointmentDate} at ${appointment.timeSlot}`,
                        },
                    },
                },
            ],
            metadata: {
                appointmentId: String(appointment._id),
                customerId: String(appointment.customerId),
            },
            success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error("Checkout error:", err);
        res.status(500).json({ message: "Could not start payment" });
    }
});

async function recordPayment(
    session: Stripe.Checkout.Session,
    status: "paid" | "failed"
) {
    const appointmentId = session.metadata?.appointmentId;
    const customerId = session.metadata?.customerId;
    if (!appointmentId || !customerId || !isValidObjectId(appointmentId)) return;

    await Transaction.updateOne(
        { stripeSessionId: session.id },
        {
            $setOnInsert: {
                appointmentId,
                customerId,
                amount: (session.amount_total ?? 0) / 100,
                currency: session.currency ?? "",
                stripeSessionId: session.id,
            },
            $set: { status },
        },
        { upsert: true }
    );

    if (status === "paid") {
        await Appointment.updateOne(
            { _id: appointmentId },
            { $set: { paymentStatus: "paid" } }
        );
    }
}

export async function stripeWebhook(req: Request, res: Response) {
    const signature = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || typeof signature !== "string") {
        return res.status(400).send("Missing webhook signature");
    }

    let event: Stripe.Event;
    try {
        event = getStripe().webhooks.constructEvent(req.body, signature, secret);
    } catch {
        return res.status(400).send("Invalid webhook signature");
    }

    try {
        switch (event.type) {
            case "checkout.session.completed":
            case "checkout.session.async_payment_succeeded": {
                const session = event.data.object as Stripe.Checkout.Session;
                if (session.payment_status === "paid") {
                    await recordPayment(session, "paid");
                }
                break;
            }
            case "checkout.session.async_payment_failed": {
                await recordPayment(event.data.object as Stripe.Checkout.Session, "failed");
                break;
            }
        }
        res.json({ received: true });
    } catch (err) {
        console.error("Webhook handler error:", err);
        res.status(500).send("Webhook handler failed");
    }
}


router.get("/session/:sessionId", verifyToken, async (req, res) => {
    try {
        const tx = await Transaction.findOne({
            stripeSessionId: String(req.params.sessionId),
            customerId: req.user!.id,
        });
        if (!tx) return res.json({ status: "processing" });
        res.json({ status: tx.status, amount: tx.amount, currency: tx.currency });
    } catch {
        res.status(500).json({ message: "Failed to check payment" });
    }
});

router.get("/my", verifyToken, requireRole("customer"), async (req, res) => {
    try {
        const list = await Transaction.find({ customerId: req.user!.id })
            .populate({
                path: "appointmentId",
                select: "serviceId appointmentDate timeSlot",
                populate: { path: "serviceId", select: "serviceName" },
            })
            .sort({ createdAt: -1 });
        res.json(list);
    } catch {
        res.status(500).json({ message: "Failed to fetch payments" });
    }
});


router.get("/admin/all", verifyToken, requireRole("admin"), async (_req, res) => {
    try {
        const list = await Transaction.find()
            .populate({
                path: "appointmentId",
                select: "serviceId appointmentDate timeSlot",
                populate: { path: "serviceId", select: "serviceName" },
            })
            .sort({ createdAt: -1 })
            .lean();

        const ids = [...new Set(list.map((t) => String(t.customerId)))].map(
            (id) => new mongoose.Types.ObjectId(id)
        );
        const users = await mongoose.connection
            .db!.collection("users")
            .find({ _id: { $in: ids } })
            .project({ name: 1, email: 1 })
            .toArray();
        const userMap = new Map(users.map((u) => [String(u._id), u]));

        res.json(
            list.map((t) => ({ ...t, customer: userMap.get(String(t.customerId)) || null }))
        );
    } catch {
        res.status(500).json({ message: "Failed to fetch transactions" });
    }
});

export default router;