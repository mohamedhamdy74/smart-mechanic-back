require('dotenv').config();
const fetch = require('node-fetch');

async function testFetch() {
    try {
        console.log('Testing fetch...');
        console.log('HF_TOKEN exists:', !!process.env.HF_TOKEN);

        const response = await fetch("https://api-inference.huggingface.co/models/google/flan-t5-base", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inputs: "test input",
            }),
        });

        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Result:', result);
    } catch (error) {
        console.error('Error:', error);
    }
}

testFetch();
