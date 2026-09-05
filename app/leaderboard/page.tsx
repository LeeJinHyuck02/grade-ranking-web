'use client';

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';

interface DeptRankingData {
  univ_name: string;
  college_name: string;
  dept_name: string;
  avg_gpa: number;
  total_students: number;
  a_students: number;
  a_grade_ratio: number;
  max_gpa?: number;
}

interface UnivRankingData {
  univ_name: string;
  course_type: string;
  total_depts: number;
  total_students: number;
  avg_gpa: number;
  a_students: number;
  a_grade_ratio: number;
  max_gpa?: number;
  std_dev_gpa?: number;
}

type SortField = 'avg_gpa' | 'a_grade_ratio';
type SortOrder = 'desc' | 'asc';
type ScaleType = '4.3' | '4.5';

const STEP = 10;
const SCROLL_STORAGE_KEY = 'leaderboard_scroll_position';

function LeaderboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialViewMode = (searchParams.get('mode') as 'univ' | 'dept') || 'univ';
  const initialScale = (searchParams.get('scale') as ScaleType) || '4.3';
  const initialCourseFilter = (searchParams.get('course') as '전체' | '전공' | '교양') || '전체';
  const initialUniv = searchParams.get('univ') || 'ALL';
  const initialCollege = searchParams.get('college') || 'ALL';
  const initialMinStudents = Number(searchParams.get('minStudents')) || 0;
  const initialSearchTerm = searchParams.get('q') || '';
  const initialSortField = (searchParams.get('sort') as SortField) || 'avg_gpa';
  const initialSortOrder = (searchParams.get('order') as SortOrder) || 'desc';
  const initialVisibleCount = Number(searchParams.get('count')) || STEP;

  const [viewMode, setViewMode] = useState<'univ' | 'dept'>(initialViewMode);
  const [scaleFilter, setScaleFilter] = useState<ScaleType>(initialScale);
  const [courseFilter, setCourseFilter] = useState<'전체' | '전공' | '교양'>(initialCourseFilter);
  const [selectedUniv, setSelectedUniv] = useState<string>(initialUniv);
  const [selectedCollege, setSelectedCollege] = useState<string>(initialCollege);
  const [minStudents, setMinStudents] = useState<number>(initialMinStudents);
  const [searchTerm, setSearchTerm] = useState<string>(initialSearchTerm);
  const [sortField, setSortField] = useState<SortField>(initialSortField);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder);
  const [visibleCount, setVisibleCount] = useState<number>(initialVisibleCount);

  const [deptRankings, setDeptRankings] = useState<DeptRankingData[]>([]);
  const [univRankings, setUnivRankings] = useState<UnivRankingData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const syncParamsToUrl = useCallback((updates: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (
        value === '' ||
        value === 'ALL' ||
        (key === 'mode' && value === 'univ') ||
        (key === 'scale' && value === '4.3') ||
        (key === 'course' && value === '전체') ||
        (key === 'minStudents' && Number(value) === 0) ||
        (key === 'sort' && value === 'avg_gpa') ||
        (key === 'order' && value === 'desc') ||
        (key === 'count' && Number(value) === STEP)
      ) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    async function fetchAllRankings() {
      setLoading(true);
      const [deptRes, univRes] = await Promise.all([
        supabase.from('major_rankings').select('*'),
        supabase.from('university_rankings').select('*')
      ]);

      if (deptRes.data) setDeptRankings(deptRes.data);
      if (univRes.data) setUnivRankings(univRes.data);
      setLoading(false);
    }
    fetchAllRankings();
  }, []);

  useEffect(() => {
    if (!loading && typeof window !== 'undefined') {
      const savedScrollPosition = sessionStorage.getItem(SCROLL_STORAGE_KEY);
      if (savedScrollPosition !== null) {
        const targetY = parseInt(savedScrollPosition, 10);
        requestAnimationFrame(() => {
          window.scrollTo({
            top: targetY,
            behavior: 'instant'
          });
          sessionStorage.removeItem(SCROLL_STORAGE_KEY);
        });
      }
    }
  }, [loading]);

  const targetMaxGpa = useMemo(() => Number(scaleFilter), [scaleFilter]);

  const universityList = useMemo(() => {
    const univSet = new Set<string>();
    deptRankings.forEach((row) => {
      const rowScale = row.max_gpa !== undefined ? row.max_gpa : 4.3;
      if (rowScale === targetMaxGpa) {
        const clean = (row.univ_name || '').trim();
        if (clean) univSet.add(clean);
      }
    });
    return Array.from(univSet).sort();
  }, [deptRankings, targetMaxGpa]);

  const collegeList = useMemo(() => {
    const collegeSet = new Set<string>();
    deptRankings.forEach((row) => {
      const rowScale = row.max_gpa !== undefined ? row.max_gpa : 4.3;
      const cleanUniv = (row.univ_name || '').trim();
      const cleanCollege = (row.college_name || '').trim();
      if (rowScale === targetMaxGpa && (selectedUniv === 'ALL' || cleanUniv === selectedUniv) && cleanCollege) {
        collegeSet.add(cleanCollege);
      }
    });
    return Array.from(collegeSet).sort();
  }, [deptRankings, selectedUniv, targetMaxGpa]);

  const handleScaleChange = (scale: ScaleType) => {
    setScaleFilter(scale);
    setSelectedUniv('ALL');
    setSelectedCollege('ALL');
    setVisibleCount(STEP);
    syncParamsToUrl({ scale, univ: 'ALL', college: 'ALL', count: STEP });
  };

  const handleUnivChange = (univ: string) => {
    setSelectedUniv(univ);
    setSelectedCollege('ALL');
    setVisibleCount(STEP);
    syncParamsToUrl({ univ, college: 'ALL', count: STEP });
  };

  const handleCollegeChange = (college: string) => {
    setSelectedCollege(college);
    setVisibleCount(STEP);
    syncParamsToUrl({ college, count: STEP });
  };

  const handleMinStudentsChange = (count: number) => {
    setMinStudents(count);
    setVisibleCount(STEP);
    syncParamsToUrl({ minStudents: count, count: STEP });
  };

  const handleViewModeChange = (mode: 'univ' | 'dept') => {
    setViewMode(mode);
    setSearchTerm('');
    setSortField('avg_gpa');
    setSortOrder('desc');
    setVisibleCount(STEP);
    syncParamsToUrl({
      mode,
      q: '',
      sort: 'avg_gpa',
      order: 'desc',
      count: STEP
    });
  };

  const handleCourseFilterChange = (filter: '전체' | '전공' | '교양') => {
    setCourseFilter(filter);
    setVisibleCount(STEP);
    syncParamsToUrl({ course: filter, count: STEP });
  };

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    setVisibleCount(STEP);
    syncParamsToUrl({ q: term, count: STEP });
  };

  const handleSort = (field: SortField) => {
    let nextOrder: SortOrder = 'desc';
    if (sortField === field) {
      nextOrder = sortOrder === 'desc' ? 'asc' : 'desc';
      setSortOrder(nextOrder);
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setVisibleCount(STEP);
    syncParamsToUrl({ sort: field, order: nextOrder, count: STEP });
  };

  const filteredUnivRankings = useMemo(() => {
    const targetTerm = searchTerm.trim().toLowerCase();

    return univRankings
      .filter((row) => {
        const rowScale = row.max_gpa !== undefined ? row.max_gpa : 4.3;
        const rowUniv = (row.univ_name || '').trim();
        const rowCourse = (row.course_type || '').trim();

        const matchesScale = rowScale === targetMaxGpa;
        const matchesCourse = rowCourse === courseFilter;
        const matchesSearch = !targetTerm || rowUniv.toLowerCase().includes(targetTerm);

        return matchesScale && matchesCourse && matchesSearch;
      })
      .sort((a, b) => {
        const numA = (a[sortField] as number) || 0;
        const numB = (b[sortField] as number) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      });
  }, [univRankings, targetMaxGpa, courseFilter, searchTerm, sortField, sortOrder]);

  const filteredDeptRankings = useMemo(() => {
    const targetUniv = selectedUniv.trim();
    const targetCollege = selectedCollege.trim();
    const targetTerm = searchTerm.trim().toLowerCase();

    return deptRankings
      .filter((row) => {
        const rowScale = row.max_gpa !== undefined ? row.max_gpa : 4.3;
        const rowUniv = (row.univ_name || '').trim();
        const rowCollege = (row.college_name || '').trim();
        const rowDept = (row.dept_name || '').trim();
        const rowStudents = row.total_students || 0;

        const matchesScale = rowScale === targetMaxGpa;
        const matchesUniv = targetUniv === 'ALL' || rowUniv === targetUniv;
        const matchesCollege = targetCollege === 'ALL' || rowCollege === targetCollege;
        const matchesMinStudents = rowStudents >= minStudents;
        const matchesSearch =
          !targetTerm ||
          rowUniv.toLowerCase().includes(targetTerm) ||
          rowCollege.toLowerCase().includes(targetTerm) ||
          rowDept.toLowerCase().includes(targetTerm);

        return matchesScale && matchesUniv && matchesCollege && matchesMinStudents && matchesSearch;
      })
      .sort((a, b) => {
        const numA = (a[sortField] as number) || 0;
        const numB = (b[sortField] as number) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      });
  }, [deptRankings, targetMaxGpa, selectedUniv, selectedCollege, minStudents, searchTerm, sortField, sortOrder]);

  const activeDataLength = viewMode === 'univ' ? filteredUnivRankings.length : filteredDeptRankings.length;
  const hasMore = visibleCount < activeDataLength;

  const visibleUnivRankings = useMemo(() => {
    return filteredUnivRankings.slice(0, visibleCount);
  }, [filteredUnivRankings, visibleCount]);

  const visibleDeptRankings = useMemo(() => {
    return filteredDeptRankings.slice(0, visibleCount);
  }, [filteredDeptRankings, visibleCount]);

  const handleLoadMore = () => {
    const nextCount = visibleCount + STEP;
    setVisibleCount(nextCount);
    syncParamsToUrl({ count: nextCount });
  };

  const saveCurrentScrollPosition = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SCROLL_STORAGE_KEY, window.scrollY.toString());
    }
  };

  const handleNavigateToUniv = (univ: string) => {
    saveCurrentScrollPosition();
    router.push(`/universities/${encodeURIComponent(univ.trim())}`);
  };

  const handleNavigateToDept = (univ: string, dept: string) => {
    saveCurrentScrollPosition();
    router.push(`/departments/${encodeURIComponent(univ.trim())}/${encodeURIComponent(dept.trim())}?from=leaderboard`);
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <span style={{ opacity: 0.35, marginLeft: '3px', fontSize: '10px' }}>⇅</span>;
    }
    return (
      <span style={{ marginLeft: '3px', fontSize: '10px', color: 'var(--accent-blue)', fontWeight: 700 }}>
        {sortOrder === 'desc' ? '▼' : '▲'}
      </span>
    );
  };

  const getSortableHeaderStyle = (field: SortField, width: string) => {
    const isCurrent = sortField === field;
    return {
      width,
      padding: '12px 10px',
      textAlign: 'right' as const,
      cursor: 'pointer',
      userSelect: 'none' as const,
      color: isCurrent ? 'var(--accent-blue)' : 'var(--text-secondary)',
      fontWeight: isCurrent ? 700 : 600,
      transition: 'color 0.15s ease',
      whiteSpace: 'nowrap' as const
    };
  };

  const getStaticHeaderStyle = (width: string, align: 'left' | 'center' | 'right' = 'left') => {
    return {
      width,
      padding: '12px 10px',
      textAlign: align,
      color: 'var(--text-secondary)',
      fontWeight: 600,
      whiteSpace: 'nowrap' as const
    };
  };

  const ellipsisCellStyle = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', padding: '16px 12px', transition: 'background-color 0.2s' }}>
      
      <style>{`
        .desktop-view {
          display: block;
        }
        .mobile-view {
          display: none;
        }

        .form-control-base {
          display: block;
          box-sizing: border-box !important;
          height: 36px !important;
          min-height: 36px !important;
          padding: 0 10px !important;
          font-size: 13px !important;
          line-height: normal !important;
          border: 1px solid var(--border-color) !important;
          border-radius: 6px !important;
          background-color: var(--table-header-bg) !important;
          color: var(--text-primary) !important;
          outline: none !important;
          margin: 0 !important;
          transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
        }

        .form-control-base:focus {
          border-color: var(--accent-blue) !important;
          box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2) !important;
          background-color: var(--card-bg) !important;
        }

        .unified-control-card {
          box-sizing: border-box !important;
          width: 100% !important;
          background-color: var(--card-bg) !important;
          border: 1px solid var(--border-color) !important;
          border-radius: 10px !important;
          padding: 10px !important;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
        }

        .univ-row-container {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 8px !important;
          width: 100% !important;
        }

        .univ-select-field {
          width: 120px !important;
          min-width: 110px !important;
          max-width: 130px !important;
          flex-shrink: 0 !important;
          cursor: pointer !important;
        }

        .univ-input-field {
          flex: 1 1 0% !important;
          min-width: 0 !important;
          width: 100% !important;
        }

        .dept-column-container {
          display: flex !important;
          flex-direction: column !important;
          gap: 8px !important;
          width: 100% !important;
        }

        .dept-grid-field {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 6px !important;
          width: 100% !important;
        }

        .dept-input-field {
          width: 100% !important;
        }

        @media (max-width: 768px) {
          .desktop-view {
            display: none !important;
          }
          .mobile-view {
            display: flex !important;
            flex-direction: column;
            gap: 8px;
            padding: 8px;
          }
          .form-control-base {
            font-size: 16px !important;
          }
          .dept-grid-field {
            gap: 4px !important;
          }
          .dept-grid-field select {
            font-size: 12px !important;
            padding: 0 4px !important;
          }
          .header-label-text {
            display: none !important;
          }
          .univ-select-field {
            width: 105px !important;
            min-width: 100px !important;
            font-size: 13px !important;
            padding: 0 6px !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        
        {/* 상단 공통 네비게이션 바 (리더보드 vs 백분위 계산기 탭 제공) */}
        <Navbar />

        {/* ================= 전국 학점 리더보드 섹션 ================= */}
        <section style={{ display: 'flex', flexDirection: 'column' }}>
          {/* 상단 백분위 계산기 이동 링크 */}
          <div style={{ marginBottom: '8px' }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textDecoration: 'none',
                transition: 'color 0.15s ease'
              }}
            >
              <span>←</span>
              <span>백분위 계산기</span>
            </Link>
          </div>

          {/* 제어 버튼 툴바: 좌측 만점 체계 토글 (4.3 / 4.5) & 우측 학교/학과 선택 토글 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '10px'
          }}>
            {/* 만점 체계 토글 (4.3 / 4.5) - 좌측 배치 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              backgroundColor: 'var(--table-header-bg)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <button
                onClick={() => handleScaleChange('4.3')}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  fontSize: '12px',
                  fontWeight: scaleFilter === '4.3' ? 700 : 500,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: scaleFilter === '4.3' ? 'var(--card-bg)' : 'transparent',
                  color: scaleFilter === '4.3' ? 'var(--accent-blue)' : 'var(--text-muted)',
                  boxShadow: scaleFilter === '4.3' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                4.3 만점
              </button>
              <button
                onClick={() => handleScaleChange('4.5')}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  fontSize: '12px',
                  fontWeight: scaleFilter === '4.5' ? 700 : 500,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: scaleFilter === '4.5' ? 'var(--card-bg)' : 'transparent',
                  color: scaleFilter === '4.5' ? 'var(--accent-blue)' : 'var(--text-muted)',
                  boxShadow: scaleFilter === '4.5' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                4.5 만점
              </button>
            </div>

            {/* 학교 / 학과 토글 - 우측 배치 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              backgroundColor: 'var(--table-header-bg)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <button
                onClick={() => handleViewModeChange('univ')}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  fontSize: '12px',
                  fontWeight: viewMode === 'univ' ? 700 : 500,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'univ' ? 'var(--card-bg)' : 'transparent',
                  color: viewMode === 'univ' ? 'var(--accent-blue)' : 'var(--text-muted)',
                  boxShadow: viewMode === 'univ' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>🏛️</span>
                <span>학교별</span>
              </button>
              <button
                onClick={() => handleViewModeChange('dept')}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  fontSize: '12px',
                  fontWeight: viewMode === 'dept' ? 700 : 500,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'dept' ? 'var(--card-bg)' : 'transparent',
                  color: viewMode === 'dept' ? 'var(--accent-blue)' : 'var(--text-muted)',
                  boxShadow: viewMode === 'dept' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>🎓</span>
                <span>학과별</span>
              </button>
            </div>
          </div>

        {/* ================= 3단계: 세부 제어 영역 ================= */}
        <div style={{ marginBottom: '12px' }}>
          {viewMode === 'univ' ? (
            <div className="unified-control-card">
              <div className="univ-row-container">
                <select
                  className="form-control-base univ-select-field"
                  value={courseFilter}
                  onChange={(e) => handleCourseFilterChange(e.target.value as '전체' | '전공' | '교양')}
                >
                  <option value="전체">전체 교과</option>
                  <option value="전공">전공 과목</option>
                  <option value="교양">교양 과목</option>
                </select>

                <input
                  type="text"
                  className="form-control-base univ-input-field"
                  placeholder="학교명 검색..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="unified-control-card">
              <div className="dept-column-container">
                <div className="dept-grid-field">
                  <select
                    className="form-control-base"
                    value={selectedUniv}
                    onChange={(e) => handleUnivChange(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="ALL">전체 대학교</option>
                    {universityList.map((univ) => (
                      <option key={univ} value={univ}>{univ}</option>
                    ))}
                  </select>

                  <select
                    className="form-control-base"
                    value={selectedCollege}
                    onChange={(e) => handleCollegeChange(e.target.value)}
                    disabled={collegeList.length === 0}
                    style={{
                      cursor: collegeList.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: collegeList.length === 0 ? 0.6 : 1
                    }}
                  >
                    <option value="ALL">{collegeList.length === 0 ? '단과대 없음' : '전체 단과대'}</option>
                    {collegeList.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>

                  <select
                    className="form-control-base"
                    value={minStudents}
                    onChange={(e) => handleMinStudentsChange(Number(e.target.value))}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value={0}>인원 전체</option>
                    <option value={30}>30명 이상</option>
                    <option value={50}>50명 이상</option>
                    <option value={100}>100명 이상</option>
                    <option value={200}>200명 이상</option>
                    <option value={500}>500명 이상</option>
                  </select>
                </div>

                <input
                  type="text"
                  className="form-control-base dept-input-field"
                  placeholder="학과명 또는 키워드 검색..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* ================= 4단계: 결과 상태 및 인라인 정렬 바 ================= */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
          padding: '0 2px',
          marginBottom: '8px'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {viewMode === 'univ' ? (
              <>기준: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{courseFilter === '전체' ? '전체(전공+교양)' : `${courseFilter} 과목`}</span></>
            ) : (
              <>
                기준: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>전공 과목</span>
                {minStudents > 0 && (
                  <span style={{ marginLeft: '3px', color: 'var(--accent-blue)', fontWeight: 600 }}>
                    ({minStudents}명 이상)
                  </span>
                )}
              </>
            )}
            <span style={{ margin: '0 4px', opacity: 0.35 }}>·</span>
            <span>척도: <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{scaleFilter} 만점</span></span>
            <span style={{ margin: '0 4px', opacity: 0.35 }}>·</span>
            <span>표시: <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{Math.min(visibleCount, activeDataLength)}</span> / {activeDataLength}개</span>
          </div>

          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              onClick={() => handleSort('avg_gpa')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                height: '26px',
                padding: '0 7px',
                fontSize: '11px',
                fontWeight: sortField === 'avg_gpa' ? 700 : 500,
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                backgroundColor: sortField === 'avg_gpa' ? 'var(--card-hover)' : 'var(--card-bg)',
                color: sortField === 'avg_gpa' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span>평균 평점</span>
              {renderSortIndicator('avg_gpa')}
            </button>
            <button
              onClick={() => handleSort('a_grade_ratio')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                height: '26px',
                padding: '0 7px',
                fontSize: '11px',
                fontWeight: sortField === 'a_grade_ratio' ? 700 : 500,
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                backgroundColor: sortField === 'a_grade_ratio' ? 'var(--card-hover)' : 'var(--card-bg)',
                color: sortField === 'a_grade_ratio' ? 'var(--accent-green)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span>A학점 비율</span>
              {renderSortIndicator('a_grade_ratio')}
            </button>
          </div>
        </div>

        {/* ================= 5단계: 리더보드 테이블/카드 컨테이너 ================= */}
        <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              데이터를 불러오는 중입니다...
            </div>
          ) : viewMode === 'univ' ? (
            
            /* 대학교 리더보드 */
            visibleUnivRankings.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                해당 조건의 대학교 데이터가 없습니다.
              </div>
            ) : (
              <>
                <div className="desktop-view" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '760px', tableLayout: 'fixed', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--table-header-bg)', fontSize: '13px' }}>
                        <th style={getStaticHeaderStyle('55px', 'center')}>순위</th>
                        <th style={getStaticHeaderStyle('26%', 'left')}>학교명</th>
                        <th style={getStaticHeaderStyle('80px', 'center')}>구분</th>
                        <th style={getStaticHeaderStyle('14%', 'right')}>개설 학과 수</th>
                        <th onClick={() => handleSort('avg_gpa')} style={getSortableHeaderStyle('avg_gpa', '18%')}>
                          평균 평점 {renderSortIndicator('avg_gpa')}
                        </th>
                        <th onClick={() => handleSort('a_grade_ratio')} style={getSortableHeaderStyle('a_grade_ratio', '15%')}>
                          A학점 비율 {renderSortIndicator('a_grade_ratio')}
                        </th>
                        <th style={getStaticHeaderStyle('17%', 'right')}>수강 학생 수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleUnivRankings.map((row, index) => {
                        const isTopThree = index < 3;
                        const cleanUniv = (row.univ_name || '').trim();
                        return (
                          <tr
                            key={`${cleanUniv}-${row.course_type}`}
                            onClick={() => handleNavigateToUniv(cleanUniv)}
                            style={{
                              borderBottom: '1px solid var(--border-color)',
                              cursor: 'pointer',
                              fontSize: '13px',
                              backgroundColor: 'var(--card-bg)',
                              transition: 'background-color 0.15s ease'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--card-hover)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--card-bg)')}
                          >
                            <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>
                              <span style={{
                                display: 'inline-block',
                                width: '22px',
                                height: '22px',
                                lineHeight: '22px',
                                borderRadius: '50%',
                                backgroundColor: isTopThree ? 'var(--table-header-bg)' : 'transparent',
                                color: isTopThree ? 'var(--accent-blue)' : 'var(--text-muted)',
                                fontSize: '11px'
                              }}>
                                {index + 1}
                              </span>
                            </td>
                            <td title={cleanUniv} style={{ ...ellipsisCellStyle, padding: '10px 8px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                              {cleanUniv}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <span style={{ fontSize: '11px', padding: '2px 5px', borderRadius: '4px', backgroundColor: 'var(--table-header-bg)', color: 'var(--text-secondary)' }}>
                                {row.course_type}
                              </span>
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {row.course_type === '교양' ? '-' : `${row.total_depts}개`}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: sortField === 'avg_gpa' ? 700 : 500, color: sortField === 'avg_gpa' ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                              {row.avg_gpa ? row.avg_gpa.toFixed(2) : '0.00'} <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>/ {scaleFilter}</span>
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: sortField === 'a_grade_ratio' ? 700 : 500, color: sortField === 'a_grade_ratio' ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                              {row.a_grade_ratio !== null ? `${row.a_grade_ratio.toFixed(1)}%` : '-'}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {(row.total_students || 0).toLocaleString()}명
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-view">
                  {visibleUnivRankings.map((row, index) => {
                    const isTopThree = index < 3;
                    const cleanUniv = (row.univ_name || '').trim();
                    return (
                      <div
                        key={`m-${cleanUniv}-${row.course_type}`}
                        onClick={() => handleNavigateToUniv(cleanUniv)}
                        style={{
                          backgroundColor: 'var(--card-bg)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              display: 'inline-block',
                              width: '20px',
                              height: '20px',
                              lineHeight: '20px',
                              textAlign: 'center',
                              borderRadius: '50%',
                              backgroundColor: isTopThree ? 'var(--table-header-bg)' : 'transparent',
                              color: isTopThree ? 'var(--accent-blue)' : 'var(--text-muted)',
                              fontSize: '11px',
                              fontWeight: 700
                            }}>
                              {index + 1}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {cleanUniv}
                            </span>
                          </div>
                          <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--table-header-bg)', color: 'var(--text-secondary)' }}>
                            {row.course_type}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', backgroundColor: 'var(--table-header-bg)', padding: '6px 8px', borderRadius: '6px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '1px' }}>평균 평점</div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: sortField === 'avg_gpa' ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                              {row.avg_gpa ? row.avg_gpa.toFixed(2) : '0.00'} <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>/ {scaleFilter}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '1px' }}>A학점 비율</div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: sortField === 'a_grade_ratio' ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                              {row.a_grade_ratio !== null ? `${row.a_grade_ratio.toFixed(1)}%` : '-'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '1px' }}>수강 학생</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                              {(row.total_students || 0).toLocaleString()}명
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          ) : (
            
            /* 학과별 리더보드 */
            visibleDeptRankings.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                선택한 조건과 일치하는 학과 데이터가 없습니다.
              </div>
            ) : (
              <>
                <div className="desktop-view" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '780px', tableLayout: 'fixed', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--table-header-bg)', fontSize: '13px' }}>
                        <th style={getStaticHeaderStyle('55px', 'center')}>순위</th>
                        <th style={getStaticHeaderStyle('18%', 'left')}>학교명</th>
                        <th style={getStaticHeaderStyle('18%', 'left')}>단과대학</th>
                        <th style={getStaticHeaderStyle('25%', 'left')}>학과명</th>
                        <th onClick={() => handleSort('avg_gpa')} style={getSortableHeaderStyle('avg_gpa', '15%')}>
                          통합 평균 평점 {renderSortIndicator('avg_gpa')}
                        </th>
                        <th onClick={() => handleSort('a_grade_ratio')} style={getSortableHeaderStyle('a_grade_ratio', '12%')}>
                          A학점 비율 {renderSortIndicator('a_grade_ratio')}
                        </th>
                        <th style={getStaticHeaderStyle('12%', 'right')}>총 수강 인원</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleDeptRankings.map((row, index) => {
                        const isTopThree = index < 3;
                        const cleanUniv = (row.univ_name || '').trim();
                        const cleanCollege = (row.college_name || '').trim() || '-';
                        const cleanDept = (row.dept_name || '').trim();

                        return (
                          <tr
                            key={`${cleanUniv}-${cleanCollege}-${cleanDept}`}
                            onClick={() => handleNavigateToDept(cleanUniv, cleanDept)}
                            style={{
                              borderBottom: '1px solid var(--border-color)',
                              cursor: 'pointer',
                              fontSize: '13px',
                              backgroundColor: 'var(--card-bg)',
                              transition: 'background-color 0.15s ease'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--card-hover)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--card-bg)')}
                          >
                            <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>
                              <span style={{
                                display: 'inline-block',
                                width: '22px',
                                height: '22px',
                                lineHeight: '22px',
                                borderRadius: '50%',
                                backgroundColor: isTopThree ? 'var(--table-header-bg)' : 'transparent',
                                color: isTopThree ? 'var(--accent-blue)' : 'var(--text-muted)',
                                fontSize: '11px'
                              }}>
                                {index + 1}
                              </span>
                            </td>
                            <td title={cleanUniv} style={{ ...ellipsisCellStyle, padding: '10px 8px', color: 'var(--text-secondary)' }}>
                              {cleanUniv}
                            </td>
                            <td title={cleanCollege} style={{ ...ellipsisCellStyle, padding: '10px 8px', color: 'var(--text-muted)' }}>
                              {cleanCollege}
                            </td>
                            <td title={cleanDept} style={{ ...ellipsisCellStyle, padding: '10px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {cleanDept}
                            </td>
                            <td style={{
                              padding: '10px 8px',
                              textAlign: 'right',
                              fontWeight: sortField === 'avg_gpa' ? 700 : 500,
                              color: sortField === 'avg_gpa' ? 'var(--accent-blue)' : 'var(--text-primary)',
                              whiteSpace: 'nowrap'
                            }}>
                              {row.avg_gpa ? row.avg_gpa.toFixed(2) : '0.00'} <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>/ {scaleFilter}</span>
                            </td>
                            <td style={{
                              padding: '10px 8px',
                              textAlign: 'right',
                              fontWeight: sortField === 'a_grade_ratio' ? 700 : 500,
                              color: sortField === 'a_grade_ratio' ? 'var(--accent-green)' : 'var(--text-primary)',
                              whiteSpace: 'nowrap'
                            }}>
                              {row.a_grade_ratio !== null && row.a_grade_ratio !== undefined ? `${row.a_grade_ratio.toFixed(1)}%` : '-'}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {(row.total_students || 0).toLocaleString()}명
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-view">
                  {visibleDeptRankings.map((row, index) => {
                    const isTopThree = index < 3;
                    const cleanUniv = (row.univ_name || '').trim();
                    const cleanCollege = (row.college_name || '').trim();
                    const cleanDept = (row.dept_name || '').trim();

                    return (
                      <div
                        key={`m-${cleanUniv}-${cleanCollege}-${cleanDept}`}
                        onClick={() => handleNavigateToDept(cleanUniv, cleanDept)}
                        style={{
                          backgroundColor: 'var(--card-bg)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                          <span style={{
                            display: 'inline-block',
                            width: '20px',
                            height: '20px',
                            lineHeight: '20px',
                            textAlign: 'center',
                            borderRadius: '50%',
                            backgroundColor: isTopThree ? 'var(--table-header-bg)' : 'transparent',
                            color: isTopThree ? 'var(--accent-blue)' : 'var(--text-muted)',
                            fontSize: '11px',
                            fontWeight: 700,
                            flexShrink: 0
                          }}>
                            {index + 1}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1px' }}>
                              {cleanDept}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {cleanUniv} {cleanCollege ? `· ${cleanCollege}` : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', backgroundColor: 'var(--table-header-bg)', padding: '6px 8px', borderRadius: '6px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '1px' }}>평균 평점</div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: sortField === 'avg_gpa' ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                              {row.avg_gpa ? row.avg_gpa.toFixed(2) : '0.00'} <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>/ {scaleFilter}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '1px' }}>A학점 비율</div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: sortField === 'a_grade_ratio' ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                              {row.a_grade_ratio !== null ? `${row.a_grade_ratio.toFixed(1)}%` : '-'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '1px' }}>총 수강생</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                              {(row.total_students || 0).toLocaleString()}명
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          )}

          {/* ================= 6단계: 하단 더보기 버튼 ================= */}
          {!loading && hasMore && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '12px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--table-header-bg)'
            }}>
              <button
                onClick={handleLoadMore}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  width: '100%',
                  maxWidth: '280px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--card-bg)',
                  color: 'var(--accent-blue)',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>+</span>
                <span>10개 더보기 ({Math.min(visibleCount, activeDataLength)} / {activeDataLength})</span>
              </button>
            </div>
          )}
        </div>
        </section>

      </div>
    </div>
  );
}

export default function UnifiedLeaderboardPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
        리더보드를 불러오는 중입니다...
      </div>
    }>
      <LeaderboardContent />
    </Suspense>
  );
}