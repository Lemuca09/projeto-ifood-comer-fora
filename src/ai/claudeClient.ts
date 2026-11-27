import Anthropic from "@anthropic-ai/sdk";
import { getServerEnv } from "@/lib/env";
import { ABUSE_LIMITS } from "@/guardrails/config";
import { CLAUDE_MODEL_FAST } from "@/ai/model";
import {
  llmCacheKey,
  getLlmCache,
  setLlmCache,
  withLlmThrottle,
} from "@/ai/llmGate";

const DEFAULT_SYSTEM =
  "JSON only. No markdown, no prose outside the object/array.";

let lastFailReason: string | null = null;

/** Motivo da última falha Claude (consome ao ler). */
export function consumeClaudeFailReason(): string | null {
  const r = lastFailReason;
  lastFailReason = null;
  return r;
}

function classifyClaudeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("credit balance") || lower.includes("too low")) {
    return "claude_credits";
  }
  if (
    lower.includes("authentication") ||
    lower.includes("invalid x-api-key") ||
    lower.includes("401")
  ) {
    return "claude_auth";
  }
  if (lower.includes("timeout")) return "claude_timeout";
  return "claude_empty_or_auth";
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
}

/** Extrai JSON de resposta (remove fences se houver). */
export function unwrapJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const objStart = trimmed.indexOf("{");
  const arrStart = trimmed.indexOf("[");
  const start =
    objStart < 0
      ? arrStart
      : arrStart < 0
        ? objStart
        : Math.min(objStart, arrStart);
  if (start < 0) return trimmed;
  const open = trimmed[start];
  const close = open === "[" ? "]" : "}";
  const end = trimmed.lastIndexOf(close);
  if (end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

/**
 * Chamada Claude com cache + throttle.
 * Default: modelo fast (Haiku) + teto baixo de output.
 */
export async function callClaudeText(params: {
  system?: string;
  user: string;
  cacheParts: unknown[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}): Promise<string | null> {
  const env = getServerEnv();
  if (!env.AI_ENABLED || !env.API_KEY_CLAUDE) {
    lastFailReason = "ai_disabled";
    return null;
  }

  // Anthropic: sk-ant-usr-… (ou sk-ant-api…). Ask-ant- / Gemini → 401.
  if (
    process.env.NODE_ENV !== "production" &&
    !env.API_KEY_CLAUDE.startsWith("sk-ant-")
  ) {
    console.error(
      "[claude] API_KEY_CLAUDE inválida: use uma chave sk-ant-usr-… (console.anthropic.com)",
    );
  }

  const model = params.model ?? CLAUDE_MODEL_FAST;
  const maxTokens = Math.min(
    params.maxTokens ?? ABUSE_LIMITS.maxOutputTokensAnalytics,
    ABUSE_LIMITS.maxOutputTokens,
  );

  const key = llmCacheKey([model, maxTokens, ...params.cacheParts]);
  const cached = getLlmCache(key);
  if (cached) return cached;

  const text = await withLlmThrottle(async () => {
    try {
      const client = new Anthropic({ apiKey: env.API_KEY_CLAUDE! });
      const result = await Promise.race([
        client.messages.create({
          model,
          max_tokens: maxTokens,
          temperature: params.temperature ?? 0.2,
          system: params.system ?? DEFAULT_SYSTEM,
          messages: [{ role: "user", content: params.user }],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("timeout")),
            ABUSE_LIMITS.timeoutMs,
          ),
        ),
      ]);
      const raw = extractText(result.content);
      return raw ? unwrapJsonText(raw) : null;
    } catch (err) {
      lastFailReason = classifyClaudeError(err);
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "[claude]",
          lastFailReason,
          err instanceof Error ? err.message : err,
        );
      }
      return null;
    }
  });

  if (text) {
    lastFailReason = null;
    setLlmCache(key, text);
  } else if (!lastFailReason) {
    lastFailReason = "claude_empty_or_auth";
  }
  return text;
}
