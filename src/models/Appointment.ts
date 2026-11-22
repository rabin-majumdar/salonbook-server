import { Schema, model } from "mongoose";

export const TIME_SLOTS = [
    "09:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "02:00 PM",
    "03:00 PM",
    "04:00 PM",
    "05:00 PM",
] as const;

const appointmentSchema = new Schema(
    {
        serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
        customerId: { type: Schema.Types.ObjectId, required: true },
        appointmentDate: { type: String, required: true },
        timeSlot: { type: String, required: true, enum: TIME_SLOTS },
        message: { type: String, trim: true, default: "" },
        servicePrice: { type: Number, required: true },
        paymentStatus: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
        status: {
            type: String,
            enum: ["pending", "confirmed", "cancelled"],
            default: "pending",
        },
    },
    { timestamps: true }
);

export const Appointment = model("Appointment", appointmentSchema);