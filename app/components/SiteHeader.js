'use client';

import { useState } from 'react';

// 공통 머리글 (화면 모양 전용)
// - 맨 위 작은 띠: gabia.com처럼 로그인·회원가입 / 이름·설정·로그아웃
// - 로고 + 큰 메뉴 + 마우스를 올리면 펼쳐지는 전체 메뉴: kfenc.com 방식
// - 휴대폰에서는 오른쪽 위 메뉴 버튼으로 열고 닫아요
//
// util:   [{ text }] 또는 [{ label, onClick, href, on, title }]
// groups: [{ key, label, active, onClick, href, items: [{ key, label, active, onClick, href }] }]
// right:  오른쪽에 넣을 내용 (예: 오늘 날짜)
export default function SiteHeader({ util = [], groups = [], onBrandClick, right = null }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasMega = groups.some(g => g.items && g.items.length > 0);

  // 링크를 누르면 원래 동작을 그대로 실행 (주소가 있으면 그 자리로 이동)
  const run = (entry, closeMobile) => (e) => {
    if (!entry.href) e.preventDefault();
    if (closeMobile) setMobileOpen(false);
    if (entry.onClick) entry.onClick();
  };

  return (
    <header className="site-header">
      <div className="util-bar">
        <div className="wrap util-in">
          {util.map((u, i) => u.text ? (
            <span key={i} className="util-user">{u.text}</span>
          ) : (
            <a key={i} href={u.href || '#'} className={'util-link' + (u.on ? ' on' : '')} title={u.title} onClick={run(u, false)}>
              {u.label}
            </a>
          ))}
        </div>
      </div>

      <div className="wrap head-row">
        <a href="#" className="logo" onClick={e => { e.preventDefault(); if (onBrandClick) onBrandClick(); }}>
          <img
            src="/logo.gif"
            alt="회사 로고"
            onError={e => {
              if (!e.currentTarget.dataset.retried) {
                e.currentTarget.dataset.retried = '1';
                e.currentTarget.src = '/logo.gif?retry=' + Date.now();
              } else {
                e.currentTarget.style.display = 'none';
              }
            }}
          />
          <span className="logo-txt">
            <b>안전보건 <em>통합관리시스템</em></b>
            <small>SAFETY &amp; HEALTH MANAGEMENT</small>
          </span>
        </a>

        <nav className="gnb" aria-label="주 메뉴">
          <ul>
            {groups.map(g => (
              <li key={g.key}>
                <a href={g.href || '#'} className={g.active ? 'on' : undefined} onClick={run(g, false)}>{g.label}</a>
              </li>
            ))}
          </ul>
          {hasMega && (
            <div className="mega">
              <div className="wrap head-row">
                <div />
                <div className="mega-cols">
                  {groups.map(g => (
                    <ul key={g.key}>
                      {(g.items || []).map(it => (
                        <li key={it.key}>
                          <a href={it.href || '#'} className={it.active ? 'on' : undefined} onClick={run(it, false)}>{it.label}</a>
                        </li>
                      ))}
                    </ul>
                  ))}
                </div>
                <div />
              </div>
            </div>
          )}
        </nav>

        <div className="head-right">{right}</div>

        {groups.length > 0 && (
          <button
            type="button"
            className="menu-btn"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}
            onClick={() => setMobileOpen(v => !v)}
          >
            <span />
          </button>
        )}
      </div>

      {mobileOpen && (
        <nav className="m-nav" aria-label="휴대폰 메뉴">
          {groups.map(g => (g.items && g.items.length > 1) ? (
            <details key={g.key} open={g.active}>
              <summary>{g.label}</summary>
              <ul>
                {g.items.map(it => (
                  <li key={it.key}>
                    <a href={it.href || '#'} className={it.active ? 'on' : undefined} onClick={run(it, true)}>{it.label}</a>
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <a key={g.key} href={g.href || '#'} className={'m-link' + (g.active ? ' on' : '')} onClick={run(g, true)}>{g.label}</a>
          ))}
        </nav>
      )}
    </header>
  );
}

// 머리글 오른쪽: 오늘 날짜 (kfenc의 대표번호 자리)
export function TodayBadge() {
  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  return (
    <>
      <small>오늘</small>
      <b>{today}</b>
    </>
  );
}
