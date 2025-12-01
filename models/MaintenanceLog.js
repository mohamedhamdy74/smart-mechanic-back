const mongoose = require("mongoose");

const maintenanceLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        task: {
            type: String,
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        km: {
            type: Number,
            required: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("MaintenanceLog", maintenanceLogSchema);
