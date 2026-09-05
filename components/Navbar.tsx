'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';

export function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === '/';

  return (
    <header
      style={{
        padding: '12px 0',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        borderBottom: '1px solid var(--border-color)'
      }}
    >
      {/* 로고 & 브랜딩 */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
            color: '#ffffff'
          }}
        >
          🎓
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              학점랭크
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-blue)', letterSpacing: '-0.2px' }}>
              UnivRank
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
            대학알리미 공식 데이터 기반
          </p>
        </div>
      </Link>

      {/* 우측 컨트롤 (홈이 아닐 때는 계산기 바로가기 제공 + 테마 토글) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {!isHome && (
          <Link
            href="/"
            style={{
              height: '30px',
              padding: '0 10px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '7px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'var(--table-header-bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              transition: 'all 0.15s ease'
            }}
          >
            <span>🎯</span>
            <span>백분위 계산기</span>
          </Link>
        )}

        {/* 테마 토글 버튼 */}
        <ThemeToggle />
      </div>
    </header>
  );
}

