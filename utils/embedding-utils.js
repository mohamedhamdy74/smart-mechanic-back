// back-end/utils/embedding-utils.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini client – ensure GEMINI_API_KEY is set in .env
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate an embedding vector for a given text using Gemini's text‑embedding‑004 model.
 * @param {string} text The text to embed.
 * @returns {Promise<number[]>} Array of float numbers.
 */
async function getEmbedding(text) {
    const model = genai.getGenerativeModel({ model: "text-embedding-004" });
    // embedContent expects a content object; using role "user" and a single text part.
    const result = await model.embedContent({ content: { role: "user", parts: [{ text }] } });
    return result?.embedding?.values || [];
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
