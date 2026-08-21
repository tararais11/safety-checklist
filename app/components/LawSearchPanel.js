'use client';

import { useState } from 'react';
import { LAW_INDEX, lawSearchUrl } from '../../lib/lawData';

export default function LawSearchPanel() {
  const [activeLawCategory, setActiveLawCategory] = useState(null);
  const [expandedArticle, setExpandedArticle] = useState(null);

  const lawNames = Object.keys(LAW_INDEX);
  const currentLaw = activeLawCategory && lawNames.includes(activeLawCategory) ? activeLawCategory : lawNames[0];
  const articles = LAW_INDEX[currentLaw];

  return (
    <>
      <div className="tabs">
        {lawNames.map(name => (
          <div key={name} className={"tab" + (currentLaw === name ? " active" : "")} onClick={() => setActiveLawCategory(name)}>
            {name}
            <span className="count">{LAW_INDEX[name].length}</span>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>{currentLaw}</h2>
          <div className="cycle-label">조문을 클릭하면 바로 아래에 원문이 펼쳐져요</div>
        </div>
        {articles.map(a => {
          const key = `${currentLaw}|${a.no}`;
          const isOpen = expandedArticle === key;
          return (
            <div key={a.no}>
              <div
                className="item"
                style={{cursor:'pointer'}}
                onClick={() => setExpandedArticle(isOpen ? null : key)}
              >
                <div className="item-body">
                  <div className="item-name">{a.no} ({a.title})</div>
                  {!a.text && <div className="item-meta">원문 준비 중 — 클릭 시 law.go.kr에서 확인</div>}
                  {a.text && <div className="item-meta">{isOpen ? '접기' : '펼쳐서 원문 보기'}</div>}
                </div>
                <div className="item-actions">
                  <span className="icon-btn">{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>
              {isOpen && (
                <div style={{
                  background:'#fbfaf6', border:'1px solid var(--line)', borderRadius:4,
                  padding:'14px 16px', margin:'2px 0 10px', fontSize:13, lineHeight:1.75,
                  whiteSpace:'pre-wrap', color:'#2a2f3a',
                }}>
                  {a.text ? (
                    <>
                      {a.text}
                      <div style={{marginTop:12, fontSize:11.5, color:'var(--muted)'}}>
                        확인일: {a.lastChecked} · 개정 여부는{' '}
                        <a href={lawSearchUrl(currentLaw, a.no)} target="_blank" rel="noopener noreferrer" style={{color:'var(--safety)'}}>
                          law.go.kr 최신 원문
                        </a>
                        에서 다시 확인하세요.
                      </div>
                    </>
                  ) : (
                    <>
                      아직 이 조문의 원문은 앱에 넣어두지 않았어요.{' '}
                      <a href={lawSearchUrl(currentLaw, a.no)} target="_blank" rel="noopener noreferrer" style={{color:'var(--safety)'}}>
                        law.go.kr에서 바로 확인하기 ↗
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div className="footer-note" style={{marginTop:6}}>
          원문은 특정 시점 기준 스냅샷이에요. 법이 개정될 수 있으니 중요한 판단은 law.go.kr 최신본으로 다시 확인하세요.
        </div>
      </div>
    </>
  );
}
