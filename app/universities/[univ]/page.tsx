'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabase';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend
} from 'recharts';

interface UnivRankingRow {
  univ_name: string;
  course_type: string;
  total_depts: number;
  total_students: number;
  avg_gpa: number;
  a_students: number;
  a_grade_ratio: number;
}

interface DeptRanking {
  dept_name: string;
  college_name: string;
  avg_gpa: number;
  total_students: number;
  a_grade_ratio: number;
}

interface GradeRow {
  year?: number;
  semester: string;
  grade: string;
  grade_point?: number | null;
  student_count: number;
}

interface GradeDist {
  grade: string;
  student_count: number;
  ratio: string;
}

const GRADE_ORDER = ['A+', 'A0', 'A-', 'B+', 'B0', 'B-', 'C+', 'C0', 'C-', 'D+', 'D0', 'D-', 'F', 'P'];

const getSemesterWeight = (semStr: string): number => {
  if (semStr.includes('1학기')) return 1;
  if (semStr.includes('여름')) return 2;
  if (semStr.includes('2학기')) return 3;
  if (semStr.includes('겨울')) return 4;
  return 5;
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        backgroundColor: 'var(--card-bg)',
        padding: '12px 16px',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
      }}>
        <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
          {label} 등급
        </p>
        <p style={{ margin: '0 0 2px 0', fontSize: '13px', color: 'var(--accent-blue)', fontWeight: '600' }}>
          인원: {data.student_count?.toLocaleString()}명
        </p>
        {data.ratio && (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--accent-green)', fontWeight: '600' }}>
            비율: {data.ratio}%
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function UniversityDetailPage() {
  const params = useParams();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState<boolean>(false);

  const rawUniv = typeof params.univ === 'string' ? params.univ : '';
  const univName = decodeURIComponent(rawUniv).trim();

  const [courseFilter, setCourseFilter] = useState<'전체' | '전공' | '교양'>('전체');
  
  const [univSummaries, setUnivSummaries] = useState<UnivRankingRow[]>([]);
  const [deptRankings, setDeptRankings] = useState<DeptRanking[]>([]);
  const [rawMajorGrades, setRawMajorGrades] = useState<GradeRow[]>([]);
  const [rawGeneralGrades, setRawGeneralGrades] = useState<GradeRow[]>([]);
  
  const [sortBy, setSortBy] = useState<'avg_gpa' | 'a_grade_ratio'>('avg_gpa');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. 대학교 데이터 일괄 호출
  useEffect(() => {
    async function fetchUnivData() {
      if (!univName) return;
      setLoading(true);

      const { data: summaryData } = await supabase
        .from('university_rankings')
        .select('*')
        .eq('univ_name', univName);

      if (summaryData) {
        setUnivSummaries(summaryData);
      }

      const { data: deptsData } = await supabase
        .from('major_rankings')
        .select('dept_name, college_name, avg_gpa, total_students, a_grade_ratio')
        .eq('univ_name', univName);

      if (deptsData) {
        setDeptRankings(deptsData);
      }

      const [majorRes, generalRes] = await Promise.all([
        supabase
          .from('grade_distribution')
          .select('semester, grade, grade_point, student_count')
          .eq('univ_name', univName),
        supabase
          .from('general_grade_distribution')
          .select('year, semester, grade, grade_point, student_count')
          .eq('univ_name', univName)
      ]);

      if (majorRes.data) setRawMajorGrades(majorRes.data);
      if (generalRes.data) setRawGeneralGrades(generalRes.data);

      setLoading(false);
    }
    fetchUnivData();
  }, [univName]);

  // 2. 현재 선택된 교과 구분에 맞는 요약 카드 통계 추출
  const currentSummary = useMemo(() => {
    return univSummaries.find((s) => s.course_type.trim() === courseFilter) || null;
  }, [univSummaries, courseFilter]);

  // 3. 선택된 교과 구분에 따른 좌측 등급 분포 차트 데이터 가공
  const gradeDistData: GradeDist[] = useMemo(() => {
    let targetList: GradeRow[] = [];

    if (courseFilter === '전체') {
      targetList = [...rawMajorGrades, ...rawGeneralGrades];
    } else if (courseFilter === '전공') {
      targetList = rawMajorGrades;
    } else {
      targetList = rawGeneralGrades;
    }

    const total = targetList.reduce((acc, cur) => acc + (cur.student_count || 0), 0);
    const map: { [key: string]: number } = {};

    targetList.forEach((row) => {
      const g = row.grade ? row.grade.trim() : '';
      if (g) map[g] = (map[g] || 0) + row.student_count;
    });

    return GRADE_ORDER
      .filter((g) => map[g] !== undefined)
      .map((g) => ({
        grade: g,
        student_count: map[g],
        ratio: total > 0 ? ((map[g] / total) * 100).toFixed(1) : '0.0',
      }));
  }, [rawMajorGrades, rawGeneralGrades, courseFilter]);

  // 4. 교양 전용 학기별 데이터 집계 및 정밀 시계열 정렬
  const generalSemesterChartData = useMemo(() => {
    const semesterMap: { [key: string]: { year: number; semName: string; totalWeighted: number; totalCount: number; aCount: number } } = {};

    rawGeneralGrades.forEach((row) => {
      const rawSem = row.semester ? row.semester.trim() : '기타';
      const yr = row.year || 2025;
      const label = `${yr}년 ${rawSem}`;

      if (!semesterMap[label]) {
        semesterMap[label] = { year: yr, semName: rawSem, totalWeighted: 0, totalCount: 0, aCount: 0 };
      }

      const count = row.student_count || 0;
      const gp = row.grade_point !== null && row.grade_point !== undefined ? row.grade_point : 0;

      semesterMap[label].totalWeighted += gp * count;
      semesterMap[label].totalCount += count;

      if (['A+', 'A0', 'A-'].includes((row.grade || '').trim())) {
        semesterMap[label].aCount += count;
      }
    });

    return Object.keys(semesterMap)
      .map((key) => {
        const item = semesterMap[key];
        const gpa = item.totalCount > 0 ? parseFloat((item.totalWeighted / item.totalCount).toFixed(2)) : 0;
        const aRatio = item.totalCount > 0 ? parseFloat(((item.aCount / item.totalCount) * 100).toFixed(1)) : 0;

        return {
          semester: key,
          year: item.year,
          semName: item.semName,
          avg_gpa: gpa,
          a_grade_ratio: aRatio,
          student_count: item.totalCount
        };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return getSemesterWeight(a.semName) - getSemesterWeight(b.semName);
      });
  }, [rawGeneralGrades]);

  // 5. 상위 10개 학과 차트 데이터 (정렬 기준 적용)
  const topDeptsChartData = useMemo(() => {
    const sorted = [...deptRankings].sort((a, b) => {
      if (sortBy === 'avg_gpa') {
        return (b.avg_gpa || 0) - (a.avg_gpa || 0);
      } else {
        return (b.a_grade_ratio || 0) - (a.a_grade_ratio || 0);
      }
    });

    return sorted.slice(0, 10).map((d) => ({
      dept_name: d.dept_name,
      chart_value: sortBy === 'avg_gpa' ? d.avg_gpa : (d.a_grade_ratio || 0),
    }));
  }, [deptRankings, sortBy]);

  const isDark = mounted && resolvedTheme === 'dark';
  const chartGridColor = isDark ? '#334155' : '#f3f4f6';
  const chartAxisColor = isDark ? '#94a3b8' : '#4b5563';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', padding: '32px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>대학교 데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', padding: '40px 20px', transition: 'background-color 0.2s' }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* 상단 네비게이션 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
              {univName} 종합 학점 분석 리포트
            </h1>
          </div>
          <ThemeToggle />
        </div>

        {/* 교과목 구분 선택 탭 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--border-color)', padding: '4px', borderRadius: '8px' }}>
            {(['전체', '전공', '교양'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setCourseFilter(type)}
                style={{
                  padding: '8px 18px',
                  fontSize: '14px',
                  fontWeight: '600',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: courseFilter === type ? 'var(--card-bg)' : 'transparent',
                  color: courseFilter === type ? 'var(--accent-blue)' : 'var(--text-muted)',
                  boxShadow: courseFilter === type ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {type === '전체' ? '전체(전공+교양)' : `${type} 과목`}
              </button>
            ))}
          </div>

          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            분석 대상: <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{courseFilter === '전체' ? '전교 전체 교과목' : `${courseFilter} 교과목`}</span>
          </div>
        </div>

        {/* 핵심 KPI 요약 카드 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 8px 0', fontWeight: '500' }}>
              {courseFilter} 평균 평점
            </p>
            <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--accent-blue)', margin: 0 }}>
              {currentSummary ? currentSummary.avg_gpa.toFixed(2) : '0.00'} <span style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ 4.3</span>
            </p>
          </div>
          <div style={{ backgroundColor: 'var(--card-bg)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 8px 0', fontWeight: '500' }}>
              {courseFilter} A학점 비율
            </p>
            <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--accent-green)', margin: 0 }}>
              {currentSummary && currentSummary.a_grade_ratio !== null ? `${currentSummary.a_grade_ratio.toFixed(1)}%` : '0.0%'}
            </p>
          </div>
          <div style={{ backgroundColor: 'var(--card-bg)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 8px 0', fontWeight: '500' }}>개설 학과 수</p>
            <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
              {courseFilter === '교양' ? '-' : `${currentSummary ? currentSummary.total_depts : 0}개`}
            </p>
          </div>
          <div style={{ backgroundColor: 'var(--card-bg)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 8px 0', fontWeight: '500' }}>
              {courseFilter} 수강 학생 수
            </p>
            <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
              {currentSummary ? currentSummary.total_students.toLocaleString() : 0}명
            </p>
          </div>
        </div>

        {/* 시각화 차트 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
          
          {/* 좌측 차트: 등급 분포 막대 차트 */}
          <div style={{ backgroundColor: 'var(--card-bg)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                {courseFilter} 성적 등급 분포
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>* 마우스 오버 시 비율 확인</span>
            </div>
            <div style={{ width: '100%', height: '320px' }}>
              {gradeDistData.length === 0 ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  해당 교과목 데이터가 존재하지 않습니다.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={gradeDistData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                    <XAxis dataKey="grade" stroke={chartAxisColor} />
                    <YAxis stroke={chartAxisColor} />
                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: isDark ? '#334155' : '#f3f4f6' }} />
                    <Bar dataKey="student_count" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 우측 차트: 교양 선택 시 [학기별 교양 평점 추이] / 그 외 [상위 10개 학과 차트 (x축 시작점 2.0)] */}
          <div style={{ backgroundColor: 'var(--card-bg)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {courseFilter === '교양' ? (
              /* ================= 1. 교양 과목: 학기별 교양 평점 추이 꺾은선 차트 ================= */
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                    학기별 교양 평균 평점 및 추이
                  </h2>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>* 학기별 시계열 분석</span>
                </div>
                <div style={{ width: '100%', height: '320px' }}>
                  {generalSemesterChartData.length === 0 ? (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      학기별 교양 데이터가 존재하지 않습니다.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart 
                        data={generalSemesterChartData} 
                        margin={{ top: 15, right: 25, left: -10, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                        <XAxis 
                          dataKey="semester" 
                          stroke={chartAxisColor}
                          interval={0}
                          tick={{ fontSize: 11, fill: chartAxisColor }}
                          tickLine={false}
                          dy={8}
                        />
                        <YAxis 
                          yAxisId="left" 
                          domain={[2.5, 4.3]} 
                          ticks={[2.5, 3.0, 3.5, 4.0, 4.3]}
                          stroke={chartAxisColor}
                          tick={{ fontSize: 12, fill: chartAxisColor }}
                          tickFormatter={(v) => v.toFixed(1)}
                          width={40}
                        />
                        <YAxis 
                          yAxisId="right" 
                          orientation="right" 
                          domain={[0, 100]} 
                          ticks={[0, 25, 50, 75, 100]}
                          stroke={chartAxisColor} 
                          unit="%" 
                          tick={{ fontSize: 12, fill: chartAxisColor }}
                          width={45}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--card-bg)',
                            borderColor: 'var(--border-color)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                          }}
                          formatter={(value: any, name: any) => [
                            name === 'avg_gpa' ? `${value} / 4.3` : `${value}%`,
                            name === 'avg_gpa' ? '평균 평점' : 'A학점 비율'
                          ]}
                        />
                        <Legend
                          verticalAlign="bottom"
                          wrapperStyle={{ paddingTop: '10px' }}
                          formatter={(value) => (value === 'avg_gpa' ? '평균 평점' : 'A학점 비율')}
                        />
                        <Line 
                          yAxisId="left" 
                          type="monotone" 
                          dataKey="avg_gpa" 
                          stroke="var(--accent-blue)" 
                          strokeWidth={3} 
                          dot={{ r: 5, fill: 'var(--accent-blue)', strokeWidth: 2, stroke: '#ffffff' }} 
                          activeDot={{ r: 7 }}
                        />
                        <Line 
                          yAxisId="right" 
                          type="monotone" 
                          dataKey="a_grade_ratio" 
                          stroke="var(--accent-green)" 
                          strokeWidth={2} 
                          strokeDasharray="4 4" 
                          dot={{ r: 4, fill: 'var(--accent-green)' }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </>
            ) : (
              /* ================= 2. 전공/전체 과목: 상위 10개 학과 가로 바 차트 (x축 시작점 2.0 적용) ================= */
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                    {sortBy === 'avg_gpa' ? '전공 평점 상위 학과 Top 10' : '전공 A학점 비율 상위 학과 Top 10'}
                  </h2>

                  {/* 차트 카드 헤더 내부로 통합된 정렬 버튼 그룹 */}
                  <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--border-color)', padding: '2px', borderRadius: '6px' }}>
                    <button
                      onClick={() => setSortBy('avg_gpa')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        fontWeight: '600',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: sortBy === 'avg_gpa' ? 'var(--card-bg)' : 'transparent',
                        color: sortBy === 'avg_gpa' ? 'var(--accent-blue)' : 'var(--text-muted)',
                        boxShadow: sortBy === 'avg_gpa' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      평점순
                    </button>
                    <button
                      onClick={() => setSortBy('a_grade_ratio')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        fontWeight: '600',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: sortBy === 'a_grade_ratio' ? 'var(--card-bg)' : 'transparent',
                        color: sortBy === 'a_grade_ratio' ? 'var(--accent-green)' : 'var(--text-muted)',
                        boxShadow: sortBy === 'a_grade_ratio' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      A비율순
                    </button>
                  </div>
                </div>

                <div style={{ width: '100%', height: '320px' }}>
                  {topDeptsChartData.length === 0 ? (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      학과 성적 데이터가 없습니다.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={topDeptsChartData} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartGridColor} />
                        
                        {/* X축: 평점 정렬 시 시작점을 2.0으로 강제 설정 */}
                        <XAxis 
                          type="number" 
                          domain={sortBy === 'avg_gpa' ? [2.0, 4.3] : [0, 100]} 
                          ticks={sortBy === 'avg_gpa' ? [2.0, 2.5, 3.0, 3.5, 4.0, 4.3] : [0, 25, 50, 75, 100]}
                          stroke={chartAxisColor} 
                          unit={sortBy === 'avg_gpa' ? '' : '%'}
                          tick={{ fontSize: 11, fill: chartAxisColor }}
                        />
                        <YAxis 
                          type="category" 
                          dataKey="dept_name" 
                          stroke={chartAxisColor} 
                          width={95} 
                          tick={{ fontSize: 12, fill: chartAxisColor }} 
                        />
                        <Tooltip 
                          formatter={(value: any) => [
                            sortBy === 'avg_gpa' ? `${value} / 4.3` : `${value}%`, 
                            sortBy === 'avg_gpa' ? '평균 평점' : 'A학점 비율'
                          ]}
                          contentStyle={{
                            backgroundColor: 'var(--card-bg)',
                            borderColor: 'var(--border-color)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)'
                          }}
                        />
                        <Bar 
                          dataKey="chart_value" 
                          fill={sortBy === 'avg_gpa' ? 'var(--accent-blue)' : 'var(--accent-green)'} 
                          radius={[0, 4, 4, 0]} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}