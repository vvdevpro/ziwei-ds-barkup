'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';

/**
 * 极简站内导航：排盘 / 合盘 / 古籍 + 亮暗切换。
 *
 * 首页改成直接跳 /chart 之后，营销页上的导航也没了，这里补一条最薄的、
 * 在各功能页都能用的顶栏。只在功能页挂，书目页 / 知识页各自有自己的顶栏。
 */

const LINKS = [
  { href: '/chart', label: '排盘' },
  { href: '/heming', label: '合盘' },
  { href: '/library', label: '古籍' },
];

export default function SiteNav() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  return (
    <header
      className="no-print"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 20px',
        borderBottom: '1px solid var(--bdr)',
        background: 'color-mix(in srgb, var(--bg-0) 88%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <Link
        href="/chart"
        style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.22em',
          color: 'var(--ac)',
          textDecoration: 'none',
        }}
      >
        紫微斗数
      </Link>

      <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {LINKS.map(link => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: '5px 12px',
                borderRadius: 999,
                fontSize: 12,
                letterSpacing: '0.08em',
                textDecoration: 'none',
                color: active ? 'var(--ac)' : 'var(--tx-2)',
                background: active ? 'var(--ac-bg)' : 'transparent',
                border: `1px solid ${active ? 'var(--ac-bdr)' : 'transparent'}`,
                transition: 'color .15s ease, background .15s ease',
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={toggle}
        aria-label="切换亮暗主题"
        style={{
          padding: '5px 12px',
          borderRadius: 999,
          fontSize: 12,
          cursor: 'pointer',
          color: 'var(--tx-2)',
          background: 'transparent',
          border: '1px solid var(--bdr-med)',
        }}
      >
        {theme === 'dark' ? '暗色' : '亮色'}
      </button>
    </header>
  );
}
