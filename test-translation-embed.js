const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function translateAndEmbed() {
    console.log("Testing Translate -> Embed workflow...");

    const text1 = "يوسف إبراهيم متخصص في إصلاح وصيانة الجير وناقل الحركة";
    const text2 = "سارة عبدالله متخصصة في تكييف السيارات والتبريد";

    console.log(`\nOriginal 1: "${text1}"`);
    console.log(`Original 2: "${text2}"`);

    // 1. Translate
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const p1 = model.generateContent(`Translate this to English: "${text1}"`);
    const p2 = model.generateContent(`Translate this to English: "${text2}"`);

    const [r1, r2] = await Promise.all([p1, p2]);

    const eng1 = r1.response.text().trim();
    const eng2 = r2.response.text().trim();

    console.log(`\nTranslated 1: "${eng1}"`);
    console.log(`Translated 2: "${eng2}"`);

    // 2. Embed
    const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

    const e1 = await embedModel.embedContent({ content: { role: "user", parts: [{ text: eng1 }] } });
    const e2 = await embedModel.embedContent({ content: { role: "user", parts: [{ text: eng2 }] } });

    const vec1 = e1.embedding.values;
    const vec2 = e2.embedding.values;

    console.log(`\nVector 1 first 5:`, vec1.slice(0, 5));
    console.log(`Vector 2 first 5:`, vec2.slice(0, 5));

    const isIdentical = vec1.every((val, i) => val === vec2[i]);
    console.log(`\n⚠️ Are vectors identical? ${isIdentical ? 'YES ❌' : 'NO ✅'}`);
}

translateAndEmbed();
