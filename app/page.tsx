'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';
import { GpaPercentileCalculator, UnivRankingItem } from '@/components/GpaPercentileCalculator';

export default function HomePage() {
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
      <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        {/* 상단 네비게이션 */}
        <Navbar />

        {/* 메인 계산기 영역 */}
        <main>
          {loading ? (
            <div
              style={{
                backgroundColor: 'var(--card-bg)',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '14px'
              }}
            >
              대학교 성적 데이터를 불러오는 중입니다...
            </div>
          ) : (
            <>
              <GpaPercentileCalculator univRankings={univRankings} />

              {/* 하단 리더보드 이동 카드/버튼 */}
              <Link
                href="/leaderboard"
                style={{
                  marginTop: '16px',
                  padding: '16px 20px',
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      flexShrink: 0
                    }}
                  >
                    🏆
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      전국 대학교 학점 리더보드
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      4.3 / 4.5 만점 체계별 대학교 및 학과 순위 한눈에 확인하기
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--accent-blue)',
                    backgroundColor: 'var(--table-header-bg)',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>순위 보러가기</span>
                  <span>→</span>
                </div>
              </Link>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
