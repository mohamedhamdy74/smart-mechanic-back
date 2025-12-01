require('dotenv').config();
const fetch = require('node-fetch');

async function testNewEndpoint() {
    try {
        console.log('Testing new HuggingFace endpoint...');
        console.log('HF_TOKEN exists:', !!process.env.HF_TOKEN);

        // Try the new endpoint format
        const response = await fetch("https://api-inference.huggingface.co/models/google/flan-t5-base", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inputs: "Diagnose: car engine making noise",
            }),
        });

        console.log('Response status:', response.status);
        const text = await response.text();
        console.log('Response:', text);

        // Try to parse as JSON
        try {
            const json = JSON.parse(text);
            console.log('Parsed JSON:', json);
        } catch (e) {
            console.log('Not JSON response');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testNewEndpoint();
