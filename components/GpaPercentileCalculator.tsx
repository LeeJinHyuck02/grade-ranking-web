'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { 
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip 
} from 'recharts';
import { calculatePercentile, generateBellCurveData, PercentileResult, BellCurvePoint } from '@/lib/stats';

export interface UnivRankingItem {
  univ_name: string;
  course_type: string;
  avg_gpa: number;
  max_gpa?: number;
  std_dev_gpa?: number;
  total_students?: number;
}

interface GpaPercentileCalculatorProps {
  univRankings: UnivRankingItem[];
  defaultOpen?: boolean;
}

export function GpaPercentileCalculator({ univRankings, defaultOpen = true }: GpaPercentileCalculatorProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // '전체' 교과목 기준 대학 목록만 추출 (가나다순 정렬)
  const uniqueUnivs = useMemo(() => {
    const list = univRankings.filter((u) => (u.course_type || '').trim() === '전체');
    const sorted = [...list].sort((a, b) => a.univ_name.localeCompare(b.univ_name, 'ko'));
    return sorted;
  }, [univRankings]);

  const [selectedUnivName, setSelectedUnivName] = useState<string>('');
  const [inputGpa, setInputGpa] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<PercentileResult | null>(null);
  const [calculatedGpa, setCalculatedGpa] = useState<number | null>(null);
  
  // 차트 클릭으로 선택된 학점 위치
  const [clickedGpa, setClickedGpa] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    if (uniqueUnivs.length > 0 && !selectedUnivName) {
      const defaultUniv = uniqueUnivs.find((u) => u.univ_name.includes('고려')) || uniqueUnivs[0];
      setSelectedUnivName(defaultUniv.univ_name);
    }
  }, [uniqueUnivs, selectedUnivName]);

  // 30과목(약 90학점) 이상 누적 평점 기준 보정 계수
  // DB에서 1차로 원본 분산에 0.50 반영되었으므로, 프론트에서 0.70을 곱해 최종 알파(alpha) = 0.50 * 0.70 = 0.35 적용
  // (연세대 실측 alpha=0.30과 포스텍 실측 alpha=0.38의 정중앙인 0.35)
  const CUMULATIVE_GPA_SCALE = 0.70;

  // 현재 선택된 대학의 통계
  const currentUniv = useMemo(() => {
    return uniqueUnivs.find((u) => u.univ_name === selectedUnivName) || null;
  }, [uniqueUnivs, selectedUnivName]);

  const maxGpa = currentUniv?.max_gpa || 4.5;
  const avgGpa = currentUniv?.avg_gpa || 3.5;
  const stdDevGpa = Number(((currentUniv?.std_dev_gpa || 0.45) * CUMULATIVE_GPA_SCALE).toFixed(2));

  // 대학 선택 변경 시 기존 결과가 있으면 새 대학 기준으로 자동 재계산
  const handleUnivChange = (newUnivName: string) => {
    setSelectedUnivName(newUnivName);
    setErrorMsg(null);
    setClickedGpa(null);
    const newUniv = uniqueUnivs.find((u) => u.univ_name === newUnivName);
    const newMax = newUniv?.max_gpa || 4.5;
    const newAvg = newUniv?.avg_gpa || 3.5;
    const newStd = Number(((newUniv?.std_dev_gpa || 0.45) * CUMULATIVE_GPA_SCALE).toFixed(2));

    if (calculatedGpa !== null) {
      if (calculatedGpa > newMax) {
        setErrorMsg(`입력된 학점(${calculatedGpa})이 ${newUnivName}의 만점(${newMax})을 초과합니다.`);
        setResult(null);
      } else {
        const res = calculatePercentile(calculatedGpa, newAvg, newStd);
        setResult(res);
      }
    }
  };

  // 백분위 계산 실행 핸들러
  const handleCalculate = () => {
    setErrorMsg(null);
    setClickedGpa(null);
    const trimmed = inputGpa.trim();
    if (!trimmed) {
      setErrorMsg('학점을 입력해 주세요.');
      return;
    }

    const gpaNum = parseFloat(trimmed);
    if (isNaN(gpaNum)) {
      setErrorMsg('올바른 숫자 형식의 학점을 입력해 주세요.');
      return;
    }

    if (gpaNum < 0) {
      setErrorMsg('학점은 0점 이상이어야 합니다.');
      return;
    }

    if (gpaNum > maxGpa) {
      setErrorMsg(`${selectedUnivName}의 만점(${maxGpa}점) 이하로 입력해 주세요.`);
      return;
    }

    const res = calculatePercentile(gpaNum, avgGpa, stdDevGpa);
    setResult(res);
    setCalculatedGpa(gpaNum);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCalculate();
    }
  };

  // 차트 클릭 핸들러
  const handleChartClick = (chartState: any) => {
    if (chartState && chartState.activePayload && chartState.activePayload.length) {
      const gpaValue = chartState.activePayload[0].payload.gpa;
      if (typeof gpaValue === 'number') {
        setClickedGpa(Number(gpaValue.toFixed(2)));
      }
    }
  };

  // 클릭된 지점의 백분위 계산
  const clickedResult = useMemo(() => {
    if (clickedGpa === null) return null;
    return calculatePercentile(clickedGpa, avgGpa, stdDevGpa);
  }, [clickedGpa, avgGpa, stdDevGpa]);

  // 정규분포 차트 데이터 생성
  const chartData: BellCurvePoint[] = useMemo(() => {
    return generateBellCurveData(avgGpa, stdDevGpa, maxGpa, 40);
  }, [avgGpa, stdDevGpa, maxGpa]);

  const isDark = mounted && resolvedTheme === 'dark';
  const chartAxisColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div
      style={{
        backgroundColor: 'var(--card-bg)',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        padding: '14px 18px',
        boxShadow: isOpen
          ? '0 2px 10px -2px rgba(0, 0, 0, 0.05)'
          : '0 2px 6px -1px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        width: '100%',
        marginBottom: '0',
        transition: 'box-shadow 0.25s ease, border-color 0.2s ease'
      }}
    >
      {/* input number의 스피너(상하 화살표) 완전 제거 및 호버 스타일 */}
      <style>{`
        .no-spin-arrows::-webkit-inner-spin-button,
        .no-spin-arrows::-webkit-outer-spin-button {
          -webkit-appearance: none !important;
          margin: 0 !important;
        }
        .no-spin-arrows {
          -moz-appearance: textfield !important;
        }
        .calc-header-btn:hover .calc-toggle-pill {
          background-color: var(--card-hover) !important;
          border-color: var(--accent-blue) !important;
          color: var(--accent-blue) !important;
        }
        .calc-header-btn:hover .calc-icon-box {
          transform: scale(1.06);
        }
      `}</style>

      {/* 1. 세련된 아코디언 토글 헤더 */}
      {/* 1. 세련된 아코디언 토글 헤더 (토글 버튼을 제목 바로 옆에 자연스럽게 배치) */}
      <div
        className="calc-header-btn"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          userSelect: 'none',
          width: 'fit-content'
        }}
      >
        <div
          className="calc-icon-box"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: isDark ? 'rgba(96, 165, 250, 0.15)' : 'rgba(37, 99, 235, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            flexShrink: 0,
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          🎯
        </div>
        <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap' }}>
          학점 백분위 변환기
        </h2>

        {/* 토글 화살표 버튼: 제목 바로 옆에 일체형으로 배치 */}
        <div
          className="calc-toggle-pill"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '26px',
            height: '26px',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--table-header-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            transition: 'all 0.2s ease',
            marginLeft: '2px',
            flexShrink: 0
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {/* 2. 부드러운 CSS Grid 아코디언 애니메이션 컨테이너 */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease',
          opacity: isOpen ? 1 : 0
        }}
      >
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '14px 0 16px 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* 2. 대학교 선택 / 취득 학점 / 백분위 확인 버튼 1행 정렬 (학교 옆 만점 문구 삭제) */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
          width: '100%',
          flexWrap: 'nowrap'
        }}
      >
        {/* 대학교 선택 (만점 문구 삭제, 순수 학교명만 노출) */}
        <div style={{ flex: '1.4', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
            대학교 선택
          </label>
          <select
            value={selectedUnivName}
            onChange={(e) => handleUnivChange(e.target.value)}
            style={{
              height: '36px',
              padding: '0 10px',
              fontSize: '13px',
              borderRadius: '7px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--table-header-bg)',
              color: 'var(--text-primary)',
              outline: 'none',
              cursor: 'pointer',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            {uniqueUnivs.map((u) => (
              <option key={u.univ_name} value={u.univ_name}>
                {u.univ_name}
              </option>
            ))}
          </select>
        </div>

        {/* 내 학점 입력 (최대 학점 표시) */}
        <div style={{ flex: '1', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
            취득 학점 ({maxGpa} 만점)
          </label>
          <input
            type="number"
            className="no-spin-arrows"
            step="0.01"
            min="0"
            max={maxGpa}
            placeholder={`예: ${(maxGpa * 0.88).toFixed(2)}`}
            value={inputGpa}
            onChange={(e) => setInputGpa(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              height: '36px',
              padding: '0 10px',
              fontSize: '13px',
              borderRadius: '7px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--table-header-bg)',
              color: 'var(--text-primary)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* 백분위 확인 버튼 */}
        <div style={{ flexShrink: 0 }}>
          <button
            onClick={handleCalculate}
            style={{
              height: '36px',
              padding: '0 14px',
              backgroundColor: 'var(--accent-blue)',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '13px',
              borderRadius: '7px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 4px rgba(59, 130, 246, 0.25)',
              transition: 'opacity 0.15s ease'
            }}
          >
            <span>확인</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {errorMsg && (
        <div
          style={{
            padding: '7px 10px',
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
            border: '1px solid #f87171',
            borderRadius: '6px',
            color: isDark ? '#fca5a5' : '#b91c1c',
            fontSize: '12px',
            fontWeight: '500'
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {/* 3. 분석 결과 카드 & 인터랙티브 시각화 영역 */}
      {result && calculatedGpa !== null && currentUniv && (
        <div
          style={{
            backgroundColor: 'var(--table-header-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '9px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {/* 상단 핵심 결과: 상위 %와 함께 [평균 + 표준편차]를 한 행에 일렬 출력 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '16px',
              flexWrap: 'wrap'
            }}
          >
            <span
              style={{
                fontSize: '26px',
                fontWeight: '800',
                color: 'var(--accent-blue)',
                letterSpacing: '-0.5px'
              }}
            >
              상위 {result.formattedPercentile}
            </span>

            {/* 평균과 표준편차를 한 행에 깔끔하게 배치 */}
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>
                평균 {avgGpa.toFixed(2)}{' '}
                <span
                  style={{
                    fontWeight: '700',
                    color: result.diffFromMean >= 0 ? 'var(--accent-green)' : 'var(--accent-blue)'
                  }}
                >
                  ({result.diffFromMean >= 0 ? `+${result.diffFromMean}` : result.diffFromMean}점)
                </span>
              </span>
              <span style={{ opacity: 0.4 }}>|</span>
              <span>표준편차 ±{stdDevGpa.toFixed(2)}</span>
            </div>
          </div>

          {/* 그래프 영역 (분포곡선 텍스트 삭제, 클릭 시 선택 피드백만 간결하게 표시) */}
          <div>
            {clickedGpa !== null && clickedResult && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  marginBottom: '4px',
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#eff6ff',
                  border: '1px solid var(--accent-blue)',
                  borderRadius: '5px',
                  fontSize: '11px'
                }}
              >
                <span>
                  선택: <strong style={{ color: 'var(--text-primary)' }}>{clickedGpa.toFixed(2)}점</strong>
                  <span style={{ margin: '0 4px', opacity: 0.4 }}>|</span>
                  예상: <strong style={{ color: 'var(--accent-blue)' }}>상위 {clickedResult.formattedPercentile}</strong>
                </span>
                <button
                  onClick={() => setClickedGpa(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '10px',
                    padding: '0 2px'
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* 정규분포 차트 */}
            <div style={{ width: '100%', height: '135px', cursor: 'crosshair' }}>
              <ResponsiveContainer width="100%" height={135}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 16, right: 10, left: 10, bottom: 0 }}
                  onClick={handleChartClick}
                >
                  <defs>
                    <linearGradient id="bellCurveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="gpa"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tick={{ fontSize: 10, fill: chartAxisColor }}
                    stroke={chartAxisColor}
                    tickFormatter={(v) => v.toFixed(1)}
                  />
                  <YAxis hide domain={[0, 'auto']} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload as BellCurvePoint;
                        const hoveredPercentile = calculatePercentile(data.gpa, avgGpa, stdDevGpa);
                        return (
                          <div
                            style={{
                              backgroundColor: 'var(--card-bg)',
                              padding: '5px 9px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              fontSize: '11px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                            }}
                          >
                            <p style={{ margin: 0, fontWeight: '700', color: 'var(--text-primary)' }}>
                              학점 {data.gpa.toFixed(2)}점
                            </p>
                            <p style={{ margin: '1px 0 0 0', fontWeight: '600', color: 'var(--accent-blue)' }}>
                              상위 {hoveredPercentile.formattedPercentile}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="density"
                    stroke="var(--accent-blue)"
                    strokeWidth={2}
                    fill="url(#bellCurveGradient)"
                    isAnimationActive={false}
                  />

                  {/* 내 학점 위치 수직 점선 */}
                  <ReferenceLine
                    x={calculatedGpa}
                    stroke="var(--accent-green)"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    label={{
                      value: `${calculatedGpa.toFixed(2)}점`,
                      position: 'top',
                      fill: 'var(--accent-green)',
                      fontSize: 10,
                      fontWeight: 700
                    }}
                  />

                  {/* 클릭한 지점 수직 점선 */}
                  {clickedGpa !== null && clickedGpa !== calculatedGpa && (
                    <ReferenceLine
                      x={clickedGpa}
                      stroke="var(--accent-blue)"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      label={{
                        value: `${clickedGpa.toFixed(2)}점`,
                        position: 'top',
                        fill: 'var(--accent-blue)',
                        fontSize: 10,
                        fontWeight: 700
                      }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 하단 링크 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              borderTop: '1px dashed var(--border-color)',
              paddingTop: '6px'
            }}
          >
            <button
              onClick={() => router.push(`/universities/${encodeURIComponent(selectedUnivName)}`)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-blue)',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
            >
              <span>{selectedUnivName} 분석 리포트 보기</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}
          </div>
        </div>
      </div>
    </div>
  );
}
