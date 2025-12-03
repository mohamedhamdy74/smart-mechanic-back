// Script to generate embeddings for all existing mechanics
const mongoose = require('mongoose');
const User = require('../models/User');
const { getEmbedding } = require('../utils/embedding-utils');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function generateMechanicEmbeddings() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find all mechanics
        const mechanics = await User.find({ role: 'mechanic' });
        console.log(`📊 Found ${mechanics.length} mechanics`);

        let successCount = 0;
        let failCount = 0;

        // Generate embeddings for each mechanic
        for (const mechanic of mechanics) {
            try {
                // Create profile text
                const profileText = [
                    mechanic.name,
                    mechanic.specialty,
                    mechanic.skills?.join(' '),
                    mechanic.bio
                ].filter(Boolean).join(' ');

                if (!profileText.trim()) {
                    console.log(`⚠️  Skipping ${mechanic.name} - no profile data`);
                    continue;
                }

                // Generate embedding
                console.log(`🔄 Generating embedding for: ${mechanic.name}...`);
                const embedding = await getEmbedding(profileText);

                // Update mechanic
                mechanic.mechanicProfileEmbedding = embedding;
                await mechanic.save({ validateBeforeSave: false }); // Skip validation to avoid password rehash

                console.log(`✅ ${mechanic.name} - ${embedding.length} dimensions`);
                successCount++;

                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error(`❌ Failed for ${mechanic.name}:`, error.message);
                failCount++;
            }
        }

        console.log('\n📊 Summary:');
        console.log(`✅ Success: ${successCount}`);
        console.log(`❌ Failed: ${failCount}`);
        console.log(`📝 Total: ${mechanics.length}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the script
generateMechanicEmbeddings();
