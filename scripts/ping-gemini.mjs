import { GoogleGenerativeAI } from "@google/generative-ai";

const modelName = process.env.GEMINI_MODEL_OVERRIDE ?? "gemini-3-flash-preview";
const key = process.env.API_KEY_GEMINI;
console.log("model=", modelName);
console.log("AI_ENABLED=", process.env.AI_ENABLED);
if (!key) {
  console.log("MISSING_KEY");
  process.exitCode = 2;
} else {
  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 64,
        temperature: 0.1,
      },
    });
    const result = await model.generateContent('Responda somente JSON {"ok":true}');
    console.log("GEMINI_OK", JSON.stringify(String(result.response.text()).slice(0, 200)));
    process.exitCode = 0;
  } catch (e) {
    console.log("GEMINI_FAIL", e instanceof Error ? e.message.slice(0, 300) : e);
    process.exitCode = 1;
  }
}
