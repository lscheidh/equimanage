
import { GoogleGenAI, Type } from "@google/genai";
import { Horse } from "../types";

export const extractHorseDataFromImage = async (base64Image: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = "Extrahiere alle relevanten Informationen über das Pferd aus diesem Pass-Bild. Wenn ein Feld nicht erkennbar ist, lasse es leer oder verwende null.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            isoNr: { type: Type.STRING },
            feiNr: { type: Type.STRING },
            birthYear: { type: Type.NUMBER },
            breed: { type: Type.STRING },
            chipId: { type: Type.STRING },
            gender: { type: Type.STRING, description: "Hengst, Stute oder Wallach" },
            color: { type: Type.STRING },
            breedingAssociation: { type: Type.STRING },
            weightKg: { type: Type.NUMBER }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Extraction failed:", error);
    return null;
  }
};

export const analyzeHealth = async (horse: Horse) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const dewormingRecords = horse.serviceHistory
    .filter(s => s.type === 'Entwurmung')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const lastDewormingDate = dewormingRecords[0]?.date ?? 'Keine Daten';
  
  const prompt = `
    Analyze the health data for the horse "${horse.name}" (${horse.breed}, born ${horse.birthYear}).
    Vaccinations: ${JSON.stringify(horse.vaccinations)}
    Last deworming (Entwurmung): ${lastDewormingDate}
    
    Provide a professional assessment in German (max 100 words) for the owner. 
    Focus on vaccination compliance and health maintenance and suggest next steps.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return "Error generating analysis. Please consult your veterinarian.";
  }
};
