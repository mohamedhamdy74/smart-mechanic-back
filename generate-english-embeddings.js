// Generate English embeddings for mechanics
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const User = require('./models/User');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
const ATLAS_URI = process.env.MONGO_URI;

const genAI = new GoogleGenerativeAI(API_KEY);

// English profile mapping
const englishProfiles = {
    'محرك': 'Expert car engine mechanic specializing in engine repair, motor diagnostics, pistons, cylinders, and engine overhaul',
    'كهرباء': 'Automotive electrical specialist focusing on car electrical systems, batteries, alternators, spark plugs, and wiring',
    'إطارات': 'Tire and wheel expert specializing in tire replacement, puncture repair, wheel alignment, and balancing',
    'فرامل': 'Brake system specialist expert in brake pads, disc brakes, brake fluid, ABS systems, and stopping power',
    'تكييف': 'Car air conditioning expert specializing in AC repair, cooling systems, refrigerant, and climate control',
    'جير': 'Transmission and gearbox specialist focusing on manual and automatic transmission repair, gear shifting, and drivetrain'
};

async function generateEnglishEmbeddings() {
    try {
        console.log('🔄 Connecting to Atlas...');
        await mongoose.connect(ATLAS_URI);
        console.log('✅ Connected!\n');

        const mechanics = await User.find({ role: 'mechanic' });
        console.log(`📊 Found ${mechanics.length} mechanics\n`);

        const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

        for (const mechanic of mechanics) {
            const specialty = mechanic.specialty || 'صيانة عامة';
            const englishText = englishProfiles[specialty] || 'General car mechanic with expertise in vehicle maintenance and repair';

            // Add name transliteration to make embeddings more unique
            const fullText = `${mechanic.name} - ${englishText}`;

            console.log(`🔄 ${mechanic.name} (${specialty})`);
            console.log(`   EN: "${fullText.substring(0, 60)}..."`);

            const result = await embedModel.embedContent({
                content: { role: "user", parts: [{ text: fullText }] }
            });
            const embedding = result.embedding.values;

            console.log(`   Vector: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`);

            mechanic.mechanicProfileEmbedding = embedding;
            await mechanic.save({ validateBeforeSave: false });
            console.log(`   ✅ Saved\n`);

            // Small delay
            await new Promise(r => setTimeout(r, 300));
        }

        // Verification
        console.log('\n🧪 Verification - Checking uniqueness:');
        const updated = await User.find({ role: 'mechanic' });
        const embeddings = updated.map(m => ({ name: m.name, first3: m.mechanicProfileEmbedding.slice(0, 3) }));

        embeddings.forEach(e => console.log(`${e.name}: [${e.first3.map(v => v.toFixed(4)).join(', ')}]`));

        const allSame = embeddings.every((e, i, arr) =>
            i === 0 || e.first3.every((v, j) => v === arr[0].first3[j])
        );

        console.log(`\n${allSame ? '❌ FAILED: All embeddings identical' : '✅ SUCCESS: Embeddings are unique!'}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

generateEnglishEmbeddings();
