import Anthropic from "@anthropic-ai/sdk";

const modelName =
  process.env.CLAUDE_MODEL_OVERRIDE ?? "claude-haiku-4-5-20251001";
const key = process.env.API_KEY_CLAUDE;
if (!key) {
  console.error("API_KEY_CLAUDE ausente");
  process.exit(1);
}

try {
  const client = new Anthropic({ apiKey: key });
  const result = await client.messages.create({
    model: modelName,
    max_tokens: 32,
    messages: [{ role: "user", content: 'Reply JSON only: {"ok":true}' }],
  });
  const text = result.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
  console.log("CLAUDE_OK", JSON.stringify(String(text).slice(0, 120)));
} catch (e) {
  console.log(
    "CLAUDE_FAIL",
    e instanceof Error ? e.message.slice(0, 300) : e,
  );
  process.exit(1);
}
