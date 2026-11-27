// 어두운 구역 배경에 옅게 깔리는 네트워크 연결 그림 (장식용, 동작 없음)
const NODES = [
  [60, 80], [210, 40], [330, 150], [180, 260], [70, 380], [300, 420], [460, 300], [520, 120],
  [680, 60], [760, 220], [640, 380], [860, 420], [930, 110], [1050, 260], [1140, 70], [1120, 430],
];
const LINKS = [
  [0, 1], [1, 2], [0, 3], [2, 3], [3, 4], [4, 5], [3, 5], [5, 6], [2, 6], [2, 7], [7, 8], [6, 9],
  [7, 9], [9, 10], [6, 10], [10, 11], [9, 12], [8, 12], [12, 13], [11, 13], [13, 14], [12, 14], [13, 15], [11, 15],
];

export default function NetArt({ className = '' }) {
  return (
    <svg className={'net-art ' + className} viewBox="0 0 1200 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1" fill="none" opacity=".55">
        {LINKS.map(([a, b], i) => (
          <line key={i} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} />
        ))}
      </g>
      <g fill="currentColor">
        {NODES.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 4 === 0 ? 5 : 3} />)}
      </g>
      <g stroke="currentColor" fill="none" opacity=".6">
        {[2, 9, 13].map(i => <circle key={i} cx={NODES[i][0]} cy={NODES[i][1]} r="14" />)}
      </g>
    </svg>
  );
}
