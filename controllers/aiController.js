// AI Diagnosis Controller using Google Gemini (New SDK) with RAG
const { validationResult } = require("express-validator");
const { GoogleGenAI } = require("@google/genai");
const User = require("../models/User");

// Initialize Gemini with API key from environment
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// Helper function to extract problem category from diagnosis
function extractProblemCategory(diagnosis) {
  // 1. Try to find explicit category tag from Gemini (e.g., Category=فرامل)
  const categoryMatch = diagnosis.match(/Category=([\w\u0600-\u06FF]+)/i);
  if (categoryMatch && categoryMatch[1]) {
    const explicitCategory = categoryMatch[1].trim();
    console.log(`Found explicit category tag: ${explicitCategory}`);

    // Validate if it matches one of our known categories
    const validCategories = ['محرك', 'فرامل', 'كهرباء', 'تكييف', 'جير', 'إطارات', 'تعليق'];
    const mappedCategory = validCategories.find(c => explicitCategory.includes(c));

    if (mappedCategory) {
      console.log(`Mapped explicit category to: ${mappedCategory}`);
      return [mappedCategory, 'صيانة عامة'];
    }
  }

  // 2. Fallback to keyword matching if no explicit tag or invalid tag
  console.log('No valid explicit category found, falling back to keyword matching');
  const lowerDiagnosis = diagnosis.toLowerCase();

  // Map problem keywords to mechanic specialties (specific keywords only)
  const categoryMap = {
    'فرامل': ['فرامل', 'فرملة', 'brakes', 'brake', 'بريك', 'كاليبر', 'دسك', 'فحمات'],
    'إطارات': ['إطارات', 'إطار', 'tires', 'tire', 'عجل', 'كاوتش', 'فرقع', 'مفرقع', 'بنشر'],
    'كهرباء': ['كهرباء', 'كهربائ', 'electrical', 'بطارية', 'battery', 'إشعال', 'أسلاك', 'دينامو', 'بواجي'],
    'محرك': ['محرك', 'engine', 'موتور', 'طرمبة', 'بستم', 'سلندر', 'سيلندر'],
    'تكييف': ['تكييف', 'ac', 'air conditioning', 'تبريد', 'مكيف'],
    'جير': ['جير', 'transmission', 'ناقل حركة', 'قير', 'فتيس', 'ترس'],
    'تعليق': ['تعليق', 'suspension', 'مساعدين', 'امتصاص', 'عفريته', 'شنبر'],
  };

  // Count matches for each category
  let bestMatch = { category: 'صيانة عامة', count: 0 };

  for (const [keyword, specialties] of Object.entries(categoryMap)) {
    let matchCount = 0;
    for (const specialty of specialties) {
      // Count how many times this specialty appears
      const regex = new RegExp(specialty.toLowerCase(), 'g');
      const matches = lowerDiagnosis.match(regex);
      if (matches) {
        matchCount += matches.length;
      }
    }

    if (matchCount > bestMatch.count) {
      bestMatch = { category: keyword, count: matchCount };
    }
  }

  if (bestMatch.count > 0) {
    console.log(`Matched category: ${bestMatch.category} (${bestMatch.count} matches)`);
    return [bestMatch.category, 'صيانة عامة'];
  }

  console.log('No specific category matched, using default');
  return ['صيانة عامة'];
}

// Helper function to calculate distance between two points (Haversine formula)
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

// RAG: Find best matching mechanic based on diagnosis
async function findRecommendedMechanics(diagnosis, userLocation = null) {
  try {
    const relevantSpecialties = extractProblemCategory(diagnosis);

    console.log('Looking for mechanics with specialties:', relevantSpecialties);

    let mechanics = await User.find({
      role: 'mechanic',
      availabilityStatus: 'available'
    })
      .select('name skills specialty rating experienceYears completedBookings phone location latitude longitude')
      .lean();

    console.log('Found', mechanics.length, 'available mechanics in total');

    if (mechanics.length === 0) {
      return [];
    }

    // Mark specialists
    mechanics = mechanics.map(mechanic => {
      const isSpecialist =
        (mechanic.skills && mechanic.skills.some(skill => relevantSpecialties.includes(skill))) ||
        (mechanic.specialty && relevantSpecialties.includes(mechanic.specialty));

      return { ...mechanic, isSpecialist };
    });

    const specialistCount = mechanics.filter(m => m.isSpecialist).length;
    console.log('Found', specialistCount, 'specialists in', relevantSpecialties.join(', '));

    // Calculate distances if location provided
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      mechanics = mechanics.map(mechanic => {
        if (mechanic.latitude && mechanic.longitude) {
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            mechanic.latitude,
            mechanic.longitude
          );
          return { ...mechanic, distance };
        }
        return { ...mechanic, distance: 999 };
      });

      // Sort by: Specialty (50%), Distance (25%), Rating (20%), Experience (5%)
      mechanics.sort((a, b) => {
        const scoreA = (a.isSpecialist ? 1 : 0) * 0.5 +
          (1 / (a.distance + 1)) * 0.25 +
          (a.rating / 5) * 0.2 +
          (a.completedBookings / 100) * 0.05;
        const scoreB = (b.isSpecialist ? 1 : 0) * 0.5 +
          (1 / (b.distance + 1)) * 0.25 +
          (b.rating / 5) * 0.2 +
          (b.completedBookings / 100) * 0.05;
        return scoreB - scoreA;
      });
    } else {
      // Sort by: Specialty (60%), Rating (30%), Experience (10%)
      mechanics.sort((a, b) => {
        const scoreA = (a.isSpecialist ? 1 : 0) * 0.6 +
          (a.rating / 5) * 0.3 +
          (a.completedBookings / 100) * 0.1;
        const scoreB = (b.isSpecialist ? 1 : 0) * 0.6 +
          (b.rating / 5) * 0.3 +
          (b.completedBookings / 100) * 0.1;
        return scoreB - scoreA;
      });
    }

    // Return only the best mechanic
    return mechanics.slice(0, 1);
  } catch (error) {
    console.error('Error finding mechanics:', error);
    return [];
  }
}

