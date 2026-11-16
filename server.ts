import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded Gemini Client helper to prevent startup crash if API key is missing
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Please add it to Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// 1. Anti-scam API endpoint
app.post("/api/gemini/anti-scam", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Texte manquant" });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Analyse le message suspect suivant envoyé à un senior. Évalue s'il s'agit d'une arnaque, d'un SMS de phishing ou d'un e-mail frauduleux. Reste chaleureux, rassurant et pédagogue dans ton explication. Évite tout jargon complexe.
      
Message à analyser : "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isScam: { type: Type.BOOLEAN, description: "True s'il s'agit d'une arnaque ou d'un message très suspect." },
            level: { 
              type: Type.STRING, 
              enum: ["SÛR", "SUSPECT", "DANGEREUX"], 
              description: "Le niveau de risque du message." 
            },
            explanation: { type: Type.STRING, description: "Explication claire et très simple de pourquoi ce message est suspect ou non. (max 3 phrases)" },
            advice: { type: Type.STRING, description: "Conseil pratique et direct sur ce que l'utilisateur doit faire (ex: ne pas cliquer, supprimer le message)." }
          },
          required: ["isScam", "level", "explanation", "advice"]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText.trim()));
  } catch (error: any) {
    console.error("Error in anti-scam API:", error);
    res.status(500).json({ 
      error: "Impossible d'analyser le message pour le moment.",
      details: error.message 
    });
  }
});

// 2. Prescription OCR Sim / Parser API endpoint
app.post("/api/gemini/ocr-prescription", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Texte ou ordonnance manquante" });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Analyse le texte suivant extrait d'une ordonnance médicale pour en extraire de manière structurée les informations clés. Si certaines informations sont absentes, complète de manière cohérente ou laisse vide.
      
Texte de l'ordonnance : "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            doctor: { type: Type.STRING, description: "Nom du médecin prescripteur (ex: Dr. Martin)." },
            date: { type: Type.STRING, description: "Date de l'ordonnance si trouvée." },
            medications: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  nom: { type: Type.STRING, description: "Nom du médicament (ex: Doliprane)." },
                  dosage: { type: Type.STRING, description: "Dosage (ex: 1000 mg, 1 g)." },
                  frequence: { type: Type.STRING, description: "Fréquence des prises (ex: 3 fois par jour, matin et soir)." },
                  duree: { type: Type.STRING, description: "Durée du traitement (ex: 7 jours, 3 mois)." },
                  stockAlerte: { type: Type.BOOLEAN, description: "Toujours mettre true si c'est un traitement de fond ou régulier nécessitant suivi de stock." }
                },
                required: ["nom", "dosage", "frequence", "duree"]
              }
            }
          },
          required: ["doctor", "medications"]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText.trim()));
  } catch (error: any) {
    console.error("Error in prescription OCR parser:", error);
    res.status(500).json({ 
      error: "Impossible de lire l'ordonnance pour le moment.",
      details: error.message 
    });
  }
});

// 3. Voice Assistant API endpoint
app.post("/api/gemini/voice-assistant", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Requête manquante" });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Tu es Liora, un assistant vocal bienveillant, chaleureux et respectueux de l'autonomie pour les seniors actifs de 55 à 75 ans.
      L'utilisateur te pose une question ou te demande de l'aide. Réponds-lui de manière courte (2-3 phrases maximum), très rassurante et polie, en français.
      N'infantilise jamais l'utilisateur. Valorise toujours sa liberté d'action.
      
      Question : "${query}"`,
    });

    res.json({ responseText: response.text || "Bonjour ! Je suis Liora, votre assistant de sérénité. Comment puis-je vous aider aujourd'hui ?" });
  } catch (error: any) {
    console.error("Error in voice assistant API:", error);
    res.status(500).json({ 
      responseText: "Désolée, je n'ai pas pu analyser votre demande. Je suis toujours à vos côtés si besoin !",
      details: error.message
    });
  }
});

// Serve static build or Vite middleware
async function startServer() {
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
    console.log(`Liora server running on port ${PORT}`);
  });
}

startServer();
