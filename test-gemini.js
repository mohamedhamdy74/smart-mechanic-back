require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGemini() {
    try {
        console.log('Testing Gemini API...');
        console.log('API Key exists:', !!process.env.GEMINI_API_KEY);

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // Try gemini-1.5-flash which is the current free model
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = "You are a car mechanic. Diagnose this problem: My car engine is making a loud knocking sound. Provide possible causes and recommendations.";

        console.log('Sending request to Gemini...');
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('\n✅ SUCCESS! Gemini API is working!\n');
        console.log('Response:');
        console.log(text);
        console.log('\n---\n');
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response);
        }
    }
}

testGemini();