// Format mechanic recommendation in Arabic
function formatMechanicRecommendations(mechanics) {
  if (!mechanics || mechanics.length === 0) {
    return '\n\n---\n\n**لم يتم العثور على ميكانيكيين متاحين حالياً.**';
  }

  const mechanic = mechanics[0];
  const isSpecialist = mechanic.isSpecialist;
  const specialtyBadge = isSpecialist ? '⭐ متخصص' : '';

  let recommendations = '\n\n---\n\n## 🔧 الميكانيكي المقترح:\n\n';
  recommendations += `### ${mechanic.name} ${specialtyBadge}\n`;
  recommendations += `- **التخصص:** ${mechanic.specialty || mechanic.skills?.join(', ') || 'صيانة عامة'}\n`;
  recommendations += `- **التقييم:** ${mechanic.rating ? `⭐ ${mechanic.rating.toFixed(1)}/5` : 'جديد'}\n`;
  recommendations += `- **الخبرة:** ${mechanic.experienceYears || 0} سنوات\n`;
  recommendations += `- **الحجوزات المكتملة:** ${mechanic.completedBookings || 0}\n`;

  if (mechanic.distance !== undefined && mechanic.distance < 999) {
    recommendations += `- **المسافة:** ${mechanic.distance.toFixed(1)} كم\n`;
  }

  recommendations += `- **الموقع:** ${mechanic.location || 'غير محدد'}\n`;
  recommendations += `- **الهاتف:** ${mechanic.phone || 'غير متاح'}\n`;
  recommendations += `\n**💡 نصيحة:** هذا هو أنسب ميكانيكي لمشكلتك!`;

  return recommendations;
}

