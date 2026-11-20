import "dotenv/config";
import mongoose from "mongoose";

async function main() {
    const email = process.argv[2]?.toLowerCase();
    if (!email) {
        console.error("Usage: npm run make-admin -- <email>");
        process.exit(1);
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");

    await mongoose.connect(uri, { dbName: "salonBook-db" });

    const result = await mongoose.connection
        .db!.collection("users")
        .updateOne({ email }, { $set: { role: "admin" } });

    if (result.matchedCount === 0) {
        console.error(`No user found with email: ${email}`);
    } else {
        console.log(`${email} is now an admin`);
    }

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});