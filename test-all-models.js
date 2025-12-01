require('dotenv').config();
const fetch = require('node-fetch');

async function testAllModels() {
    const apiKey = process.env.GEMINI_API_KEY;

    // Try different model names
    const models = [
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-pro',
        'gemini-pro-vision'
    ];

    for (const modelName of models) {
        console.log(`\nTrying model: ${modelName}...`);

        try {
            const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: "Say hello"
                        }]
                    }]
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`✅ ${modelName} WORKS!`);
                console.log('Response:', data.candidates[0].content.parts[0].text);
                break; // Found a working model
            } else {
                console.log(`❌ ${modelName} - Status: ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ ${modelName} - Error: ${error.message}`);
        }
    }
}

testAllModels();
