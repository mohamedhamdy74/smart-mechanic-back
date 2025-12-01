const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function testGemini() {
    console.log("Testing Gemini API Connection...");
    console.log("API Key present:", !!process.env.GEMINI_API_KEY);

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Using gemini-2.0-flash as it was listed in the available models
        console.log("Trying 'gemini-2.0-flash'...");
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent("Hello");
        const response = await result.response;
        console.log("Success with gemini-2.0-flash:", response.text());

    } catch (error) {
        console.error("Error:", error.message);
    }
}

testGemini();
