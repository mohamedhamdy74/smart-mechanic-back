require('dotenv').config();
const fetch = require('node-fetch');

async function testInferenceAPI() {
    try {
        console.log('Testing HuggingFace Serverless Inference API...');
        console.log('Token:', process.env.HF_TOKEN.substring(0, 10) + '...');

        // According to HF docs, the endpoint format is still the same
        // but they may have rate limits or require different headers
        const response = await fetch("https://api-inference.huggingface.co/models/google/flan-t5-small", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inputs: "Translate to French: Hello world",
            }),
        });

        console.log('Status:', response.status);
        console.log('Headers:', Object.fromEntries(response.headers.entries()));

        const text = await response.text();
        console.log('Response:', text);

        try {
            const json = JSON.parse(text);
            console.log('Parsed:', json);
        } catch (e) {
            console.log('Not JSON');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testInferenceAPI();
