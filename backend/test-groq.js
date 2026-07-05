//Location: backend/test-groq.js
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