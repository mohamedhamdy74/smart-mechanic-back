require('dotenv').config();
const fetch = require('node-fetch');

async function testGeminiDirect() {
    try {
        console.log('Testing Gemini API directly...');

        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: "Diagnose this car problem: engine making noise"
                    }]
                }]
            })
        });

        console.log('Status:', response.status);
        const data = await response.json();

        if (response.ok) {
            console.log('\n✅ SUCCESS!\n');
            console.log('Response:', JSON.stringify(data, null, 2));
        } else {
            console.log('\n❌ Error Response:\n');
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testGeminiDirect();
