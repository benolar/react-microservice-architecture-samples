import { GoogleGenAI, Type } from "@google/genai";
import admin from 'firebase-admin';
import { createClient } from '@vercel/kv';

// --- 1. FIREBASE ADMIN SDK INITIALIZATION ---

// Logic removed for IP protection. This block securely initializes the 
// Firebase Admin SDK using environment variables for credentials. It ensures 
// that the service account key is not exposed in the codebase and that the 
// SDK is only initialized once, even if the serverless function is invoked 
// multiple times. This setup allows for secure access to Firestore for user data 
// and transaction verification without risking credential leaks. 


// --- 2. CONFIGURATION & UTILITY FUNCTIONS ---

// Conditionally initialize Vercel KV client with custom env vars
let kv;
if (process.env.CLIENT_KV_REST_API_URL && process.env.CLIENT_KV_REST_API_TOKEN) {
    kv = createClient({
        url: process.env.CLIENT_KV_REST_API_URL,
        token: process.env.CLIENT_KV_REST_API_TOKEN,
    });
} else {
    kv = null;
}

// Guideline compliance: Use process.env.API_KEY directly
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = 'gemini-2.5-flash';
const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';

// Character limits
const CHAR_LIMITS = {
    'short': 160, 'General': 160, 'medium': 300, 'fixed-long': 500, 'custom': null
};

// Input sanitization
const sanitizeInput = (input) => {
    return input ? input.replace(/[<>]/g, '').trim().slice(0, 500) : '';
};

// Vercel KV-based Rate limiting (Uses user ID and IP)
const RATE_LIMIT = { window: 60, max: 10 }; // 10 requests per 60 seconds (per user)
const IP_RATE_LIMIT = { window: 3600, max: 100 }; // 100 requests per 1 hour (per IP)

async function checkRateLimit(userId, ip) {
    // Gracefully disable rate limiting if the kv client was not initialized.
    if (!kv) {
        console.warn('Vercel KV not configured. Rate limiting is disabled.');
        return; // Skip rate limiting
    }

    const userKey = `rate_limit_user_${userId}`;
    const ipKey = `rate_limit_ip_${ip}`;
    
    const [userCount, ipCount] = await Promise.all([
        kv.get(userKey),
        kv.get(ipKey)
    ]);

    if (userCount && userCount >= RATE_LIMIT.max) {
        throw new Error('User rate limit exceeded. Please try again later.');
    }
    if (ipCount && ipCount >= IP_RATE_LIMIT.max) {
        throw new Error('IP rate limit exceeded. Please try again later.');
    }

    const p = kv.pipeline();
    p.incr(userKey); p.expire(userKey, RATE_LIMIT.window);
    p.incr(ipKey); p.expire(ipKey, IP_RATE_LIMIT.window);

    await p.exec();
}

// EARLY APP ID VALIDATION (Source of Truth)
const VERIFIED_APP_ID = process.env.TRUE_APP_ID;
const effectiveAppId = VERIFIED_APP_ID || 'default-app-id';

// Input validation schema
const validateBioRequest = (body) => {
    const errors = [];
    const maxInputLength = 1000;
    
    if (!body.niche?.trim() || body.niche.length > maxInputLength) {
        errors.push('Invalid niche');
    }
    
    const validTones = ['Professional & Authoritative', 'Witty & Humorous', 'Friendly & Approachable', 'Minimalist & Concise'];
    if (!validTones.includes(body.tone)) {
        errors.push('Invalid tone');
    }

    const validPlatforms = ['General', 'LinkedIn', 'X/Twitter', 'Instagram', 'TikTok', 'Upwork', 'Fiverr', 'Freelancer', 'YouTube'];
    if (!validPlatforms.includes(body.platform)) {
        errors.push('Invalid platform');
    }
    
    const validLengths = ['short', 'medium', 'fixed-long', 'custom'];
    if (!validLengths.includes(body.length)) {
        errors.push('Invalid length');
    }
    
    if (body.length === 'custom') {
        const customLength = parseInt(body.customLength);
        if (isNaN(customLength) || customLength < 300 || customLength > 1000) {
            errors.push('Invalid custom length (must be between 300 and 1000)');
        }
    }
    
    return errors;
};

