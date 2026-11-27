import PlanArt from './PlanArt';

// 하위 화면 맨 위 제목 띠 + 하위 탭 (kfenc.com 하위 페이지 방식, 화면 모양 전용)
// crumbs: ['자료실', '법령검색'] 처럼 '홈' 다음 경로
// tabs:   [{ key, label, active, onClick }] 같은 묶음 안의 다른 화면으로 가는 탭
export default function PageHead({ crumbs = [], title, lead, tabs = [] }) {
  return (
    <>
      <section className="page-head">
        <PlanArt />
        <div className="wrap">
          <p className="crumb">
            {['홈', ...crumbs].map((c, i) => (
              <span key={i}>{i > 0 && <i>›</i>}{c}</span>
            ))}
          </p>
          <h1>{title}</h1>
          {lead && <p className="lead">{lead}</p>}
        </div>
      </section>
      {tabs.length > 1 && (
        <nav className="lnb" aria-label="하위 메뉴">
          <div className="wrap">
            <ul>
              {tabs.map(t => (
                <li key={t.key}>
                  <a href="#" aria-current={t.active ? 'page' : undefined} onClick={e => { e.preventDefault(); t.onClick(); }}>
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}
    </>
  );
}
