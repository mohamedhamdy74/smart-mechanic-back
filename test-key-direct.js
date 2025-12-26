const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

async function testKey() {
    const genAI = new GoogleGenerativeAI(API_KEY);

    console.log("🔑 Testing with key directly...");

    // 1. Test Text Generation (Gemini 1.5 Flash)
    try {
        console.log("\n🧪 Testing Text Generation (gemini-1.5-flash)...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello, are you working?");
        console.log("✅ Text Gen Success:", result.response.text().trim());
    } catch (error) {
        console.error("❌ Text Gen Failed:", error.message);
    }

    // 2. Test Embeddings (text-embedding-004)
    try {
        console.log("\n🧪 Testing Embeddings (text-embedding-004)...");
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent("Hello world");
        console.log("✅ Embedding Success! Vector length:", result.embedding.values.length);
    } catch (error) {
        console.error("❌ Embedding Failed:", error.message);
        if (error.message.includes("API_KEY_INVALID")) {
            console.error("⚠️  Result: API Key is rejected.");
        } else if (error.message.includes("429")) {
            console.error("⚠️  Result: Quota exceeded.");
        }
    }
}

testKey();
