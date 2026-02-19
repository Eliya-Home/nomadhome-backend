require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 FIREBASE ADMIN
initializeApp({
  credential: cert(require("./serviceAccountKey.json"))
});

const db = getFirestore();

// 🔥 OPENAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ================================
// 🔥 AUTO AI RISK ANALYSIS
// ================================

app.post("/create-booking", async (req, res) => {

  try {
    const booking = req.body;

    // Save booking first
    const docRef = await db.collection("bookings").add({
      ...booking,
      status: "Pending AI Analysis",
      createdAt: new Date()
    });

    // 🔥 RUN AI AUTOMATICALLY
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a fraud detection AI for a global escrow property platform."
        },
        {
          role: "user",
          content: `
          Analyze this booking:

          User: ${booking.userEmail}
          Property: ${booking.propertyTitle}
          Amount: ${booking.totalAmount}
          Currency: ${booking.currency}
          Payment: ${booking.paymentMethod}

          Return JSON:
          {
            "riskScore": number (0-100),
            "riskLevel": "Low | Medium | High",
            "explanation": "short explanation"
          }
          `
        }
      ]
    });

    const result = JSON.parse(aiResponse.choices[0].message.content);

    // 🔥 Update booking with AI result
    await docRef.update({
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      aiExplanation: result.explanation,
      status: "Approved - Escrow Locked"
    });

    res.json({ success: true });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "AI Error" });
  }
});

app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});
