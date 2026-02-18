const express = require("express");
const axios = require("axios");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

/* ==============================
   🔒 SECURITY MIDDLEWARE
================================= */

// Secure CORS (badilisha domain yako baadaye)
app.use(cors({
    origin: ["http://localhost:5500"],
    methods: ["GET", "POST"]
}));

app.use(express.json());

// Rate limiter (protect against spam attacks)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100
});

app.use(limiter);

/* ==============================
   🚀 HEALTH CHECK
================================= */

app.get("/", (req, res) => {
    res.send("NomadHome Secure Payment Server Running 🚀");
});

/* ==============================
   💳 FLUTTERWAVE VERIFY
================================= */

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;

app.post("/verify-payment", async (req, res) => {

    const { transaction_id } = req.body;

    try {

        const response = await axios.get(
            `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
            {
                headers: {
                    Authorization: `Bearer ${FLW_SECRET_KEY}`
                }
            }
        );

        const data = response.data;

        if (
            data.status === "success" &&
            data.data.status === "successful"
        ) {
            return res.json({
                success: true,
                message: "Payment verified successfully",
                paymentData: data.data
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Payment not successful"
            });
        }

    } catch (error) {
        console.error(error.response?.data || error.message);
        return res.status(500).json({
            success: false,
            message: "Verification failed"
        });
    }
});

/* ==============================
   🌍 TRON BLOCKCHAIN VERIFY
================================= */

app.post("/verify-crypto", async (req, res) => {

    const { txid, expectedAmount, escrowWallet } = req.body;

    try {

        const response = await axios.get(
            `https://apilist.tronscanapi.com/api/transaction-info?hash=${txid}`
        );

        const data = response.data;

        if (!data || !data.contractData) {
            return res.status(400).json({
                success: false,
                message: "Invalid TXID"
            });
        }

        const amount = data.contractData.amount / 1000000; // USDT decimals
        const toAddress = data.contractData.to_address;

        if (
            parseFloat(amount) === parseFloat(expectedAmount) &&
            toAddress === escrowWallet
        ) {
            return res.json({
                success: true,
                message: "Blockchain payment verified"
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Amount or wallet mismatch"
            });
        }

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Verification failed"
        });
    }
});

/* ==============================
   🏁 START SERVER
================================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
