import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Endpoint for AI Custom Cake Generation & Visual Concepts
  app.post("/api/generate-cake-image", async (req, res) => {
    try {
      const { flavor, size, frosting, message, colorTheme, customPrompt } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      const basePrompt = `Ultra-photorealistic high-end luxury celebration cake handcrafted in Lagos. 
Flavor: ${flavor || 'Signature Chocolate'}. 
Tier/Size: ${size || '8" Medium'}. 
Frosting Style: ${frosting || 'Smooth Finish'}. 
Color Accent: ${colorTheme || 'Classic Rose & Gold'}.
Piped Inscription: "${message || 'Happy Birthday'}".
Details: ${customPrompt || 'Artisanal cake decorating, high-end pastry finish, soft studio lighting'}.`;

      if (!apiKey) {
        return res.status(200).json({
          success: true,
          isAIEnriched: false,
          message: "Standard AI prompt generated (Add GEMINI_API_KEY in settings for full Gemini multimodal concept generation)",
          title: `${flavor || 'Signature'} AI Masterpiece`,
          chefNotes: `A custom-balanced ${flavor || 'vanilla'} cake layered with ${frosting || 'smooth frosting'}, designed for elegant Lagos celebrations.`,
          prompt: basePrompt,
          recommendedToppings: ["Gold Leaf Accents", "Edible Rose Petals", "Handcrafted Macarons"]
        });
      }

      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are a master pastry chef and luxury cake designer in Lagos, Nigeria.
The customer has requested a custom cake creation with these preferences:
- Base Flavor: ${flavor}
- Size/Tier: ${size}
- Frosting Style: ${frosting}
- Custom Inscription: "${message || 'Celebration'}"
- Color Accent Theme: "${colorTheme || 'Rose Gold & Cream'}"
- Extra Custom Details: "${customPrompt || 'None'}"

Generate a JSON object with:
"title": a luxurious catchy cake name (e.g., "Lagos Golden Velvet Tier"),
"chefNotes": a 2-sentence culinary overview explaining why this flavor and finish combination is exceptional,
"visualPrompt": a detailed, vivid photorealistic prompt describing what this unique cake looks like for an artisan baker,
"recommendedToppings": array of 3 bespoke toppings or garnishes that complement this exact build.`,
        config: {
          responseMimeType: "application/json"
        }
      });

      const parsed = JSON.parse(response.text || "{}");

      return res.json({
        success: true,
        isAIEnriched: true,
        title: parsed.title || `${flavor} Custom Deluxe`,
        chefNotes: parsed.chefNotes || `Handcrafted with premium ingredients.`,
        visualPrompt: parsed.visualPrompt || basePrompt,
        recommendedToppings: parsed.recommendedToppings || ["Fresh Berries", "Gold Leaf", "Chocolate Shavings"],
        prompt: basePrompt
      });
    } catch (err: any) {
      console.error("AI Generation Endpoint Error:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Internal server error generating AI cake concept"
      });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
