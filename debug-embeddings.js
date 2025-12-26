const { getEmbedding } = require('./utils/embedding-utils');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function debugEmbeddings() {
    console.log("Debugging getEmbedding...");

    const text1 = "مرحبا بكم في عالم السيارات";
    const text2 = "الطقس اليوم جميل جدا ومشمس";

    console.log(`\nText 1: "${text1}"`);
    console.log(`Text 2: "${text2}"`);

    const emb1 = await getEmbedding(text1);
    console.log(`Embedding 1 generated (len: ${emb1.length})`);
    console.log(`First 5:`, emb1.slice(0, 5));

    const emb2 = await getEmbedding(text2);
    console.log(`\nEmbedding 2 generated (len: ${emb2.length})`);
    console.log(`First 5:`, emb2.slice(0, 5));

    const isIdentical = emb1.every((val, i) => val === emb2[i]);
    console.log(`\n⚠️ Are they identical? ${isIdentical ? 'YES ❌' : 'NO ✅'}`);
}

debugEmbeddings();