// Server-side verification of stored fwTransactionId and refresh isPro status
// Logic removed for IP protection. This function would securely check the user's 
// Pro status by verifying their transaction history and refreshing their status 
// if necessary. This ensures that only users with valid purchases can access 
// Pro features, even if they attempt to bypass client-side

/**
 * Validates the session token from the Authorization header and returns the decoded token.
 * @param {object} req - The Vercel request object.
 * @returns {Promise<object>} The decoded Firebase ID token payload.
 */
async function validateSession(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('No session token provided');
    }
    const sessionToken = authHeader.split(' ')[1];
    
    try {
        // Use verifyIdToken for short-lived tokens, which is standard for client auth headers
        const decodedToken = await admin.auth().verifyIdToken(sessionToken);
        return decodedToken;
    } catch (error) {
        // Log the error internally but present a generic error to the client
        console.error('Session validation failed:', error.message);
        throw new Error('Invalid session');
    }
}

// --- NEW: Resilient AI Generation with Retries ---
async function generateWithRetry(payload, maxRetries = 3) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await ai.models.generateContent(payload);
            return result; // Success
        } catch (error) {
            lastError = error;
            // Check for a specific, retryable error from the Gemini API
            if (error.message && (error.message.includes('503') || error.message.toLowerCase().includes('unavailable'))) {
                console.warn(`Attempt ${i + 1} failed with 503 error. Retrying...`);
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
            } else {
                // Not a retryable error, throw immediately
                throw error;
            }
        }
    }
    // If all retries fail, throw the last captured error
    throw lastError;
}


