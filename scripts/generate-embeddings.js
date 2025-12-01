// back-end/scripts/generate-embeddings.js
require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');
const { getEmbedding } = require('../utils/embedding-utils');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        const mechanics = await User.find({ role: 'mechanic' });
        console.log(`🔧 Mechanics found: ${mechanics.length}`);

        for (const mech of mechanics) {
            const description = [
                mech.specialty,
                ...(mech.skills || []),
                mech.bio,
                mech.certifications?.join(' '),
            ]
                .filter(Boolean)
                .join(' ');

            if (!description) {
                console.warn(`⚠️ No description for mechanic ${mech.name}, skipping`);
                continue;
            }

            const embedding = await getEmbedding(description);
            mech.embedding = embedding;
            await mech.save();
            console.log(`✅ Updated embedding for ${mech.name}`);
        }

        console.log('✅ All embeddings generated');
    } catch (err) {
        console.error('❌ Error generating embeddings:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

run();
