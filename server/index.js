require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.get("/", (req, res) => {
  res.json({ message: "ARIN AI Server Running 🚀" });
});

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: message,
    });

    res.json({
      reply: response.text,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      reply: "Server Error",
    });
  }
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`🚀 ARIN Server Running on http://localhost:${PORT}`);
});
