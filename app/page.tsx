'use client';

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ThemeToggle } from '@/components/ThemeToggle';

interface DeptRankingData {
  univ_name: string;
  college_name: string;
  dept_name: string;
  avg_gpa: number;
  total_students: number;
  a_students: number;
  a_grade_ratio: number;
}

interface UnivRankingData {
  univ_name: string;
  course_type: string;
  total_depts: number;
  total_students: number;
  avg_gpa: number;
  a_students: number;
  a_grade_ratio: number;
}

type SortField = 'avg_gpa' | 'a_grade_ratio';
type SortOrder = 'desc' | 'asc';

const STEP = 10;
const SCROLL_STORAGE_KEY = 'leaderboard_scroll_position';

function LeaderboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialViewMode = (searchParams.get('mode') as 'univ' | 'dept') || 'univ';
  const initialCourseFilter = (searchParams.get('course') as '전체' | '전공' | '교양') || '전체';
  const initialUniv = searchParams.get('univ') || 'ALL';
  const initialCollege = searchParams.get('college') || 'ALL';
  const initialMinStudents = Number(searchParams.get('minStudents')) || 0;
  const initialSearchTerm = searchParams.get('q') || '';
  const initialSortField = (searchParams.get('sort') as SortField) || 'avg_gpa';
  const initialSortOrder = (searchParams.get('order') as SortOrder) || 'desc';
  const initialVisibleCount = Number(searchParams.get('count')) || STEP;

  const [viewMode, setViewMode] = useState<'univ' | 'dept'>(initialViewMode);
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

  const universityList = useMemo(() => {
    const univSet = new Set<string>();
    deptRankings.forEach((row) => {
      const clean = (row.univ_name || '').trim();
      if (clean) univSet.add(clean);
    });
    return Array.from(univSet).sort();
  }, [deptRankings]);

  const collegeList = useMemo(() => {
    const collegeSet = new Set<string>();
    deptRankings.forEach((row) => {
      const cleanUniv = (row.univ_name || '').trim();
      const cleanCollege = (row.college_name || '').trim();
      if ((selectedUniv === 'ALL' || cleanUniv === selectedUniv) && cleanCollege) {
        collegeSet.add(cleanCollege);
      }
    });
    return Array.from(collegeSet).sort();
  }, [deptRankings, selectedUniv]);

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
        const rowUniv = (row.univ_name || '').trim();
        const rowCourse = (row.course_type || '').trim();

        const matchesCourse = rowCourse === courseFilter;
        const matchesSearch = !targetTerm || rowUniv.toLowerCase().includes(targetTerm);

        return matchesCourse && matchesSearch;
      })
      .sort((a, b) => {
        const numA = (a[sortField] as number) || 0;
        const numB = (b[sortField] as number) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      });
  }, [univRankings, courseFilter, searchTerm, sortField, sortOrder]);

  const filteredDeptRankings = useMemo(() => {
    const targetUniv = selectedUniv.trim();
    const targetCollege = selectedCollege.trim();
    const targetTerm = searchTerm.trim().toLowerCase();

    return deptRankings
      .filter((row) => {
        const rowUniv = (row.univ_name || '').trim();
        const rowCollege = (row.college_name || '').trim();
        const rowDept = (row.dept_name || '').trim();
        const rowStudents = row.total_students || 0;

        const matchesUniv = targetUniv === 'ALL' || rowUniv === targetUniv;
        const matchesCollege = targetCollege === 'ALL' || rowCollege === targetCollege;
        const matchesMinStudents = rowStudents >= minStudents;
        const matchesSearch =
          !targetTerm ||
          rowUniv.toLowerCase().includes(targetTerm) ||
          rowCollege.toLowerCase().includes(targetTerm) ||
          rowDept.toLowerCase().includes(targetTerm);

        return matchesUniv && matchesCollege && matchesMinStudents && matchesSearch;
      })
      .sort((a, b) => {
        const numA = (a[sortField] as number) || 0;
        const numB = (b[sortField] as number) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      });
  }, [deptRankings, selectedUniv, selectedCollege, minStudents, searchTerm, sortField, sortOrder]);

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
    router.push(`/departments/${encodeURIComponent(univ.trim())}/${encodeURIComponent(dept.trim())}`);
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <span style={{ opacity: 0.25, marginLeft: '4px', fontSize: '11px' }}>⇅</span>;
    }
    return (
      <span style={{ marginLeft: '4px', fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 'bold' }}>
        {sortOrder === 'desc' ? '▼' : '▲'}
      </span>
    );
  };

  const getSortableHeaderStyle = (field: SortField, width: string) => {
    const isCurrent = sortField === field;
    return {
      width,
      padding: '14px 12px',
      textAlign: 'right' as const,
      cursor: 'pointer',
      userSelect: 'none' as const,
      color: isCurrent ? 'var(--accent-blue)' : 'var(--text-secondary)',
      fontWeight: isCurrent ? '700' : '600',
      transition: 'color 0.15s ease',
      whiteSpace: 'nowrap' as const
    };
  };

  const getStaticHeaderStyle = (width: string, align: 'left' | 'center' | 'right' = 'left') => {
    return {
      width,
      padding: '14px 12px',
      textAlign: align,
      color: 'var(--text-secondary)',
      fontWeight: '600',
      whiteSpace: 'nowrap' as const
    };
  };

  const ellipsisCellStyle = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', padding: '24px 12px', transition: 'background-color 0.2s' }}>
      
      <style>{`
        .desktop-view {
          display: block;
        }
        .mobile-view {
          display: none;
        }
        .mobile-sort-container {
          display: none;
        }

        /* 폼 요소 공통 클래스 */
        .unified-form-control {
          display: block !important;
          box-sizing: border-box !important;
          width: 100% !important;
          height: 46px !important;
          min-height: 46px !important;
          padding: 0 14px !important;
          font-size: 16px !important;
          line-height: normal !important;
          border: 1px solid var(--border-color) !important;
          border-radius: 8px !important;
          background-color: var(--card-bg) !important;
          color: var(--text-primary) !important;
          outline: none !important;
          margin: 0 !important;
        }

        .unified-toggle-container {
          display: flex !important;
          align-items: center !important;
          box-sizing: border-box !important;
          height: 46px !important;
          min-height: 46px !important;
          background-color: var(--border-color) !important;
          padding: 4px !important;
          border-radius: 8px !important;
          gap: 4px !important;
        }

        @media (min-width: 769px) {
          .unified-toggle-container {
            width: fit-content !important;
            min-width: 260px !important;
          }
          .unified-input-wrapper {
            flex: 1 !important;
            min-width: 200px !important;
          }
          .unified-select-wrapper {
            width: 180px !important;
          }
        }

        @media (max-width: 768px) {
          .desktop-view {
            display: none !important;
          }
          .mobile-view {
            display: flex !important;
            flex-direction: column;
            gap: 12px;
            padding: 12px;
          }
          .mobile-sort-container {
            display: flex !important;
            gap: 8px;
            width: 100%;
            margin-top: 4px;
          }
          .control-panel-wrapper {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .filter-group-wrapper {
            flex-direction: column !important;
            width: 100% !important;
            gap: 10px !important;
          }
          .unified-toggle-container {
            width: 100% !important;
          }
          .unified-toggle-btn {
            flex: 1 !important;
          }
          .unified-input-wrapper,
          .unified-select-wrapper {
            width: 100% !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* 상단 헤더 */}
        <header style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
              대학 학점 리더보드
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              대학알리미 공시 데이터 기반
            </p>
          </div>
          <ThemeToggle />
        </header>

        {/* 1차 탭: 리더보드 뷰 모드 전환 */}
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', gap: '8px' }}>
          <button
            onClick={() => handleViewModeChange('univ')}
            style={{
              padding: '10px 18px',
              fontSize: '14px',
              fontWeight: 'bold',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: viewMode === 'univ' ? 'var(--accent-blue)' : 'var(--text-muted)',
              borderBottom: viewMode === 'univ' ? '3px solid var(--accent-blue)' : '3px solid transparent',
              marginBottom: '-2px',
              transition: 'all 0.15s ease'
            }}
          >
            학교별 랭킹
          </button>
          <button
            onClick={() => handleViewModeChange('dept')}
            style={{
              padding: '10px 18px',
              fontSize: '14px',
              fontWeight: 'bold',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: viewMode === 'dept' ? 'var(--accent-blue)' : 'var(--text-muted)',
              borderBottom: viewMode === 'dept' ? '3px solid var(--accent-blue)' : '3px solid transparent',
              marginBottom: '-2px',
              transition: 'all 0.15s ease'
            }}
          >
            학과별 랭킹
          </button>
        </div>

        {/* 제어 패널 (완벽한 폭/높이 일치) */}
        <div className="control-panel-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          
          <div className="filter-group-wrapper" style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '280px', flexWrap: 'wrap', alignItems: 'center' }}>
            
            {viewMode === 'univ' && (
              <div className="unified-toggle-container">
                {(['전체', '전공', '교양'] as const).map((type) => (
                  <button
                    key={type}
                    className="unified-toggle-btn"
                    onClick={() => handleCourseFilterChange(type)}
                    style={{
                      height: '38px',
                      padding: '0 16px',
                      fontSize: '13px',
                      fontWeight: '600',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: courseFilter === type ? 'var(--card-bg)' : 'transparent',
                      color: courseFilter === type ? 'var(--accent-blue)' : 'var(--text-muted)',
                      boxShadow: courseFilter === type ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {type === '전체' ? '전체 교과' : `${type}만`}
                  </button>
                ))}
              </div>
            )}

            {viewMode === 'dept' && (
              <>
                <div className="unified-select-wrapper">
                  <select
                    className="unified-form-control"
                    value={selectedUniv}
                    onChange={(e) => handleUnivChange(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="ALL">전체 대학교</option>
                    {universityList.map((univ) => (
                      <option key={univ} value={univ}>{univ}</option>
                    ))}
                  </select>
                </div>

                <div className="unified-select-wrapper">
                  <select
                    className="unified-form-control"
                    value={selectedCollege}
                    onChange={(e) => handleCollegeChange(e.target.value)}
                    disabled={collegeList.length === 0}
                    style={{
                      cursor: collegeList.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: collegeList.length === 0 ? 0.6 : 1
                    }}
                  >
                    <option value="ALL">{collegeList.length === 0 ? '단과대학 없음' : '전체 단과대학'}</option>
                    {collegeList.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div className="unified-select-wrapper">
                  <select
                    className="unified-form-control"
                    value={minStudents}
                    onChange={(e) => handleMinStudentsChange(Number(e.target.value))}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value={0}>수강 인원 전체</option>
                    <option value={30}>30명 이상</option>
                    <option value={50}>50명 이상</option>
                    <option value={100}>100명 이상</option>
                    <option value={200}>200명 이상</option>
                    <option value={500}>500명 이상</option>
                  </select>
                </div>
              </>
            )}

            <div className="unified-input-wrapper">
              <input
                type="text"
                className="unified-form-control"
                placeholder={viewMode === 'univ' ? '학교명 검색' : '학과명 또는 키워드 검색'}
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>

          {/* 모바일 전용 정렬 버튼 바 */}
          <div className="mobile-sort-container">
            <button
              onClick={() => handleSort('avg_gpa')}
              style={{
                flex: 1,
                height: '44px',
                padding: '0 8px',
                fontSize: '13px',
                fontWeight: '600',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: sortField === 'avg_gpa' ? 'var(--border-color)' : 'var(--card-bg)',
                color: sortField === 'avg_gpa' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              평균 평점 {renderSortIndicator('avg_gpa')}
            </button>
            <button
              onClick={() => handleSort('a_grade_ratio')}
              style={{
                flex: 1,
                height: '44px',
                padding: '0 8px',
                fontSize: '13px',
                fontWeight: '600',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: sortField === 'a_grade_ratio' ? 'var(--border-color)' : 'var(--card-bg)',
                color: sortField === 'a_grade_ratio' ? 'var(--accent-green)' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              A학점 비율 {renderSortIndicator('a_grade_ratio')}
            </button>
          </div>
        </div>

        {/* 상태 요약 바 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
          <div>
            {viewMode === 'univ' ? (
              <>기준: <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{courseFilter === '전체' ? '전체(전공+교양)' : `${courseFilter} 과목`}</span></>
            ) : (
              <>
                기준: <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>전공 과목</span>
                {minStudents > 0 && (
                  <span style={{ marginLeft: '4px', color: 'var(--accent-blue)', fontWeight: '600' }}>
                    ({minStudents}명 이상)
                  </span>
                )}
              </>
            )}
          </div>
          <div>
            표시: <span style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>
              {Math.min(visibleCount, activeDataLength)}
            </span> / {activeDataLength}개
          </div>
        </div>

        {/* 리더보드 테이블 카드 */}
        <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
              데이터를 불러오는 중입니다...
            </div>
          ) : viewMode === 'univ' ? (
            
            /* ================= 1. 대학교 리더보드 ================= */
            visibleUnivRankings.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                해당 조건의 대학교 데이터가 없습니다.
              </div>
            ) : (
              <>
                {/* [데스크톱 뷰] 7열 테이블 */}
                <div className="desktop-view" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '760px', tableLayout: 'fixed', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--table-header-bg)', fontSize: '14px' }}>
                        <th style={getStaticHeaderStyle('60px', 'center')}>순위</th>
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
                              fontSize: '14px',
                              backgroundColor: 'var(--card-bg)',
                              transition: 'background-color 0.15s ease'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--card-hover)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--card-bg)')}
                          >
                            <td style={{ padding: '14px 12px', textAlign: 'center', fontWeight: 'bold' }}>
                              <span style={{
                                display: 'inline-block',
                                width: '26px',
                                height: '26px',
                                lineHeight: '26px',
                                borderRadius: '50%',
                                backgroundColor: isTopThree ? 'var(--border-color)' : 'transparent',
                                color: isTopThree ? 'var(--accent-blue)' : 'var(--text-muted)',
                                fontSize: '13px'
                              }}>
                                {index + 1}
                              </span>
                            </td>
                            <td title={cleanUniv} style={{ ...ellipsisCellStyle, padding: '14px 12px', fontWeight: '600', color: 'var(--text-primary)', fontSize: '15px' }}>
                              {cleanUniv}
                            </td>
                            <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                              <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                                {row.course_type}
                              </span>
                            </td>
                            <td style={{ padding: '14px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {row.course_type === '교양' ? '-' : `${row.total_depts}개`}
                            </td>
                            <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: sortField === 'avg_gpa' ? 'bold' : 'normal', color: sortField === 'avg_gpa' ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                              {row.avg_gpa ? row.avg_gpa.toFixed(2) : '0.00'} <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ 4.3</span>
                            </td>
                            <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: sortField === 'a_grade_ratio' ? 'bold' : 'normal', color: sortField === 'a_grade_ratio' ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                              {row.a_grade_ratio !== null ? `${row.a_grade_ratio.toFixed(1)}%` : '-'}
                            </td>
                            <td style={{ padding: '14px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {(row.total_students || 0).toLocaleString()}명
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* [모바일 뷰] 카드형 리스트 */}
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
                          padding: '14px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              display: 'inline-block',
                              width: '24px',
                              height: '24px',
                              lineHeight: '24px',
                              textAlign: 'center',
                              borderRadius: '50%',
                              backgroundColor: isTopThree ? 'var(--border-color)' : 'transparent',
                              color: isTopThree ? 'var(--accent-blue)' : 'var(--text-muted)',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              {index + 1}
                            </span>
                            <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                              {cleanUniv}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                            {row.course_type}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', backgroundColor: 'var(--table-header-bg)', padding: '10px', borderRadius: '6px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>평균 평점</div>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: sortField === 'avg_gpa' ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                              {row.avg_gpa ? row.avg_gpa.toFixed(2) : '0.00'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>A학점 비율</div>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: sortField === 'a_grade_ratio' ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                              {row.a_grade_ratio !== null ? `${row.a_grade_ratio.toFixed(1)}%` : '-'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>수강 학생</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>
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
            
            /* ================= 2. 학과별 리더보드 ================= */
            visibleDeptRankings.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                선택한 조건과 일치하는 학과 데이터가 없습니다.
              </div>
            ) : (
              <>
                {/* [데스크톱 뷰] 7열 테이블 */}
                <div className="desktop-view" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '780px', tableLayout: 'fixed', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--table-header-bg)', fontSize: '14px' }}>
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
                              fontSize: '14px',
                              backgroundColor: 'var(--card-bg)',
                              transition: 'background-color 0.15s ease'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--card-hover)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--card-bg)')}
                          >
                            <td style={{ padding: '14px 10px', textAlign: 'center', fontWeight: 'bold' }}>
                              <span style={{
                                display: 'inline-block',
                                width: '26px',
                                height: '26px',
                                lineHeight: '26px',
                                borderRadius: '50%',
                                backgroundColor: isTopThree ? 'var(--border-color)' : 'transparent',
                                color: isTopThree ? 'var(--accent-blue)' : 'var(--text-muted)',
                                fontSize: '13px'
                              }}>
                                {index + 1}
                              </span>
                            </td>
                            <td title={cleanUniv} style={{ ...ellipsisCellStyle, padding: '14px 10px', color: 'var(--text-secondary)' }}>
                              {cleanUniv}
                            </td>
                            <td title={cleanCollege} style={{ ...ellipsisCellStyle, padding: '14px 10px', color: 'var(--text-muted)' }}>
                              {cleanCollege}
                            </td>
                            <td title={cleanDept} style={{ ...ellipsisCellStyle, padding: '14px 10px', fontWeight: '600', color: 'var(--text-primary)' }}>
                              {cleanDept}
                            </td>
                            <td style={{
                              padding: '14px 10px',
                              textAlign: 'right',
                              fontWeight: sortField === 'avg_gpa' ? 'bold' : 'normal',
                              color: sortField === 'avg_gpa' ? 'var(--accent-blue)' : 'var(--text-primary)',
                              whiteSpace: 'nowrap'
                            }}>
                              {row.avg_gpa ? row.avg_gpa.toFixed(2) : '0.00'} <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ 4.3</span>
                            </td>
                            <td style={{
                              padding: '14px 10px',
                              textAlign: 'right',
                              fontWeight: sortField === 'a_grade_ratio' ? 'bold' : 'normal',
                              color: sortField === 'a_grade_ratio' ? 'var(--accent-green)' : 'var(--text-primary)',
                              whiteSpace: 'nowrap'
                            }}>
                              {row.a_grade_ratio !== null && row.a_grade_ratio !== undefined ? `${row.a_grade_ratio.toFixed(1)}%` : '-'}
                            </td>
                            <td style={{ padding: '14px 10px', textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {(row.total_students || 0).toLocaleString()}명
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* [모바일 뷰] 카드형 리스트 */}
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
                          padding: '14px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <span style={{
                            display: 'inline-block',
                            width: '24px',
                            height: '24px',
                            lineHeight: '24px',
                            textAlign: 'center',
                            borderRadius: '50%',
                            backgroundColor: isTopThree ? 'var(--border-color)' : 'transparent',
                            color: isTopThree ? 'var(--accent-blue)' : 'var(--text-muted)',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            flexShrink: 0
                          }}>
                            {index + 1}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '2px' }}>
                              {cleanDept}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {cleanUniv} {cleanCollege ? `· ${cleanCollege}` : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', backgroundColor: 'var(--table-header-bg)', padding: '10px', borderRadius: '6px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>평균 평점</div>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: sortField === 'avg_gpa' ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                              {row.avg_gpa ? row.avg_gpa.toFixed(2) : '0.00'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>A학점 비율</div>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: sortField === 'a_grade_ratio' ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                              {row.a_grade_ratio !== null ? `${row.a_grade_ratio.toFixed(1)}%` : '-'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>총 수강생</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>
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

          {/* 하단 + 10개 더보기 버튼 영역 */}
          {!loading && hasMore && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '16px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--table-header-bg)'
            }}>
              <button
                onClick={handleLoadMore}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%',
                  maxWidth: '320px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
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