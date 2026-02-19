const express = require("express");
const axios = require("axios");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

app.get("/", (req, res) => {
    res.send("NomadHome Secure Payment Server Running 🚀");
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
   🔥 FIREBASE ADMIN INIT
================================= */

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/* ==============================
   🧠 AI FRAUD ENGINE
================================= */

async function calculateRiskScore(booking) {

    let risk = 0;

    if (booking.depositAmount > 10000) risk += 30;
    if (booking.months > 12) risk += 20;
    if (!booking.txid) risk += 15;
    if (booking.totalAmount > 50000) risk += 25;

    const recentBookings = await db.collection("bookings")
        .where("userEmail", "==", booking.userEmail)
        .get();

    if (recentBookings.size > 3) risk += 20;

    let level = "Low";
    if (risk >= 60) level = "High";
    else if (risk >= 30) level = "Medium";

    return { riskScore: risk, riskLevel: level };
}

/* ==============================
   🔍 FRAUD SCAN LOOP
================================= */

async function scanFraudBookings() {

    const snapshot = await db.collection("bookings").get();

    snapshot.forEach(async (docSnap) => {

        const booking = docSnap.data();

        if (!booking.riskScore) {

            const result = await calculateRiskScore(booking);

            await db.collection("bookings")
                .doc(docSnap.id)
                .update({
                    riskScore: result.riskScore,
                    riskLevel: result.riskLevel
                });

            console.log("Risk analyzed:", docSnap.id);
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

// 🔁 RUN ENGINES
setInterval(autoReleaseEscrow, 30000);
setInterval(scanFraudBookings, 45000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
