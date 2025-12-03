const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function testKey() {
    try {
        const key = process.env.GEMINI_API_KEY;
        console.log(`🔑 Testing API Key: ${key ? key.substring(0, 10) + '...' : 'MISSING'}`);

        if (!key) {
            console.error('❌ GEMINI_API_KEY is missing in .env');
            return;
        }

        const genai = new GoogleGenerativeAI(key);
        const model = genai.getGenerativeModel({ model: "text-embedding-004" });

        console.log('🔄 Attempting to generate embedding...');
        const result = await model.embedContent({ content: { role: "user", parts: [{ text: "test" }] } });

        if (result?.embedding?.values) {
            console.log('✅ API Key is VALID. Embedding generated.');
        } else {
            console.log('⚠️ API Key seems valid but no embedding returned.');
        }

    } catch (error) {
        console.error('❌ API Key is INVALID or Error occurred:', error.message);
    }
}

testKey();
