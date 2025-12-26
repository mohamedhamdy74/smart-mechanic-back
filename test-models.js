const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
    try {
        /*
         * Note: The Node.js SDK doesn't always expose listModels directly on the main client in older versions,
         * but let's try or use a known working model like 'gemini-pro'.
         */

        console.log("Testing gemini-pro...");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result = await model.generateContent("Hello");
            console.log("✅ gemini-pro works!");
        } catch (e) {
            console.log("❌ gemini-pro failed:", e.message);
        }

        console.log("\nTesting gemini-1.5-flash...");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent("Hello");
            console.log("✅ gemini-1.5-flash works!");
        } catch (e) {
            console.log("❌ gemini-1.5-flash failed:", e.message);
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
