// Local Vector Search utilities (In-Memory)
const User = require('../models/User');
const { getEmbedding } = require('./embedding-utils');

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

/**
 * Calculate Cosine Similarity between two vectors
 * @param {number[]} vecA 
 * @param {number[]} vecB 
 * @returns {number} similarity score (-1 to 1)
 */
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Local Vector Search (In-Memory)
 * Fetches all mechanics with embeddings and calculates similarity locally
 */
async function vectorSearchMechanics(diagnosis, userLocation = null, category = null) {
    try {
        // 1. Generate embedding for diagnosis
        console.log('📊 Generating embedding for diagnosis...');
        const diagnosisEmbedding = await getEmbedding(diagnosis);
        console.log(`✅ Generated embedding: ${diagnosisEmbedding.length} dimensions`);

        // 2. Fetch all available mechanics with embeddings
        // Optimization: Only fetch necessary fields to reduce memory usage
        const mechanics = await User.find({
            role: "mechanic",
            isApproved: true,
            availabilityStatus: "available",
            mechanicProfileEmbedding: { $exists: true, $ne: [] }
        })
            .select('name skills specialty rating experienceYears completedBookings phone location latitude longitude mechanicProfileEmbedding')
            .lean();

        console.log(`📥 Fetched ${mechanics.length} mechanics with embeddings for local comparison`);

        if (mechanics.length === 0) {
            console.log('⚠️ No mechanics with embeddings found. Make sure to run the embedding generation script.');
            return [];
        }

        // 3. Calculate similarity for each mechanic
        const scoredMechanics = mechanics.map(mechanic => {
            const similarity = cosineSimilarity(diagnosisEmbedding, mechanic.mechanicProfileEmbedding);

            // Calculate distance if location provided
            let distance = 999;
            if (userLocation && userLocation.latitude && userLocation.longitude &&
                mechanic.latitude && mechanic.longitude) {
                distance = calculateDistance(
                    userLocation.latitude,
                    userLocation.longitude,
                    mechanic.latitude,
                    mechanic.longitude
                );
            }

            // Remove large embedding array from result to save memory
            const { mechanicProfileEmbedding, ...mechanicData } = mechanic;

            return {
                ...mechanicData,
                similarity,
                distance
            };
        });

        // 4. Filter by minimum similarity threshold (optional, e.g., > 0.3)
        // const relevantMechanics = scoredMechanics.filter(m => m.similarity > 0.3);
        const relevantMechanics = scoredMechanics;

        console.log(`✅ Calculated similarity for ${relevantMechanics.length} mechanics`);

        // 5. Apply multi-factor ranking with Category Boost
        return rankMechanics(relevantMechanics, userLocation, category);

    } catch (error) {
        console.error('❌ Local vector search error:', error.message);
        throw error; // Will trigger fallback in parent function
    }
};

/**
 * Unified ranking function for mechanics
 */
function rankMechanics(mechanics, userLocation, category = null) {
    console.log(`📊 Ranking ${mechanics.length} mechanics... Category: ${category}`);

    // Helper to check if mechanic matches category
    const matchesCategory = (mechanic) => {
        if (!category || category === 'صيانة عامة') return false;
        const specialty = mechanic.specialty || '';
        const skills = mechanic.skills || [];
        return specialty.includes(category) || skills.some(s => s.includes(category));
    };

    if (userLocation && userLocation.latitude && userLocation.longitude) {
        // Sort by: Similarity (50%), Distance (25%), Rating (10%), Experience (5%), Category Boost (10%)
        mechanics.sort((a, b) => {
            const boostA = matchesCategory(a) ? 0.2 : 0; // Huge boost for category match
            const boostB = matchesCategory(b) ? 0.2 : 0;

            const scoreA = (a.similarity || 0) * 0.5 +
                (1 / (a.distance + 1)) * 0.25 +
                (a.rating / 5) * 0.1 +
                (a.completedBookings / 100) * 0.05 +
                boostA;

            const scoreB = (b.similarity || 0) * 0.5 +
                (1 / (b.distance + 1)) * 0.25 +
                (b.rating / 5) * 0.1 +
                (b.completedBookings / 100) * 0.05 +
                boostB;

            a.finalScore = scoreA; // Store for debugging
            return scoreB - scoreA;
        });
    } else {
        // Sort by: Similarity (60%), Rating (15%), Experience (10%), Category Boost (15%)
        mechanics.sort((a, b) => {
            const boostA = matchesCategory(a) ? 0.3 : 0; // Massive boost for category match
            const boostB = matchesCategory(b) ? 0.3 : 0;

            const scoreA = (a.similarity || 0) * 0.6 +
                (a.rating / 5) * 0.15 +
                (a.completedBookings / 100) * 0.1 +
                boostA;

            const scoreB = (b.similarity || 0) * 0.6 +
                (b.rating / 5) * 0.15 +
                (b.completedBookings / 100) * 0.1 +
                boostB;

            a.finalScore = scoreA; // Store for debugging
            return scoreB - scoreA;
        });
    }

    // Log top 3 for debugging
    mechanics.slice(0, 3).forEach((m, i) => {
        console.log(`#${i + 1}: ${m.name} (${m.specialty}) - Score: ${m.finalScore?.toFixed(3)} [Sim: ${m.similarity?.toFixed(3)}, Rate: ${m.rating}, Boost: ${matchesCategory(m)}]`);
    });

    // Return top mechanics (controller will slice)
    return mechanics;
}

module.exports = {
    vectorSearchMechanics,
    rankMechanics,
    calculateDistance
};
