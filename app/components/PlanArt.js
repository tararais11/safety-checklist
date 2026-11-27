// 첫 화면·제목 띠 오른쪽에 옅게 깔리는 건설 도면 느낌의 선 그림 (장식용, 동작 없음)
export default function PlanArt({ className = '' }) {
  return (
    <svg className={'plan ' + className} viewBox="0 0 640 420" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      {/* 기둥 줄 기준선과 번호 */}
      {[60, 180, 300, 420, 540].map((x, i) => (
        <g key={x}>
          <path d={`M${x} 46V404`} strokeDasharray="10 6" opacity=".55" />
          <circle cx={x} cy="28" r="14" />
          <text x={x} y="33" fill="currentColor" stroke="none" fontSize="13" textAnchor="middle">{i + 1}</text>
        </g>
      ))}
      {[120, 210, 300, 390].map(y => <path key={y} d={`M30 ${y}H600`} strokeDasharray="10 6" opacity=".4" />)}
      {/* 건물 단면 */}
      <rect x="180" y="120" width="360" height="270" strokeWidth="1.6" />
      <path d="M180 187.5H540M180 255H540M180 322.5H540" strokeWidth="1.4" />
      <path d="M300 120V390M420 120V390" strokeWidth="1.4" />
      <path d="M196 390V350h28v40M456 390V346h36v44" />
      {/* 비계 */}
      <path d="M164 120V390M150 120V390M150 140h14M150 175h14M150 210h14M150 245h14M150 280h14M150 315h14M150 350h14" opacity=".8" />
      {/* 타워 크레인 */}
      <path d="M600 404V60M612 404V60M600 90l12-20M600 130l12-20M600 170l12-20M600 210l12-20M600 250l12-20M600 290l12-20M600 330l12-20M600 370l12-20" />
      <path d="M470 60H640M470 72H612M606 60l-60 -26M606 60l34 -26" />
      <path d="M500 72v64" strokeDasharray="3 3" />
      <rect x="490" y="136" width="20" height="14" />
      {/* 치수선 */}
      <path d="M180 410H540M180 402v16M540 402v16" />
      <text x="360" y="406" fill="currentColor" stroke="none" fontSize="12" textAnchor="middle">36,000</text>
      {/* 안전 표지 */}
      <path d="M78 300l26 46H52z" strokeWidth="1.6" />
      <path d="M78 318v14M78 337v2" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
