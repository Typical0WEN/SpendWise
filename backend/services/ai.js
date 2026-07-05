// LOCATION: backend/services/ai.js
// Groq AI service — fast inference via llama-3.1-8b-instant.
// Get a free API key at: console.groq.com
// Add to backend/.env: GROQ_API_KEY=your_key_here

const Groq = require('groq-sdk');

// Instantiate once at module load — not inside the function.
// This avoids creating a new client on every single AI request.
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL       = 'llama-3.1-8b-instant';
const MAX_TOKENS  = 512;  // enough for 3-5 sentence coach replies, avoids runaway responses

async function askAI(prompt) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set in .env');
  }

  try {
    const response = await groq.chat.completions.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role:    'system',
          content: 'You are SpendWise AI, a concise and helpful personal finance coach. ' +
                   'Give warm, direct, actionable advice in 3-5 sentences. ' +
                   'Never use markdown formatting or bullet points.',
        },
        {
          role:    'user',
          content: prompt,
        },
      ],
    });

    const text = response.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error('Groq returned an empty response');
    }

    return text;

  } catch (err) {
    // Log clearly so you can debug from the terminal
    console.error('❌ Groq AI error:', err.message);
    throw err; // re-throw so coach route can return a proper 500
  }
}

module.exports = askAI;