const mongoose = require('mongoose');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function checkEmbeddings() {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const totalMechanics = await User.countDocuments({ role: 'mechanic' });
        const mechanicsWithEmbeddings = await User.countDocuments({
            role: 'mechanic',
            mechanicProfileEmbedding: { $exists: true, $not: { $size: 0 } }
        });

        console.log(`📊 Total Mechanics: ${totalMechanics}`);
        console.log(`✅ Mechanics with Embeddings: ${mechanicsWithEmbeddings}`);

        if (mechanicsWithEmbeddings > 0) {
            console.log('✨ Embeddings are present!');
        } else {
            console.log('⚠️ No embeddings found.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkEmbeddings();
