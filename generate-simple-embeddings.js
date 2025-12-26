// Generate simple embeddings without Gemini API
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const ATLAS_URI = process.env.MONGO_URI;

// Simple text to vector conversion (TF-IDF-like)
function simpleEmbedding(text) {
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(768).fill(0);

    // Simple hash-based embedding
    words.forEach((word, idx) => {
        for (let i = 0; i < word.length; i++) {
            const charCode = word.charCodeAt(i);
            const position = (charCode * (i + 1) * (idx + 1)) % 768;
            embedding[position] += 1 / (idx + 1);
        }
    });

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => norm > 0 ? val / norm : 0);
}

async function generateSimpleEmbeddings() {
    try {
        console.log('🔄 Connecting to Atlas...');
        await mongoose.connect(ATLAS_URI);
        console.log('✅ Connected!\n');

        const mechanics = await User.find({ role: 'mechanic' });
        console.log(`📊 Found ${mechanics.length} mechanics\n`);

        for (const mechanic of mechanics) {
            const profileText = [
                mechanic.name,
                mechanic.specialty,
                mechanic.skills?.join(' '),
                mechanic.bio
            ].filter(Boolean).join(' ');

            if (profileText.trim()) {
                const embedding = simpleEmbedding(profileText);
                mechanic.mechanicProfileEmbedding = embedding;
                await mechanic.save({ validateBeforeSave: false });
                console.log(`✅ ${mechanic.name} - ${embedding.length} dimensions`);
            }
        }

        console.log('\n🎉 Simple embeddings generated!');
        console.log('⚠️  Note: These are basic embeddings, not AI-powered');
        console.log('💡 For production, use Gemini API when quota is available\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

generateSimpleEmbeddings();
