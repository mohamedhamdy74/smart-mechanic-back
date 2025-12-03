const mongoose = require('mongoose');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function migrateEmbeddings() {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find mechanics with 'embedding' but missing 'mechanicProfileEmbedding'
        const mechanics = await User.find({
            role: 'mechanic',
            embedding: { $exists: true, $not: { $size: 0 } },
            $or: [
                { mechanicProfileEmbedding: { $exists: false } },
                { mechanicProfileEmbedding: { $size: 0 } }
            ]
        });

        console.log(`📊 Found ${mechanics.length} mechanics with legacy embeddings to migrate`);

        let successCount = 0;

        for (const mechanic of mechanics) {
            if (mechanic.embedding && mechanic.embedding.length === 768) {
                mechanic.mechanicProfileEmbedding = mechanic.embedding;
                await mechanic.save({ validateBeforeSave: false });
                console.log(`🔄 Migrated embedding for: ${mechanic.name}`);
                successCount++;
            } else {
                console.log(`⚠️ Skipping ${mechanic.name}: Embedding length is ${mechanic.embedding?.length} (expected 768)`);
            }
        }

        console.log(`\n✅ Successfully migrated ${successCount} mechanics.`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

migrateEmbeddings();
