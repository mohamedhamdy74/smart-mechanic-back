require('dotenv').config();
const { getEmbedding } = require('./utils/embedding-utils');

async function test() {
    console.log("Testing embedding generation...");
    try {
        const text = "Test mechanic profile";
        const vector = await getEmbedding(text);
        console.log("Success! Vector length:", vector.length);
    } catch (e) {
        console.error("Embedding failed:", e.message);
    }
}

test();