// Gemini API calls
async function callGeminiText(text, userLocation = null) {
  console.log('Calling Gemini text API for:', text);

  const prompt = `You are an expert car mechanic AI assistant. A customer describes this car problem: "${text}"

Please provide a detailed diagnosis in ARABIC language including:
1. الأسباب المحتملة للمشكلة (Possible causes)
2. الإجراءات الموصى بها (Recommended actions)
3. مستوى الأهمية والاستعجال (Urgency level)

IMPORTANT: At the very end of your response, strictly output the category of the problem in this format:
Category=CATEGORY_NAME

Where CATEGORY_NAME must be one of: [محرك, فرامل, كهرباء, تكييف, جير, إطارات, تعليق, صيانة عامة]

Respond ONLY in Arabic (except for the Category tag). Keep the response professional and helpful.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt
  });

  let fullResponse = response.text;

  // RAG: Add mechanic recommendation using the full response (which includes the Category tag)
  const mechanics = await findRecommendedMechanics(fullResponse, userLocation);
  const recommendations = formatMechanicRecommendations(mechanics);

  // Clean the response for display (remove the Category tag)
  const displayResponse = fullResponse.replace(/Category=[\w\u0600-\u06FF]+/i, '').trim();

  console.log('Gemini text result received with', mechanics.length, 'mechanic recommendation');
  return displayResponse + recommendations;
}

async function callGeminiImage(imageBuffer, userLocation = null) {
  console.log('Calling Gemini vision API, buffer size:', imageBuffer.length);

  const prompt = `You are an expert car mechanic AI assistant. Analyze this car image and identify:

Provide your analysis in ARABIC language only:
1. أي أضرار أو مشاكل ظاهرة (Any visible damage or issues)
2. مدى خطورة الضرر (Severity of damage)
3. الإصلاحات الموصى بها (Recommended repairs)
4. مستوى الاستعجال (Urgency level)

IMPORTANT: At the very end of your response, strictly output the category of the problem in this format:
Category=CATEGORY_NAME

Where CATEGORY_NAME must be one of: [محرك, فرامل, كهرباء, تكييف, جير, إطارات, تعليق, صيانة عامة]

Respond ONLY in Arabic (except for the Category tag). Provide a detailed professional assessment.`;

  const base64Image = imageBuffer.toString('base64');

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          }
        ]
      }
    ]
  });

  let fullResponse = response.text;

  // RAG: Add mechanic recommendation
  const mechanics = await findRecommendedMechanics(fullResponse, userLocation);
  const recommendations = formatMechanicRecommendations(mechanics);

  // Clean the response
  const displayResponse = fullResponse.replace(/Category=[\w\u0600-\u06FF]+/i, '').trim();

  console.log('Gemini image result received with', mechanics.length, 'mechanic recommendation');
  return displayResponse + recommendations;
}

async function callGeminiAudio(audioBuffer, userLocation = null) {
  console.log('Calling Gemini audio API, buffer size:', audioBuffer.length);

  const prompt = `You are an expert car mechanic AI assistant. Analyze this audio recording of a car and identify:

Provide your analysis in ARABIC language only:
1. الأصوات التي تسمعها (What sounds you hear)
2. المشاكل الميكانيكية المحتملة بناءً على الأصوات (Possible mechanical issues)
3. خطوات التشخيص الموصى بها (Recommended diagnosis steps)
4. مستوى الاستعجال (Urgency level)

IMPORTANT: At the very end of your response, strictly output the category of the problem in this format:
Category=CATEGORY_NAME

Where CATEGORY_NAME must be one of: [محرك, فرامل, كهرباء, تكييف, جير, إطارات, تعليق, صيانة عامة]

Respond ONLY in Arabic (except for the Category tag). Provide a detailed professional assessment.`;

  const base64Audio = audioBuffer.toString('base64');

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "audio/wav",
                data: base64Audio
              }
            }
          ]
        }
      ]
    });

    let fullResponse = response.text;

    // RAG: Add mechanic recommendation
    const mechanics = await findRecommendedMechanics(fullResponse, userLocation);
    const recommendations = formatMechanicRecommendations(mechanics);

    // Clean the response
    const displayResponse = fullResponse.replace(/Category=[\w\u0600-\u06FF]+/i, '').trim();

    console.log('Gemini audio result received with', mechanics.length, 'mechanic recommendation');
    return displayResponse + recommendations;
  } catch (error) {
    console.log('Audio analysis not supported, returning helpful message');
    return `تم استلام الملف الصوتي (${audioBuffer.length} بايت).

للتشخيص الصوتي للسيارة:
1. حاول وصف الصوت الذي تسمعه بالنص
2. أو ارفع فيديو يظهر المشكلة
3. أصوات السيارات الشائعة: طرق، صرير، طحن، خشخشة، صفير

ملاحظة: إذا لم يكن تحليل الصوت متاحًا، يرجى وصف الصوت بالنص للحصول على أفضل النتائج.`;
  }
}

// AI Diagnosis endpoint
exports.diagnose = async (req, res, next) => {
  try {
    console.log('AI Diagnosis request:', {
      hasText: !!req.body.text,
      hasFile: !!req.file,
      fileType: req.file?.mimetype,
      body: req.body
    });

    const userLocation = req.body.latitude && req.body.longitude ? {
      latitude: parseFloat(req.body.latitude),
      longitude: parseFloat(req.body.longitude)
    } : null;

    let result;

    if (req.body.text) {
      console.log('Calling text diagnosis with:', req.body.text);
      result = await callGeminiText(req.body.text, userLocation);
    } else if (req.file && req.file.mimetype.startsWith('image/')) {
      console.log('Calling image diagnosis, file size:', req.file.size);
      result = await callGeminiImage(req.file.buffer, userLocation);
    } else if (req.file && req.file.mimetype.startsWith('audio/')) {
      console.log('Calling audio diagnosis, file size:', req.file.size);
      result = await callGeminiAudio(req.file.buffer, userLocation);
    } else {
      return res.status(400).json({
        success: false,
        message: "No valid input provided. Send text, image, or audio."
      });
    }

    console.log('AI Diagnosis completed successfully');

    res.json({
      success: true,
      diagnosis: result,
      type: req.body.text ? 'text' : req.file.mimetype.startsWith('image/') ? 'image' : 'audio',
      provider: 'Google Gemini 2.5 Flash + RAG'
    });

  } catch (err) {
    console.error('AI Diagnosis error:', err);
    res.status(500).json({
      success: false,
      message: 'AI diagnosis failed',
      error: err.message
    });
  }
};

// Get diagnosis history
exports.getDiagnosisHistory = async (req, res, next) => {
  try {
    res.json({
      success: true,
      diagnoses: [],
      total: 0
    });
  } catch (err) {
    next(err);
  }
};