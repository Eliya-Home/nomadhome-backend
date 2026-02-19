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
   🔁 AUTO RELEASE ENGINE
================================= */

async function autoReleaseEscrow() {

    const snapshot = await db.collection("bookings").get();

    snapshot.forEach(async (doc) => {

        const booking = doc.data();

        if (
            booking.status === "Approved - Escrow Locked" &&
            booking.checkInDate &&
            new Date(booking.checkInDate) <= new Date()
        ) {

            await db.collection("bookings")
                .doc(doc.id)
                .update({
                    status:"Escrow Released (Auto)",
                    releasedAt:new Date()
                });

            console.log("Auto released:", doc.id);
        }

    });
}

// run every 30 sec
setInterval(autoReleaseEscrow, 30000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