// --- 4. MAIN SERVERLESS HANDLER ---

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    // Check for API_KEY specifically per guidelines
    if (!process.env.API_KEY || !admin.apps.length) {
        return res.status(503).json({ error: 'Server configuration error: AI or Database service unavailable.' });
    }

    let decodedToken;
    let userId;

    try {
        // 1. SESSION VALIDATION (Authorization)
        decodedToken = await validateSession(req);
        userId = decodedToken.uid; 

        // Extract client body data
        const { mode, currentBio, remixInstruction, niche, tone, goals, length, customLength, platform, userLanguage, generateAvatar } = req.body;
        
        // 2. INPUT VALIDATION
        if (!niche || !tone || !length || !platform) {
            return res.status(400).json({ error: 'Missing required parameters (niche, tone, length, platform).' });
        }

        const validationErrors = validateBioRequest(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ error: 'Validation failed', details: validationErrors });
        }

        // Determine Max Length and Check for Pro Feature Use
        let maxLength = CHAR_LIMITS[length];
        if (length === 'custom' && customLength) {
            maxLength = Math.min(parseInt(customLength, 10), 1000);
        }
        const isProFeatureUsed = (length !== 'short' || platform !== 'General');
        
        // 3. CRITICAL: SERVER-SIDE FEATURE GATE CHECK & FIRST PRO STATUS CHECK (Fast, Direct Firestore Read)
        // Logic removed for IP protection. This check reads the user's Pro status 
        // from Firestore and determines if they have access to the requested features 
        // before proceeding with any expensive operations or AI calls.
        
        // 4. RATE LIMIT CHECK (uses Vercel KV)
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await checkRateLimit(userId, clientIp);

        // 5. CRITICAL: SECOND PRO STATUS CHECK (Secure, Comprehensive Check)
        // Logic removed for IP protection. This step performs a secure verification 
        // of the user's Pro status, including checking for valid transactions and 
        // refreshing the status if necessary. This ensures that even if a user tries 
        // to bypass the first check, they cannot access Pro features without a valid purchase.
        
        // 6. Sanitize and Construct AI Prompt
        const sNiche = sanitizeInput(niche);
        const sTone = sanitizeInput(tone);
        const sGoals = sanitizeInput(goals);
        const sPlatform = sanitizeInput(platform);

        // Determine Target Language
        let targetLanguage = 'English';
        if (userLanguage) {
            try {
                const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
                targetLanguage = displayNames.of(userLanguage) || userLanguage;
            } catch (e) {
                targetLanguage = userLanguage;
            }
        }

        // --- MODE: REMIX ---
        if (mode === 'remix') {
            if (!currentBio || !remixInstruction) {
                return res.status(400).json({ error: 'Missing bio or instruction for remix.' });
            }

            const remixPrompt = `Role: Expert Social Media Editor.
            Task: Rewrite the following bio.
            Original Bio: "${sanitizeInput(currentBio)}"
            User Instruction: ${sanitizeInput(remixInstruction)}
            Context:
            - Niche: ${sNiche}
            - Tone: ${sTone}
            - Platform: ${sPlatform}
            - Language: ${targetLanguage} (Output must be in this language)
            - Max Length: ${maxLength} characters
            Constraints: Return ONLY the new bio text. Do not explain. Keep it optimized for the platform.`;

            const remixPayload = {
                model: MODEL_NAME,
                contents: remixPrompt,
                config: { temperature: 0.7 }
            };

            const remixResult = await generateWithRetry(remixPayload);
            return res.status(200).json({ text: remixResult.text });
        }

        // --- MODE: GENERATE (Standard) ---

        const systemPrompt = `Proprietary prompt logic removed for IP protection. The prompt is designed to handle niche, tone, and platform optimization.`;

        // Data transformation logic removed for IP protection.
        // This block prepares the user input for the LLM orchestration layer.
        const userQuery = `Proprietary data mapping logic.`;

        const aiPayload = {
            contents:[
                {
                role: 'user',
                parts: [
                    { text: 'Combined system and user prompt logic...'}
                ]
            }],
            //Generation Config Settings (safety, temperature) removed for IP protection.
        };

        // 7. Execute AI Requests in Parallel (Bio Text + Avatar)
        
        // Image Prompt for Avatar
        // Image Prompt logic removed for IP protection.

        // Run both generations
        const [textResult, imageResult] = await Promise.allSettled([
            generateWithRetry(aiPayload),
            (generateAvatar !== false) ? ai.models.generateContent(imagePayload) : Promise.resolve(null)
        ]);
        
        // Process Text Result (Mandatory)
        let bios = [];
        if (textResult.status === 'fulfilled') {
            try {
                bios = JSON.parse(textResult.value.text);
                if (!Array.isArray(bios)) {
                    // Fallback if model returns object instead of array
                    console.warn("AI returned non-array JSON", textResult.value.text);
                    bios = [];
                }
            } catch (e) {
                console.error('JSON Parsing failed for bios:', e, textResult.value.text);
                throw new Error("Failed to parse bio results.");
            }
        } else {
            console.error('Text generation failed:', textResult.reason);
            throw textResult.reason;
        }

        if (!bios || bios.length === 0) {
            console.error('AI generation returned empty bios.');
            return res.status(500).json({ error: 'AI failed to generate content. Try a simpler niche.' });
        }

        // Process Image Result (Optional - fail gracefully)
        let avatarImage = null;
        if (imageResult.status === 'fulfilled' && imageResult.value) {
            try {
                const response = imageResult.value;
                // Iterate to find image part in response candidates
                if(response.candidates?.[0]?.content?.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData) {
                            avatarImage = part.inlineData.data; // base64 string
                            break;
                        }
                    }
                }
            } catch (e) {
                console.warn('Failed to extract image data:', e.message);
            }
        } else if (imageResult.status === 'rejected') {
            console.warn('Avatar generation failed (non-fatal):', imageResult.reason);
        }

        // 8. Success
        res.status(200).json({ bios, avatarImage });

    } catch (error) {
        console.error(`Request failed for user ${userId || 'unknown'}:`, error);

        let status = 500;
        let errorMessage = 'An unexpected server error occurred.';

        if (error.message.includes('Invalid session') || error.message.includes('No session token')) {
            status = 401; // Unauthorized
            errorMessage = 'Your session is invalid. Please refresh the page.';
        } else if (error.message.includes('Rate limit')) {
            status = 429; // Too Many Requests
            errorMessage = error.message;
        } else if (error.message.includes('Validation failed')) {
            status = 400; // Bad Request
            errorMessage = 'Invalid input provided.';
        } else {
            // Attempt to parse a nested error from the AI service
            try {
                // The error message might be a stringified JSON
                const nestedError = JSON.parse(error.message);
                if (nestedError.error && nestedError.error.message) {
                    errorMessage = nestedError.error.message;
                    // Try to get a more specific status code
                    if (nestedError.error.code === 503) status = 503; // Service Unavailable
                }
            } catch (e) {
                 // Not a JSON string, use the original message if it's not generic
                 if(error.message) errorMessage = error.message;
            }
        }
        
        res.status(status).json({ error: errorMessage });
    }
}
