import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(express.static(".")); // supaya builder.html dan lainnya bisa diakses

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// endpoint AI generator
app.post("/generate", async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Kamu adalah AI pembuat website profesional. Buatkan 1 file HTML lengkap (CSS + JS inline). Gunakan warna gelap modern, responsif, dan profesional.",
        },
        { role: "user", content: prompt },
      ],
    });

    const html = response.choices[0].message.content;
    res.json({ html });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal generate website" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 AI Builder aktif di http://localhost:${PORT}`)
);
