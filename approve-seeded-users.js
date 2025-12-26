require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

async function approveSeededUsers() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected successfully.");

        console.log("Updating mechanics and workshops to approved status...");

        const result = await User.updateMany(
            {
                role: { $in: ["mechanic", "workshop"] },
                isApproved: { $ne: true } // Only update those not already approved
            },
            { $set: { isApproved: true } }
        );

        console.log(`✅ Success! Updated ${result.modifiedCount} users.`);

        if (result.matchedCount > 0 && result.modifiedCount === 0) {
            console.log("ℹ️  All existing mechanics and workshops were already approved.");
        }

    } catch (error) {
        console.error("❌ Error updating users:", error);
    } finally {
        await mongoose.connection.close();
        console.log("Database connection closed.");
        process.exit(0);
    }
}

approveSeededUsers();
