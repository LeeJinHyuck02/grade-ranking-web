'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabase';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line, CartesianGrid 
} from 'recharts';

interface GradeRow {
  semester: string;
  grade: string;
  grade_point: number | null;
  student_count: number;
}

interface BarChartData {
  grade: string;
  student_count: number;
  ratio: string;
}

const GRADE_ORDER = ['A+', 'A0', 'A-', 'B+', 'B0', 'B-', 'C+', 'C0', 'C-', 'D+', 'D0', 'D-', 'F', 'P'];

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as BarChartData;
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
          인원: {data.student_count.toLocaleString()}명
        </p>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--accent-green)', fontWeight: '600' }}>
          비율: {data.ratio}%
        </p>
      </div>
    );
  }
  return null;
};

function DepartmentDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState<boolean>(false);

  const fromSource = searchParams.get('from');

  const rawUniv = typeof params.univ === 'string' ? params.univ : '';
  const rawDept = typeof params.dept === 'string' ? params.dept : '';
  
  const univName = decodeURIComponent(rawUniv).trim();
  const deptName = decodeURIComponent(rawDept).trim();

  const [gradeData, setGradeData] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchDepartmentData() {
      if (!univName || !deptName) return;
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from('grade_distribution')
        .select('semester, grade, grade_point, student_count')
        .eq('univ_name', univName)
        .eq('dept_name', deptName);

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        setGradeData(data);
      }
      setLoading(false);
    }
    fetchDepartmentData();
  }, [univName, deptName]);

  const totalStudents = gradeData.reduce((acc, cur) => acc + (cur.student_count || 0), 0);
  const validGrades = gradeData.filter((d) => d.grade_point !== null && d.grade_point !== undefined);
  const totalWeightedPoints = validGrades.reduce((acc, cur) => acc + (cur.grade_point! * cur.student_count), 0);
  const avgGpa = totalStudents > 0 ? (totalWeightedPoints / totalStudents).toFixed(2) : '0.00';

  const aGradeStudents = gradeData
    .filter((d) => ['A+', 'A0', 'A-'].includes(d.grade ? d.grade.trim() : ''))
    .reduce((acc, cur) => acc + (cur.student_count || 0), 0);
  const aGradeRatio = totalStudents > 0 ? ((aGradeStudents / totalStudents) * 100).toFixed(1) : '0.0';

  const gradeSummaryMap: { [key: string]: number } = {};
  gradeData.forEach((row) => {
    const g = row.grade ? row.grade.trim() : '';
    if (g) {
      gradeSummaryMap[g] = (gradeSummaryMap[g] || 0) + row.student_count;
    }
  });

  const barChartData: BarChartData[] = GRADE_ORDER
    .filter((g) => gradeSummaryMap[g] !== undefined)
    .map((g) => {
      const count = gradeSummaryMap[g];
      const ratio = totalStudents > 0 ? ((count / totalStudents) * 100).toFixed(1) : '0.0';
      return {
        grade: g,
        student_count: count,
        ratio: ratio,
      };
    });

  const semesterMap: { [key: string]: { totalPoints: number; count: number } } = {};
  validGrades.forEach((row) => {
    const sem = row.semester ? row.semester.trim() : '기타';
    if (!semesterMap[sem]) {
      semesterMap[sem] = { totalPoints: 0, count: 0 };
    }
    semesterMap[sem].totalPoints += row.grade_point! * row.student_count;
    semesterMap[sem].count += row.student_count;
  });

  const lineChartData = Object.keys(semesterMap).map((sem) => ({
    semester: sem,
    avg_gpa: parseFloat((semesterMap[sem].totalPoints / semesterMap[sem].count).toFixed(2)),
  }));

  const isDark = mounted && resolvedTheme === 'dark';
  const chartGridColor = isDark ? '#334155' : '#f3f4f6';
  const chartAxisColor = isDark ? '#94a3b8' : '#4b5563';

  const handleGoBack = () => {
    if (fromSource === 'univ') {
      router.push(`/universities/${encodeURIComponent(univName)}`);
    } else {
      router.push('/');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', padding: '32px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', padding: '24px 16px', boxSizing: 'border-box', overflowX: 'hidden', transition: 'background-color 0.2s' }}>
      <div style={{ maxWidth: '1080px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        
        {/* 상단 네비게이션 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <button
              onClick={handleGoBack}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: '13px',
                color: 'var(--accent-blue)',
                cursor: 'pointer',
                marginBottom: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                fontWeight: '600'
              }}
            >
              {fromSource === 'univ' ? `← ${univName} 종합 리포트로 돌아가기` : '← 전체 랭킹으로 돌아가기'}
            </button>
            <span style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)', marginTop: '2px' }}>{univName}</span>
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--text-primary)', margin: '2px 0 0 0', wordBreak: 'keep-all' }}>
              {deptName} 학점 분석 리포트
            </h1>
          </div>
          <ThemeToggle />
        </div>

        {/* 데이터 부재 알림 */}
        {gradeData.length === 0 && (
          <div style={{ backgroundColor: isDark ? '#450a0a' : '#fef2f2', border: '1px solid #f87171', padding: '16px', borderRadius: '8px', color: isDark ? '#fca5a5' : '#991b1b' }}>
            <p style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>데이터를 조회할 수 없습니다.</p>
            <p style={{ fontSize: '13px', margin: 0 }}>
              요청 정보: 학교명 "{univName}", 학과명 "{deptName}"<br />
              {errorMsg ? `오류 메시지: ${errorMsg}` : '데이터베이스에 해당 학과명의 성적 레코드가 존재하지 않습니다.'}
            </p>
          </div>
        )}

        {/* 핵심 KPI 카드 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 6px 0', fontWeight: '500' }}>전체 평균 평점</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-blue)', margin: 0 }}>
              {avgGpa} <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ 4.3</span>
            </p>
          </div>
          <div style={{ backgroundColor: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 6px 0', fontWeight: '500' }}>A학점 취득 비율</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-green)', margin: 0 }}>{aGradeRatio}%</p>
          </div>
          <div style={{ backgroundColor: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 6px 0', fontWeight: '500' }}>누적 수강 학생 수</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>{totalStudents.toLocaleString()}명</p>
          </div>
        </div>

        {/* 시각화 차트 그리드 */}
        {gradeData.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
            
            {/* 막대 차트 카드 */}
            <div style={{ backgroundColor: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '6px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>등급별 성적 분포</h2>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>* 터치 스크롤 지원</span>
              </div>

              {/* 가로 스크롤 래퍼 */}
              <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '4px' }}>
                <div style={{ minWidth: '460px', height: '300px' }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                      <XAxis dataKey="grade" stroke={chartAxisColor} tick={{ fontSize: 11 }} />
                      <YAxis stroke={chartAxisColor} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomBarTooltip />} cursor={{ fill: isDark ? '#334155' : '#f3f4f6' }} />
                      <Bar dataKey="student_count" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 선 그래프 카드 */}
            <div style={{ backgroundColor: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '6px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>학기별 평균 평점 추이</h2>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>* 터치 스크롤 지원</span>
              </div>

              {/* 가로 스크롤 래퍼 */}
              <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '4px' }}>
                <div style={{ minWidth: '460px', height: '300px' }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={lineChartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                      <XAxis dataKey="semester" stroke={chartAxisColor} tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 4.3]} stroke={chartAxisColor} tick={{ fontSize: 11 }} />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'var(--card-bg)',
                          borderColor: 'var(--border-color)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)'
                        }}
                      />
                      <Line type="monotone" dataKey="avg_gpa" stroke="var(--accent-green)" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default function DepartmentDetailPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', padding: '32px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>페이지를 불러오는 중입니다...</p>
      </div>
    }>
      <DepartmentDetailContent />
    </Suspense>
  );
}