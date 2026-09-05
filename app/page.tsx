'use client';

import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';
import { GpaPercentileCalculator, UnivRankingItem } from '@/components/GpaPercentileCalculator';
import { LeaderboardSection } from '@/components/LeaderboardSection';

function HomeContent() {
  const [univRankings, setUnivRankings] = useState<UnivRankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUnivData() {
      setLoading(true);
      const { data } = await supabase.from('university_rankings').select('*');
      if (data) {
        setUnivRankings(data);
      }
      setLoading(false);
    }
    fetchUnivData();
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', padding: '16px 12px', transition: 'background-color 0.2s' }}>
      <div
        style={{
          maxWidth: '1120px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          transition: 'max-width 0.25s ease'
        }}
      >
        {/* 상단 네비게이션 */}
        <Navbar />

        {/* 메인 영역 */}
        <main style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {loading ? (
            <div
              style={{
                backgroundColor: 'var(--card-bg)',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '14px',
                maxWidth: '780px',
                margin: '0 auto',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              대학교 성적 데이터를 불러오는 중입니다...
            </div>
          ) : (
            <>
              {/* 학점 백분위 변환기 (자체 애니메이션 아코디언 토글 내장) */}
              <div style={{ width: '100%', marginBottom: '16px' }}>
                <GpaPercentileCalculator univRankings={univRankings} defaultOpen={true} />
              </div>

              {/* 리더보드 직접 렌더링 */}
              <div style={{ width: '100%' }}>
                <LeaderboardSection />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
          페이지를 불러오는 중입니다...
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
