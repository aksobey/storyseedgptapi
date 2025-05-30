<<<<<<< HEAD
﻿const OpenAI = require("openai");
=======
﻿import OpenAI from "openai";
>>>>>>> 9d09858 (Resolve conflicts and clean deployment files)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a creative assistant that writes character descriptions.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 300,
    });

    const reply = completion.choices[0].message.content;
<<<<<<< HEAD
    res.status(200).json({ reply });
  } catch (error) {
    console.error("OpenAI API error:", error);
    res.status(500).json({ error: "Something went wrong with OpenAI." });
  }
};
=======
    return res.status(200).json({ reply });
} catch (err) {
  console.error("OpenAI API error:", err);
  return res.status(500).json({ error: err.message || "Unknown error", detail: err });
}
}
>>>>>>> 9d09858 (Resolve conflicts and clean deployment files)
