const mongoose = require("mongoose");

const maintenancePlanSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        upcoming: [
            {
                task: { type: String, required: true },
                dueAtKM: { type: Number, required: true },
                estimatedDays: { type: Number, required: true },
                priority: {
                    type: String,
                    enum: ["High", "Medium", "Low"],
                    required: true,
                },
            },
        ],
        warnings: [{ type: String }],
        recommended: [{ type: String }],
        carHealthScore: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("MaintenancePlan", maintenancePlanSchema);
