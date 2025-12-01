require('dotenv').config();
const { GoogleGenAI } = require("@google/genai");

async function testNewGemini() {
    try {
        console.log('Testing new Gemini SDK...');
        console.log('API Key exists:', !!process.env.GEMINI_API_KEY);

        const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        });

        console.log('Sending request to Gemini 2.5 Flash...');
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "You are a car mechanic. Diagnose this problem: My car engine is making a loud knocking sound. Provide possible causes and recommendations."
        });

        console.log('\n✅ SUCCESS! Gemini API is working!\n');
        console.log('Response:');
        console.log(response.text);
        console.log('\n---\n');
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response);
        }
    }
}

testNewGemini();
