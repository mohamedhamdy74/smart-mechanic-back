// back-end/utils/embedding-utils.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini client – ensure GEMINI_API_KEY is set in .env
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Simple in-memory cache for embeddings
const embeddingCache = new Map();
const CACHE_LIMIT = 1000;

/**
 * Generate an embedding for the given text using Gemini.
 * @param {string} text The text to embed.
 * @returns {Promise<number[]>} The embedding vector.
 */
async function getEmbedding(text) {
    try {
        // Check cache first
        if (embeddingCache.has(text)) {
            return embeddingCache.get(text);
        }

        const model = genai.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text);
        const embedding = result.embedding.values;

        // Cache the embedding
        if (embeddingCache.size >= CACHE_LIMIT) {
            // Remove oldest entry
            const firstKey = embeddingCache.keys().next().value;
            embeddingCache.delete(firstKey);
        }
        embeddingCache.set(text, embedding);

        return embedding;
    } catch (error) {
        console.error("Error generating embedding:", error.message);
        throw error;
    }
}

/**
 * Compute cosine similarity between two vectors.
 * @param {number[]} a First vector.
 * @param {number[]} b Second vector.
 * @returns {number} Cosine similarity between -1 and 1.
 */
function cosineSimilarity(a, b) {
    const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
    const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    return dot / (normA * normB);
}

module.exports = { getEmbedding, cosineSimilarity };
