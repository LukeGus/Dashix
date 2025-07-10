const express = require("express");
const app = express();
const port = 2000;

const cors = require('cors');
app.use(cors({
  origin: ['https://dashix.dev', 'http://localhost:3000'],
  credentials: true
}));

const mongoist = require("mongoist");

const connectionString = "mongodb://dashix:dashix@127.0.0.1:27017/dashix?authSource=admin";
const connectionOptions = {
    ssl: false,
};
const db = mongoist(connectionString, connectionOptions);
const submissions = db.collection("feedback");

app.use(express.json());

app.post("/feedback", async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).send({ error: "No data provided" });
        }
        await submissions.insertOne(req.body);
        res.status(201).send({ message: "Feedback submitted successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to save feedback" });
    }
});

app.listen(port, () => {
    console.log("Database server started on port " + port);
});