require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(cors());

// ⚡ Payload Size Limit Increase (Fixes PayloadTooLargeError)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.get("/", (req, res) => {
  res.json({ message: "ARIN AI Server Running 🚀" });
});

app.post("/chat", async (req, res) => {
  try {
    const { message, imageBase64, mimeType } = req.body;

    // 👁️ Prompt + Image Content Preparation
    const contents = [message || "Is screen ko analyze karke batao."];

    if (imageBase64) {
      // Clean base64 string if data URL prefix exists
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      contents.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || "image/jpeg",
        },
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
    });

    res.json({
      reply: response.text,
    });
  } catch (err) {
    console.error("Gemini API Error:", err);
    res.status(500).json({
      reply: "Gaurav sir, backend me AI processing ke waqt error aaya.",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 ARIN Server Running on port ${PORT}`);
});
