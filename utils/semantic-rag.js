const User = require("../models/User");
const { cosineSimilarity } = require("./embedding-utils");

/**
 * Find best mechanic using semantic similarity on embeddings.
 * @param {string} diagnosisText - نص التشخيص من Gemini
 * @param {Array} mechanics - قائمة الميكانيكيين مع embeddings
 * @param {Object} userLocation - { latitude, longitude } (اختياري)
 */
function findBestMechanicByEmbedding(diagnosisText, mechanics, userLocation = null) {
    if (!mechanics || mechanics.length === 0) return [];

    // 1. حساب التشابه بين التشخيص و embedding كل ميكانيكي
    const scoredMechanics = mechanics
        .map(mech => {
            if (!mech.embedding || mech.embedding.length === 0) return null;

            const score = cosineSimilarity(mech.embedding, diagnosisText.embedding || mech.embedding);
            return { ...mech.toObject(), similarity: score };
        })
        .filter(Boolean);

    // 2. حساب المسافة لو موجود الموقع
    if (userLocation && userLocation.latitude && userLocation.longitude) {
        scoredMechanics.forEach(mech => {
            if (mech.latitude && mech.longitude) {
                const R = 6371;
                const dLat = (userLocation.latitude - mech.latitude) * Math.PI / 180;
                const dLon = (userLocation.longitude - mech.longitude) * Math.PI / 180;
                const a = Math.sin(dLat / 2) ** 2 +
                    Math.cos(userLocation.latitude * Math.PI / 180) *
                    Math.cos(mech.latitude * Math.PI / 180) *
                    Math.sin(dLon / 2) ** 2;
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                mech.distance = R * c;
            } else mech.distance = 999;
        });
    }

    // 3. ترتيب الميكانيكيين حسب:
    // similarity (50%), distance (25%), rating (20%), completedBookings (5%)
    scoredMechanics.sort((a, b) => {
        const scoreA = (a.similarity || 0) * 0.5 +
            (1 / (a.distance + 1)) * 0.25 +
            (a.rating / 5) * 0.2 +
            (a.completedBookings / 100) * 0.05;

        const scoreB = (b.similarity || 0) * 0.5 +
            (1 / (b.distance + 1)) * 0.25 +
            (b.rating / 5) * 0.2 +
            (b.completedBookings / 100) * 0.05;

        return scoreB - scoreA;
    });

    return scoredMechanics.slice(0, 1); // أفضل ميكانيكي
}

module.exports = { findBestMechanicByEmbedding };
