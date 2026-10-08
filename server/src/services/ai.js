import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generate(params, maxRetries = 4) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent({
        model: process.env.GEMINI_MODEL,
        ...params,
      });
    } catch (err) {
      const retryable = err.status === 503 || err.status === 429;
      if (!retryable || attempt === maxRetries) throw err;
      const waitMs = 2000 * 2 ** attempt;
      console.log(`Got ${err.status}, retrying in ${waitMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}