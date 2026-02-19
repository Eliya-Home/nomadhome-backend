const express = require("express");
const axios = require("axios");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const admin = require("firebase-admin");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

app.get("/", (req, res) => {
    res.send("NomadHome AI Fraud Server Running 🚀");
});

/* ==============================
   🔥 FIREBASE ADMIN INIT
================================= */

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/* ==============================
   🧠 OPENAI INIT
================================= */

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/* ==============================
   🌍 TRON VERIFY
================================= */

app.post("/verify-crypto", async (req, res) => {

    const { txid } = req.body;

    try {
        const response = await axios.get(
            `https://apilist.tronscanapi.com/api/transaction-info?hash=${txid}`
        );

        if (!response.data) {
            return res.status(400).json({ success:false });
        }

        return res.json({ success:true });

    } catch (error) {
        return res.status(500).json({ success:false });
    }
});

/* ==============================
   🧠 AI FRAUD ANALYSIS
================================= */

async function analyzeBookingWithAI(booking) {

    const prompt = `
You are a fintech fraud detection AI.

Analyze this booking:

User: ${booking.userEmail}
Deposit: ${booking.depositAmount}
Total: ${booking.totalAmount}
Months: ${booking.months}
Currency: ${booking.currency}

Return JSON only:

{
  "riskScore": number (0-100),
  "riskLevel": "Low" | "Medium" | "High",
  "reason": "short explanation"
}
`;

    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
    });

    const text = completion.choices[0].message.content;

    try {
        return JSON.parse(text);
    } catch {
        return {
            riskScore: 50,
            riskLevel: "Medium",
            reason: "AI parsing error fallback"
        };
    }
}

/* ==============================
   🔍 FRAUD SCAN LOOP
================================= */

async function scanFraudBookings() {

    const snapshot = await db.collection("bookings").get();

    snapshot.forEach(async (docSnap) => {

        const booking = docSnap.data();

        if (!booking.aiRiskScore) {

            const result = await analyzeBookingWithAI(booking);

            await db.collection("bookings")
                .doc(docSnap.id)
                .update({
                    aiRiskScore: result.riskScore,
                    aiRiskLevel: result.riskLevel,
                    aiReason: result.reason
                });

            console.log("AI analyzed:", docSnap.id);
        }

    });
}

/* ==============================
   🔁 AUTO RELEASE ENGINE
================================= */

async function autoReleaseEscrow() {

    const snapshot = await db.collection("bookings").get();

    snapshot.forEach(async (docSnap) => {

        const booking = docSnap.data();

        if (
            booking.status === "Approved - Escrow Locked" &&
            booking.checkInDate &&
            new Date(booking.checkInDate) <= new Date()
        ) {

            await db.collection("bookings")
                .doc(docSnap.id)
                .update({
                    status:"Escrow Released (Auto)",
                    releasedAt:new Date()
                });

            console.log("Auto released:", docSnap.id);
        }

    });
}

// run loops
setInterval(autoReleaseEscrow, 30000);
setInterval(scanFraudBookings, 60000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
