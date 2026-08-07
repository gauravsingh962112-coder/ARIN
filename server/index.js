require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(cors());

// ⚡ 10MB limit (Render RAM crash hone se bachane ke liye)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.get("/", (req, res) => {
  res.json({ message: "ARIN AI Server Running 🚀" });
});

app.post("/chat", async (req, res) => {
  try {
    const { message, imageBase64, mimeType } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        reply: "Gaurav sir, Render Environment me GEMINI_API_KEY missing hai!",
      });
    }

    const parts = [message || "Is screen ko analyze karke batao."];

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || "image/jpeg",
        },
      });
    }

    // ⏱️ 15 Second Strict Timeout Wrapper
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Gemini AI timeout (15s exceeded)")), 15000)
    );

    const geminiPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: parts,
    });

    // Race between Gemini response and Timeout
    const response = await Promise.race([geminiPromise, timeoutPromise]);

    res.json({
      reply: response.text,
    });
  } catch (err) {
    console.error("Gemini API Error:", err.message || err);
    res.status(500).json({
      reply: `Gaurav sir, AI processing error: ${err.message || "Timeout"}`,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 ARIN Server Running on port ${PORT}`);
});
