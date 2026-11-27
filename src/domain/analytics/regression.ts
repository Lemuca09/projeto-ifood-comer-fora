import { mean, std } from "@/domain/analytics/math";

export type RegressionResult = {
  featureNames: string[];
  betas: number[]; // padronizados
  pValues: number[]; // aproximados
  r2: number;
};

/** Regressão linear múltipla via equações normais (mínimos quadrados). */
export function multipleRegression(
  X: number[][],
  y: number[],
  featureNames: string[],
): RegressionResult {
  const n = X.length;
  const p = featureNames.length;
  if (!n || !p) {
    return { featureNames, betas: [], pValues: [], r2: 0 };
  }

  // padroniza X e y para betas comparáveis
  const xMeans = Array.from({ length: p }, (_, j) => mean(X.map((r) => r[j])));
  const xStds = Array.from({ length: p }, (_, j) => std(X.map((r) => r[j])));
  const yMean = mean(y);
  const yStd = std(y) || 1;

  const Z = X.map((row) => row.map((v, j) => (v - xMeans[j]) / (xStds[j] || 1)));
  const yz = y.map((v) => (v - yMean) / yStd);

  // (Z'Z) β = Z'y  — Gauss-Jordan
  const xtx: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  const xty: number[] = Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      xty[a] += Z[i][a] * yz[i];
      for (let b = 0; b < p; b++) xtx[a][b] += Z[i][a] * Z[i][b];
    }
  }
  // regularização leve
  for (let a = 0; a < p; a++) xtx[a][a] += 1e-6;

  const betas = solveLinear(xtx, xty);

  const yHat = Z.map((row) => row.reduce((s, v, j) => s + v * betas[j], 0));
  const ssTot = yz.reduce((s, v) => s + v * v, 0) || 1;
  const ssRes = yz.reduce((s, v, i) => s + (v - yHat[i]) ** 2, 0);
  const r2 = Math.max(0, 1 - ssRes / ssTot);

  // p-valor aproximado via |beta| / se (se ~ sqrt((1-r2)/(n-p)))
  const se = Math.sqrt(Math.max(ssRes / Math.max(n - p, 1), 1e-8));
  const pValues = betas.map((b) => {
    const t = Math.abs(b) / (se || 1);
    // aproximação sigmoidal de cauda
    return Number(Math.max(0.001, Math.min(0.999, Math.exp(-1.2 * t))).toFixed(3));
  });

  return { featureNames, betas, pValues, r2: Number(r2.toFixed(3)) };
}

function solveLinear(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    [M[col], M[piv]] = [M[piv], M[col]];
    const div = M[col][col] || 1e-12;
    for (let j = col; j <= n; j++) M[col][j] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map((row) => row[n]);
}
