// LOCATION: frontend/js/coach.js
// AI Coach chat interface. Depends on api.js (askCoach, getUser).
// initCoach() is called by app.js when the coach page is shown.

let coachInitialised = false;

// Called once when the user first navigates to the coach page
function initCoach() {
  if (coachInitialised) return;
  coachInitialised = true;

  const user      = getUser();
  const firstName = user.name ? user.name.split(' ')[0] : 'there';

  appendBubble('ai',
    `Hey ${firstName} 👋 I'm your SpendWise AI coach. ` +
    `I can see your real spending data — ask me anything about your finances.`
  );
}

// ── Append a chat bubble ───────────────────────────
function appendBubble(role, text) {
  const win = document.getElementById('chat-window');
  if (!win) return;

  const div       = document.createElement('div');
  div.className   = `bubble ${role}`;
  div.textContent = text;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}

// ── Typing indicator ───────────────────────────────
function showTyping() {
  const win       = document.getElementById('chat-window');
  const div       = document.createElement('div');
  div.className   = 'bubble ai typing';
  div.id          = 'typing-bubble';
  div.textContent = 'Thinking…';
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}

function removeTyping() {
  document.getElementById('typing-bubble')?.remove();
}

// ── Quick prompt chips ─────────────────────────────
function quickAsk(text) {
  const input = document.getElementById('chat-input');
  if (input) input.value = text;
  sendChat();
}

// ── Send a message ─────────────────────────────────
async function sendChat() {
  const input = document.getElementById('chat-input');
  const text  = input?.value?.trim();
  if (!text) return;

  input.value = '';
  appendBubble('user', text);
  showTyping();

  try {
    const data = await askCoach(text);
    removeTyping();

    if (data?.reply) {
      appendBubble('ai', data.reply);
    } else {
      appendBubble('ai', '⚠️ No response received. Please try again.');
    }
  } catch {
    removeTyping();
    appendBubble('ai', '⚠️ Could not reach the AI coach. Check your connection and try again.');
  }
}