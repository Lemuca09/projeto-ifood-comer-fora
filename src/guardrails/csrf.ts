/** Proteção de origem para rotas que alteram estado (AGENTS §4). */
export function assertSameOrigin(request: Request): { ok: true } | { ok: false; error: string } {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!host) return { ok: false, error: "Host ausente" };

  // Same-origin fetches de páginas same-site enviam Origin; alguns clients só Referer.
  if (origin) {
    try {
      const o = new URL(origin);
      if (o.host !== host) return { ok: false, error: "Origin inválida" };
      return { ok: true };
    } catch {
      return { ok: false, error: "Origin malformada" };
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const r = new URL(referer);
      if (r.host !== host) return { ok: false, error: "Referer inválido" };
      return { ok: true };
    } catch {
      return { ok: false, error: "Referer malformado" };
    }
  }

  // Sem Origin/Referer: bloquear writes (navegadores modernos enviam Origin em POST same-site).
  return { ok: false, error: "Origem não verificável" };
}
