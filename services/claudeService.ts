
import Anthropic from '@anthropic-ai/sdk';
import { Horse } from "../types";

export const extractHorseDataFromImage = async (base64Image: string) => {
  const client = new Anthropic({ 
    apiKey: process.env.CLAUDE_API_KEY || process.env.API_KEY 
  });
  
  const prompt = "Extrahiere alle relevanten Informationen über das Pferd aus diesem Pass-Bild. Wenn ein Feld nicht erkennbar ist, lasse es leer oder verwende null.";

  try {
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'horse_data',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              isoNr: { type: 'string' },
              feiNr: { type: 'string' },
              birthYear: { type: 'number' },
              breed: { type: 'string' },
              chipId: { type: 'string' },
              gender: { type: 'string', description: 'Hengst, Stute oder Wallach' },
              color: { type: 'string' },
              breedingAssociation: { type: 'string' },
              weightKg: { type: 'number' }
            },
            required: []
          }
        }
      }
    });

    const content = message.content[0];
    if (content.type === 'text') {
      return JSON.parse(content.text);
    }
    return {};
  } catch (error) {
    console.error("AI Extraction failed:", error);
    return null;
  }
};

export const analyzeHealth = async (horse: Horse) => {
  const client = new Anthropic({ 
    apiKey: process.env.CLAUDE_API_KEY || process.env.API_KEY 
  });
  
  const dewormingRecords = horse.serviceHistory
    .filter(s => s.type === 'Entwurmung')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const lastDewormingDate = dewormingRecords[0]?.date ?? 'Keine Daten';
  
  const prompt = `
    Analysiere die Gesundheitsdaten für das Pferd "${horse.name}" (${horse.breed}, geboren ${horse.birthYear}).
    Impfungen: ${JSON.stringify(horse.vaccinations)}
    Letzte Entwurmung: ${lastDewormingDate}
    
    Erstelle eine professionelle Bewertung auf Deutsch (max. 100 Wörter) für den Besitzer. 
    Fokussiere dich auf Impfkonformität und Gesundheitspflege und schlage nächste Schritte vor.
  `;

  try {
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = message.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    return "Fehler bei der Analyse. Bitte konsultieren Sie Ihren Tierarzt.";
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return "Fehler bei der Analyse. Bitte konsultieren Sie Ihren Tierarzt.";
  }
};
