import { ABUSE_LIMITS } from "@/guardrails/config";
import { assertSameOrigin } from "@/guardrails/csrf";

export async function readJsonBody<T = unknown>(
  request: Request,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    return { ok: false, error: origin.error, status: 403 };
  }

  const raw = await request.arrayBuffer();
  if (raw.byteLength > ABUSE_LIMITS.maxBodyBytes) {
    return { ok: false, error: "Corpo excede o limite", status: 413 };
  }

  try {
    const text = new TextDecoder().decode(raw);
    if (!text) return { ok: false, error: "Corpo vazio", status: 400 };
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, error: "JSON inválido", status: 400 };
  }
}
