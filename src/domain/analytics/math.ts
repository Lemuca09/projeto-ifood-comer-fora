/** Utilitários numéricos puros (sem libs ML). */

export function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function std(xs: number[]): number {
  if (xs.length < 2) return 1;
  const m = mean(xs);
  const v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v) || 1;
}

export function standardize(matrix: number[][]): { data: number[][]; means: number[]; stds: number[] } {
  const cols = matrix[0]?.length ?? 0;
  const means: number[] = [];
  const stds: number[] = [];
  for (let j = 0; j < cols; j++) {
    const col = matrix.map((r) => r[j]);
    means.push(mean(col));
    stds.push(std(col));
  }
  const data = matrix.map((row) =>
    row.map((v, j) => (v - means[j]) / stds[j]),
  );
  return { data, means, stds };
}

export function mulVec(mat: number[][], vec: number[]): number[] {
  return mat.map((row) => row.reduce((a, v, i) => a + v * vec[i], 0));
}

export function transpose(m: number[][]): number[][] {
  if (!m.length) return [];
  return m[0].map((_, j) => m.map((row) => row[j]));
}

/** Power iteration para autovetor dominante. */
export function powerIteration(cov: number[][], iters = 40): number[] {
  const n = cov.length;
  let v = Array.from({ length: n }, () => 1 / Math.sqrt(n));
  for (let t = 0; t < iters; t++) {
    const w = mulVec(cov, v);
    const norm = Math.sqrt(w.reduce((a, x) => a + x * x, 0)) || 1;
    v = w.map((x) => x / norm);
  }
  return v;
}

export function covariance(standardized: number[][]): number[][] {
  const n = standardized.length;
  const d = standardized[0]?.length ?? 0;
  const cov: number[][] = Array.from({ length: d }, () => Array(d).fill(0));
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += standardized[k][i] * standardized[k][j];
      cov[i][j] = s / Math.max(n - 1, 1);
    }
  }
  return cov;
}

export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
