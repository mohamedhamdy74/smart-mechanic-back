const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const { vectorSearchMechanics } = require('../utils/vector-search');

async function debugSearch() {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const query = "الاطار فرق";
        console.log(`\n🔍 Debugging Search for: "${query}"\n`);

        // 1. Check if Vector Search is enabled in env
        console.log(`Checking USE_VECTOR_SEARCH: ${process.env.USE_VECTOR_SEARCH}`);

        // 2. Run Vector Search
        console.log('--- Running vectorSearchMechanics with Category Boost ---');
        // Pass 'إطارات' as the extracted category to test the boost
        const results = await vectorSearchMechanics(query, null, 'إطارات');

        console.log('\n📊 Detailed Results (Top 5):');
        results.slice(0, 5).forEach((m, i) => {
            console.log(`\n#${i + 1}: ${m.name}`);
            console.log(`   Specialty: ${m.specialty}`);
            console.log(`   Skills: ${m.skills}`);
            console.log(`   Rating: ${m.rating} (${m.completedBookings} bookings)`);
            console.log(`   Similarity Score: ${m.similarity?.toFixed(4)}`);
            console.log(`   Final Weighted Score: ${m.finalScore?.toFixed(4)}`);

            // Explain the score
            // Formula (No Location): Sim * 0.75 + Rating/5 * 0.15 + Bookings/100 * 0.1
            const simPart = (m.similarity || 0) * 0.75;
            const ratePart = (m.rating / 5) * 0.15;
            const bookPart = (m.completedBookings / 100) * 0.1;
            console.log(`   Breakdown: Sim(${simPart.toFixed(4)}) + Rate(${ratePart.toFixed(4)}) + Book(${bookPart.toFixed(4)})`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

debugSearch();
