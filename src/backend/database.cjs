const express = require("express");
const app = express();
app.set('trust proxy', 1);
const port = 2000;

const cors = require('cors');
app.use(cors({
  origin: ['https://dashix.dev', 'http://localhost:3000'],
  credentials: true
}));

const mongoist = require("mongoist");
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const qs = require('querystring');

const feedbackLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    message: { error: "Too many feedback submissions from this IP, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

const connectionString = "mongodb://dashix:dashix@127.0.0.1:27017/dashix?authSource=admin";
const connectionOptions = {
    ssl: false,
};
const db = mongoist(connectionString, connectionOptions);
const submissions = db.collection("feedback");

app.use(express.json());

app.post("/feedback", feedbackLimiter, async (req, res) => {
    try {
        const allowedOrigins = [
            'https://dashix.dev',
            'http://localhost:3000',
        ];
        const origin = req.get('origin') || req.get('referer') || '';
        if (!allowedOrigins.some(o => origin.startsWith(o))) {
            return res.status(403).send({ error: "Forbidden: Invalid origin." });
        }

        if (req.body.honey && req.body.honey !== "") {
            return res.status(400).send({ error: "Bot detected." });
        }

        const config = await db.collection("config").findOne({ _id: "turnstile" });
        if (!config || !config.secret) {
            return res.status(500).send({ error: "CAPTCHA secret not configured" });
        }
        const secret = config.secret;

        const captchaToken = req.body['cf-turnstile-response'];
        if (!captchaToken) {
            return res.status(400).send({ error: 'CAPTCHA required' });
        }
        const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
        const captchaRes = await axios.post(
            verifyUrl,
            qs.stringify({
                secret,
                response: captchaToken,
                remoteip: req.ip,
            }),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );
        if (!captchaRes.data.success) {
            return res.status(400).send({ error: 'CAPTCHA failed' });
        }

        if (!req.body || !req.body.feedback) {
            return res.status(400).send({ error: "No feedback provided" });
        }
        await submissions.insertOne(req.body);
        res.status(201).send({ message: "Feedback submitted successfully." });
    } catch (err) {
        res.status(500).send({ error: "Failed to save feedback" });
    }
});

app.listen(port, () => {
    console.log("Database server started on port " + port);
});