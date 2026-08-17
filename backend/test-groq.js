//Location: backend/test-groq.js
require('dotenv').config(); // needed here — index.js loads this for the server, but this script runs standalone
const askAI = require('./services/ai'); // ✅ fixed path

async function test() {
  try {
    const reply = await askAI("Say hello in one sentence.");
    console.log("AI reply:", reply);
  } catch (err) {
    console.error("Test ERROR:", err.message);
  }
}

test();
