import { Schema, model } from "mongoose";

const transactionSchema = new Schema(
    {
        appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", required: true },
        customerId: { type: Schema.Types.ObjectId, required: true },
        amount: { type: Number, required: true },
        currency: { type: String, required: true },
        stripeSessionId: { type: String, required: true, unique: true },
        status: { type: String, enum: ["paid", "failed"], required: true },
    },
    { timestamps: true }
);

export const Transaction = model("Transaction", transactionSchema);