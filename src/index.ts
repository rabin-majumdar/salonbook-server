import "dotenv/config";
import app from "./app";
import { connectDB } from "./config/db";

const port = process.env.PORT || 5000;

connectDB()
    .then(() => app.listen(port, () => console.log(`Server on ${port}`)))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });