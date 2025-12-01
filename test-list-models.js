require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    try {
        console.log('Listing available Gemini models...');
        console.log('API Key:', process.env.GEMINI_API_KEY.substring(0, 20) + '...');

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // Try to list models
        const models = await genAI.listModels();
        console.log('\nAvailable models:');
        for await (const model of models) {
            console.log('- ', model.name);
        }
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('\nThis might mean:');
        console.error('1. The API key is invalid');
        console.error('2. The API key doesn\'t have the right permissions');
        console.error('3. You need to enable the Generative Language API');
        console.error('\nPlease check: https://makersuite.google.com/app/apikey');
    }
}

listModels();
