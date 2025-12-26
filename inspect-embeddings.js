const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const ATLAS_URI = process.env.MONGO_URI;

async function inspectEmbeddings() {
    try {
        await mongoose.connect(ATLAS_URI);
        console.log('✅ Connected.');

        const mechanics = await User.find({ role: 'mechanic' }).limit(2);

        if (mechanics.length < 2) {
            console.log('Not enough mechanics to compare.');
            return;
        }

        const mech1 = mechanics[0];
        const mech2 = mechanics[1];

        console.log(`\nComparing embeddings for:`);
        console.log(`1. ${mech1.name} (${mech1.specialty})`);
        console.log(`2. ${mech2.name} (${mech2.specialty})`);

        const emb1 = mech1.mechanicProfileEmbedding;
        const emb2 = mech2.mechanicProfileEmbedding;

        console.log(`\nLengths: ${emb1.length} vs ${emb2.length}`);

        // Check first 5 values
        console.log(`\nFirst 5 values (Mech 1):`, emb1.slice(0, 5));
        console.log(`First 5 values (Mech 2):`, emb2.slice(0, 5));

        // Check if identical
        const isIdentical = emb1.every((val, index) => val === emb2[index]);
        console.log(`\n⚠️ Are embeddings identical? ${isIdentical ? 'YES ❌' : 'NO ✅'}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

inspectEmbeddings();
