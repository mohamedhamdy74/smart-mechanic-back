const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate maintenance plan using Gemini AI
 * @param {Object} carData - Car information from Car model
 * @param {Array} maintenanceLogs - Array of maintenance log entries
 * @returns {Promise<Object>} - AI-generated maintenance plan
 */
async function generateMaintenancePlan(carData, maintenanceLogs) {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Build the AI prompt
    const prompt = `You are an automotive AI assistant. Generate a full predictive maintenance plan based ONLY on the user's input and their car data.
NEVER mention workshops or mechanics.
Return valid JSON ONLY.

Input:
Car Data: ${JSON.stringify(carData, null, 2)}
Maintenance Logs: ${JSON.stringify(maintenanceLogs, null, 2)}

Output MUST follow this exact JSON structure (no markdown, no code blocks, just pure JSON):

{
  "upcoming": [
    { "task": "...", "dueAtKM": 0, "estimatedDays": 0, "priority": "High|Medium|Low" }
  ],
  "warnings": ["..."],
  "recommended": ["..."],
  "carHealthScore": 0
}

Rules:
1. Return ONLY valid JSON, no markdown formatting
2. carHealthScore must be 0-100
3. priority must be exactly "High", "Medium", or "Low"
4. dueAtKM should be based on current mileage: ${carData.mileage || 0} km
5. estimatedDays should be realistic based on average driving patterns
6. Include at least 3-5 upcoming maintenance tasks
7. Add warnings for overdue or critical maintenance
8. Recommend preventive maintenance based on car age and mileage`;

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            attempts++;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text();

            // Clean up the response - remove markdown code blocks if present
            text = text.trim();
            if (text.startsWith("```json")) {
                text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");
            } else if (text.startsWith("```")) {
                text = text.replace(/```\n?/g, "");
            }
            text = text.trim();

            // Parse JSON
            const parsedData = JSON.parse(text);

            // Validate structure
            if (!parsedData.upcoming || !Array.isArray(parsedData.upcoming)) {
                throw new Error("Invalid structure: missing 'upcoming' array");
            }
            if (!parsedData.warnings || !Array.isArray(parsedData.warnings)) {
                throw new Error("Invalid structure: missing 'warnings' array");
            }
            if (!parsedData.recommended || !Array.isArray(parsedData.recommended)) {
                throw new Error("Invalid structure: missing 'recommended' array");
            }
            if (typeof parsedData.carHealthScore !== "number") {
                throw new Error("Invalid structure: missing or invalid 'carHealthScore'");
            }

            // Validate each upcoming task
            for (const task of parsedData.upcoming) {
                if (!task.task || !task.dueAtKM || !task.estimatedDays || !task.priority) {
                    throw new Error("Invalid task structure in 'upcoming' array");
                }
                if (!["High", "Medium", "Low"].includes(task.priority)) {
                    throw new Error(`Invalid priority value: ${task.priority}`);
                }
            }

            // Ensure carHealthScore is within range
            parsedData.carHealthScore = Math.max(0, Math.min(100, parsedData.carHealthScore));

            return parsedData;
        } catch (error) {
            console.error(`Attempt ${attempts} failed:`, error.message);

            if (attempts >= maxAttempts) {
                // Return a default plan if all attempts fail
                console.error("All attempts failed. Returning default maintenance plan.");
                return {
                    upcoming: [
                        {
                            task: "تغيير زيت المحرك",
                            dueAtKM: (carData.mileage || 0) + 5000,
                            estimatedDays: 90,
                            priority: "High",
                        },
                        {
                            task: "فحص الفرامل",
                            dueAtKM: (carData.mileage || 0) + 10000,
                            estimatedDays: 180,
                            priority: "Medium",
                        },
                        {
                            task: "تغيير مرشح الهواء",
                            dueAtKM: (carData.mileage || 0) + 15000,
                            estimatedDays: 270,
                            priority: "Low",
                        },
                    ],
                    warnings: ["فشل في الاتصال بخدمة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى لاحقاً."],
                    recommended: ["قم بإجراء فحص دوري للسيارة"],
                    carHealthScore: 75,
                };
            }

            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}

module.exports = {
    generateMaintenancePlan,
};
