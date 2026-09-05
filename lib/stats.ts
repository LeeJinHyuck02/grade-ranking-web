/**
 * 오차 함수 (Error Function, erf) 근사 계산
 * Abramowitz and Stegun 7.1.26 수치 근사 공식 (최대 오차 < 1.5e-7)
 */
export function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * 정규분포 누적분포함수 (Cumulative Distribution Function, CDF)
 * P(X <= x) 확률 (0 ~ 1) 반환
 */
export function normalCDF(x: number, mean: number, stdDev: number): number {
  if (stdDev <= 0) return x >= mean ? 1 : 0;
  const z = (x - mean) / (stdDev * Math.SQRT2);
  return 0.5 * (1 + erf(z));
}

/**
 * 정규분포 확률밀도함수 (Probability Density Function, PDF)
 */
export function normalPDF(x: number, mean: number, stdDev: number): number {
  if (stdDev <= 0) return 0;
  const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
  return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
}

export interface PercentileResult {
  topPercentile: number;       // 상위 % (예: 8.4)
  formattedPercentile: string; // 문자열 표시 (예: "8.4%")
  zScore: number;              // Z-Score
  diffFromMean: number;        // 평균과의 차이 (예: +0.32)
  gradeTier: string;           // 티어 문구 (예: "상위 10% 이내 (최상위권)")
}

/**
 * 특정 학점의 해당 대학교 내 상위 백분위 산출
 * @param gpa 사용자가 입력한 학점
 * @param mean 해당 대학교 학점 평균
 * @param stdDev 해당 대학교 학점 표준편차 (보정값)
 */
export function calculatePercentile(gpa: number, mean: number, stdDev: number): PercentileResult {
  const zScore = stdDev > 0 ? (gpa - mean) / stdDev : 0;
  const cdf = normalCDF(gpa, mean, stdDev);
  
  // 상위 백분위는 1 - CDF
  let topPercentile = (1 - cdf) * 100;
  topPercentile = Math.max(0.01, Math.min(99.99, Number(topPercentile.toFixed(1))));

  let formattedPercentile = `${topPercentile.toFixed(1)}%`;
  if (topPercentile <= 0.1) formattedPercentile = '상위 0.1% 이내';
  else if (topPercentile >= 99.9) formattedPercentile = '하위 0.1% 이내';

  const diffFromMean = Number((gpa - mean).toFixed(2));

  let gradeTier = '보통';
  if (topPercentile <= 1.0) gradeTier = '수석급 극상위권 🏆';
  else if (topPercentile <= 5.0) gradeTier = '최상위권 (상위 5% 이내) 🌟';
  else if (topPercentile <= 10.0) gradeTier = '상위 10% 이내 (우수) 🎉';
  else if (topPercentile <= 25.0) gradeTier = '상위 25% 이내 (준우수) 👍';
  else if (topPercentile <= 50.0) gradeTier = '평균 이상 (상위 50% 이내)';
  else gradeTier = '평균 이하';

  return {
    topPercentile,
    formattedPercentile,
    zScore: Number(zScore.toFixed(2)),
    diffFromMean,
    gradeTier
  };
}

export interface BellCurvePoint {
  gpa: number;
  density: number;
}

/**
 * Recharts 시각화용 정규분포 벨 커브(Bell Curve) 데이터 생성
 */
export function generateBellCurveData(
  mean: number,
  stdDev: number,
  maxGpa: number,
  pointsCount: number = 35
): BellCurvePoint[] {
  if (stdDev <= 0) return [];

  // 그래프의 X축 범위: mean - 3.2*stdDev ~ min(mean + 3.2*stdDev, maxGpa)
  const minRange = Math.max(1.5, Number((mean - 3.0 * stdDev).toFixed(2)));
  const maxRange = Math.min(maxGpa, Number((mean + 3.0 * stdDev).toFixed(2)));
  const step = (maxRange - minRange) / (pointsCount - 1);

  const points: BellCurvePoint[] = [];

  for (let i = 0; i < pointsCount; i++) {
    const currentGpa = Number((minRange + i * step).toFixed(2));
    const density = Number(normalPDF(currentGpa, mean, stdDev).toFixed(4));
    points.push({
      gpa: currentGpa,
      density
    });
  }

  return points;
}

