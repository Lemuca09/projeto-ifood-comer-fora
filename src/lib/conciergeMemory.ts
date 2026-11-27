import type { DiscoveryResult } from "@/domain/types";

/**
 * Cache em memória do processo do browser.
 * Sobrevive à troca de abas (client navigation); zera no reload da página.
 */
type ConciergeMemory = {
  userId: string;
  query: string;
  result: DiscoveryResult;
};

let memory: ConciergeMemory | null = null;

export function readConciergeMemory(userId: string): ConciergeMemory | null {
  if (!memory || memory.userId !== userId) return null;
  return memory;
}

export function writeConciergeMemory(
  userId: string,
  query: string,
  result: DiscoveryResult,
): void {
  memory = { userId, query, result };
}

export function clearConciergeMemory(): void {
  memory = null;
}
