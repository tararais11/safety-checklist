// 검정 선 + 빨간 포인트 두 가지 색 아이콘 (표시용). 빨간 부분은 className="acc"
const base = { viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const LINE_ICONS = {
  checklist: (
    <svg {...base}>
      <rect x="11" y="9" width="26" height="33" rx="2" />
      <rect x="18" y="6" width="12" height="6" rx="1.5" />
      <path className="acc" d="M17 24l5 5 9-10" />
      <path d="M17 35h14" />
    </svg>
  ),
  eval: (
    <svg {...base}>
      <circle cx="18" cy="17" r="6" />
      <path d="M6 39c0-7 5.4-12.5 12-12.5S30 32 30 39" />
      <circle className="acc" cx="35" cy="17" r="7" />
      <path className="acc" d="M31.8 17l2.2 2.2 4.2-4.4" />
    </svg>
  ),
  law: (
    <svg {...base}>
      <path d="M24 7v32" /><path d="M10 14h28" />
      <path d="M10 14L5 25a5 5 0 0 0 10 0L10 14z" /><path d="M38 14l-5 11a5 5 0 0 0 10 0L38 14z" />
      <path className="acc" d="M15 41h18" />
    </svg>
  ),
  folder: (
    <svg {...base}>
      <path d="M6 13a3 3 0 0 1 3-3h9l4 4h17a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" />
      <path className="acc" d="M16 27h16M24 21v12" />
    </svg>
  ),
  notice: (
    <svg {...base}>
      <path d="M8 20v8a2 2 0 0 0 2 2h4l11 8V10l-11 8h-4a2 2 0 0 0-2 2z" />
      <path className="acc" d="M32 18a8 8 0 0 1 0 12" /><path className="acc" d="M37 13a15 15 0 0 1 0 22" />
    </svg>
  ),
  shield: (
    <svg {...base}>
      <path d="M24 5l15 6v11c0 10-6.6 17.4-15 21-8.4-3.6-15-11-15-21V11z" />
      <path className="acc" d="M17 24l5 5 9-10" />
    </svg>
  ),
  result: (
    <svg {...base}>
      <rect x="8" y="8" width="32" height="32" rx="2" />
      <path d="M15 32V24M22 32V18M29 32V26" />
      <path className="acc" d="M15 18l7-5 7 6 6-5" />
    </svg>
  ),
};
