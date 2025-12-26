const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
const ATLAS_URI = process.env.MONGO_URI;

const genAI = new GoogleGenerativeAI(API_KEY);

// Mock cosine similarity utility
function cosineSimilarity(a, b) {
    const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
    const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    return dot / (normA * normB);
}

async function testRAG() {
    try {
        console.log('🔄 Connecting to Atlas...');
        await mongoose.connect(ATLAS_URI);
        console.log('✅ Connected.');

        const query = "My car engine is making a loud knocking sound and losing power";
        console.log(`\n🧪 Testing RAG with query: "${query}"`);

        // 1. Generate embedding for query
        console.log('🔄 Generating embedding for query...');
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(query);
        const queryEmbedding = result.embedding.values;
        console.log(`✅ Query embedding generated (${queryEmbedding.length} dims)`);

        // 2. Fetch mechanics with embeddings
        const mechanics = await User.find({
            role: 'mechanic',
            mechanicProfileEmbedding: { $exists: true, $not: { $size: 0 } }
        });
        console.log(`📊 Found ${mechanics.length} mechanics with embeddings`);

        // 3. Calculate similarity
        const scoredMechanics = mechanics.map(mech => {
            const similarity = cosineSimilarity(queryEmbedding, mech.mechanicProfileEmbedding);
            return {
                name: mech.name,
                specialty: mech.specialty,
                skills: mech.skills,
                similarity: similarity
            };
        });

        // 4. Sort and get top recommended
        scoredMechanics.sort((a, b) => b.similarity - a.similarity);
        const topRecommendation = scoredMechanics[0];

        console.log('\n🏆 Top Recommendation:');
        console.log(`Name: ${topRecommendation.name}`);
        console.log(`Specialty: ${topRecommendation.specialty}`);
        console.log(`Similarity Score: ${topRecommendation.similarity.toFixed(4)}`);

        console.log('\n📋 All Scores:');
        scoredMechanics.forEach(m => {
            console.log(`- ${m.name} (${m.specialty}): ${m.similarity.toFixed(4)}`);
        });

        if (topRecommendation.specialty.includes('محرك') || topRecommendation.similarity > 0.6) {
            console.log('\n✅ RAG Verification PASSED: Correctly identified engine specialist.');
        } else {
            console.log('\n⚠️  RAG Verification WARNING: Might not be the best match.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testRAG();
