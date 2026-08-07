require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(cors());
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

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        reply: "Gaurav sir, Render Environment Variables me GEMINI_API_KEY miss hai!",
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: parts,
    });

    res.json({
      reply: response.text,
    });
  } catch (err) {
    console.error("Gemini API Error:", err);
    res.status(500).json({
      reply: `Gaurav sir, AI Error: ${err.message || "Processing failed"}`,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 ARIN Server Running on port ${PORT}`);
});
