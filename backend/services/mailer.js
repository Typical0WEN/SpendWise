// LOCATION: backend/services/mailer.js
// Fixed Gmail SMTP — uses SSL port 465 + App Password auth.
// HOW TO SET UP:
//  1. myaccount.google.com → Security → enable 2-Step Verification
//  2. myaccount.google.com → Security → App Passwords → Mail → Generate
//  3. Copy the 16-char code → paste as MAIL_PASS in .env
//  NOTE: MAIL_PASS is NOT your Gmail login password

const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   465,
    secure: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
}

async function sendWelcomeEmail(toEmail, toName) {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.log('⚠️  MAIL_USER/MAIL_PASS not set — skipping welcome email.');
    return;
  }

  const firstName = toName.split(' ')[0];

  try {
    const transporter = getTransporter();
    await transporter.verify();

    const info = await transporter.sendMail({
      from:    `"SpendWise AI" <${process.env.MAIL_USER}>`,
      to:      toEmail,
      subject: '✦ Welcome to SpendWise — Your financial coach is ready',
      html:    buildHtml(firstName),
      text:    buildText(firstName),
    });
    console.log(`✅  Welcome email → ${toEmail} [${info.messageId}]`);
  } catch (err) {
    console.error(`⚠️  Email failed (${toEmail}):`, err.message);
  }
}

function buildHtml(firstName) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Welcome to SpendWise</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;background:#eef3f8;color:#0c1a2e;padding:32px 16px;}
.wrap{max-width:580px;margin:0 auto;border-radius:18px;overflow:hidden;box-shadow:0 12px 48px rgba(12,26,46,.15);}
.hd{background:linear-gradient(145deg,#071828 0%,#0a2240 55%,#063a52 100%);padding:48px 44px 36px;text-align:center;}
.glyph{font-size:36px;color:#06b6d4;display:block;margin-bottom:10px;}
.logo{font-size:26px;font-weight:800;color:#fff;margin-bottom:6px;}
.logo em{color:#06b6d4;font-style:italic;}
.tagline{font-size:13px;color:rgba(255,255,255,.5);}
.bd{background:#fff;padding:44px;}
.greeting{font-size:26px;font-weight:800;color:#0c1a2e;margin-bottom:16px;line-height:1.2;}
.greeting em{color:#06b6d4;font-style:normal;}
p{font-size:15px;color:#334155;line-height:1.75;margin-bottom:16px;}
.features{background:#f0fdff;border:1.5px solid rgba(6,182,212,.2);border-radius:12px;padding:24px 28px;margin:24px 0;}
.feat-title{font-size:11px;font-weight:800;color:#0891b2;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;}
.feat{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;font-size:14px;color:#1e3a52;}
.feat:last-child{margin-bottom:0;}
.cta-wrap{text-align:center;margin:32px 0;}
.cta{display:inline-block;background:linear-gradient(110deg,#0e7490,#06b6d4 55%,#22d3ee);color:#fff;text-decoration:none;font-size:15px;font-weight:800;padding:15px 40px;border-radius:10px;box-shadow:0 8px 28px rgba(6,182,212,.35);}
.tip{background:#fefce8;border:1.5px solid rgba(217,119,6,.2);border-radius:10px;padding:16px 20px;font-size:13px;color:#92400e;line-height:1.6;}
.tip strong{color:#d97706;}
.hr{height:1px;background:#e2e8f0;margin:24px 0;}
.ft{background:#f0f4f8;border:1px solid #e2e8f0;padding:28px 44px;text-align:center;}
.ft p{font-size:12px;color:#94a3b8;line-height:1.7;}
</style></head><body>
<div class="wrap">
  <div class="hd">
    <span class="glyph">◈</span>
    <div class="logo">Spend<em>Wise</em> AI</div>
    <p class="tagline">Your intelligent financial coach</p>
  </div>
  <div class="bd">
    <div class="greeting">Welcome aboard, <em>${firstName}</em> ✦</div>
    <p>Thank you for signing up with SpendWise AI. Your account is live and your personal financial coach is ready — the moment you log your first expense, the intelligence kicks in.</p>
    <div class="features">
      <div class="feat-title">What you unlocked today</div>
      <div class="feat">📊 &nbsp;<span><strong>Real-time tracking</strong> — every expense logged and categorised instantly</span></div>
      <div class="feat">⚡ &nbsp;<span><strong>Anomaly alerts</strong> — notified when spending spikes above your pattern</span></div>
      <div class="feat">🤖 &nbsp;<span><strong>AI Coach</strong> — answers built on your real spending data</span></div>
      <div class="feat">💱 &nbsp;<span><strong>Multi-currency</strong> — track spending in your preferred currency with live rates</span></div>
    </div>
    <div class="cta-wrap">
      <a class="cta" href="http://localhost:5500/index.html">Open SpendWise Dashboard →</a>
    </div>
    <div class="hr"></div>
    <div class="tip">💡 <strong>Quick tip:</strong> Log at least 5–7 expenses in your first week. That's when SpendWise starts detecting your personal patterns.</div>
  </div>
  <div class="ft">
    <p>You're receiving this because you created a SpendWise account. If this wasn't you, safely ignore this email.</p>
    <p style="margin-top:10px;">© ${new Date().getFullYear()} SpendWise AI · Built for smarter spending</p>
  </div>
</div></body></html>`;
}

function buildText(firstName) {
  return `Welcome to SpendWise AI, ${firstName}!\n\nYour account is live.\n\nOpen your dashboard: http://localhost:5500/index.html\n\n© ${new Date().getFullYear()} SpendWise AI`;
}

module.exports = { sendWelcomeEmail };