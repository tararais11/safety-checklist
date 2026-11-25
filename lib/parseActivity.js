// 한글(HWP)에서 복사한 "연간 안전보건 목표 추진계획" 표를 읽어 활동 항목으로 바꿔요.
// 한글은 표를 복사하면 클립보드에 HTML 표(병합된 칸 포함)를 같이 넣어줘요. 그걸 읽어요.

const clean = (s) => (s || '').replace(/[ \t ]+/g, ' ').trim();
const key = (s) => clean(s).replace(/\s/g, '');
const stripBullet = (s) => clean(s).replace(/^[‣•▪·\-–>]+\s*/, '');
const MARK = /[◉●○◎■□✓✔]|^\s*[OoVv]\s*$/;

function cellText(td) {
  const c = td.cloneNode(true);
  c.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
  c.querySelectorAll('p,div,li').forEach((p) => p.append('\n'));
  return c.textContent
    .split('\n')
    .map(clean)
    .filter(Boolean)
    .join(' ');
}

// 병합(rowspan/colspan)된 칸을 풀어서 바둑판 모양으로 만들어요
function tableToGrid(table) {
  const grid = [];
  [...table.rows].forEach((tr, r) => {
    grid[r] = grid[r] || [];
    let c = 0;
    [...tr.cells].forEach((td) => {
      while (grid[r][c] !== undefined) c++;
      const text = cellText(td);
      const rs = Math.max(1, Number(td.rowSpan) || 1);
      const cs = Math.max(1, Number(td.colSpan) || 1);
      for (let dr = 0; dr < rs; dr++) {
        grid[r + dr] = grid[r + dr] || [];
        for (let dc = 0; dc < cs; dc++) grid[r + dr][c + dc] = text;
      }
      c += cs;
    });
  });
  return grid.map((row) => Array.from(row, (v) => v || ''));
}

function findCols(grid) {
  const isQ = (t) => /^[1-4]\/4(분기)?$/.test(key(t)) || /^[1-4]분기$/.test(key(t));
  const hEnd = grid.findIndex((row) => row.some(isQ));
  if (hEnd < 0) return null;
  let hStart = hEnd;
  while (hStart > 0 && grid[hStart - 1].some((t) => /추진|세부|구분|목표|담당/.test(key(t)))) hStart--;
  const width = Math.max(...grid.map((r) => r.length));
  const labels = Array.from({ length: width }, (_, c) => {
    const seen = [];
    for (let r = hStart; r <= hEnd; r++) {
      const t = key(grid[r]?.[c]);
      if (t && !seen.includes(t)) seen.push(t);
    }
    return seen.join('|');
  });
  const find = (re) => labels.findIndex((l) => re.test(l));
  const q = [1, 2, 3, 4].map((k) => labels.findIndex((l) => new RegExp(`(^|\\|)(${k}/4|${k}분기)`).test(l)));
  const content = labels.map((l, i) => (/내용/.test(l) ? i : -1)).filter((i) => i >= 0);
  const cols = {
    hEnd,
    q,
    content,
    item: find(/항목/),
    target: find(/성과|지표/),
    owner: find(/담당/),
    budget: find(/예산/),
    note: find(/비고/),
  };
  cols.area = [0].find((i) => i !== cols.item && !content.includes(i)) ?? -1;
  if (content.length === 0 && cols.item >= 0) cols.content = [cols.item];
  return cols;
}

function parseGrid(grid, prevCols) {
  const found = findCols(grid);
  const cols = found || prevCols;
  if (!cols) return { cols: null, items: [] };
  const start = found ? found.hEnd + 1 : 0;
  const items = [];
  for (let r = start; r < grid.length; r++) {
    const row = grid[r];
    const t = (i) => (i >= 0 ? clean(row[i]) : '');
    if (row.some((v) => /추진일정|세부추진계획/.test(key(v)))) continue;
    const parts = [];
    cols.content.forEach((i) => {
      const s = stripBullet(row[i]);
      if (s && !parts.includes(s)) parts.push(s);
    });
    if (parts.length === 0) continue;
    const quarters = cols.q.map((i) => (i >= 0 ? MARK.test(t(i)) : false));
    const months = cols.q
      .map((i) => (t(i).match(/\d{1,2}월/g) || []).join(','))
      .filter(Boolean)
      .join(', ');
    const item = {
      kind: 'plan',
      area: t(cols.area),
      group: stripBullet(t(cols.item)),
      title: parts.join(' - '),
      detail: t(cols.target),
      quarters,
      months,
      owner: t(cols.owner),
      budget: t(cols.budget),
      note: t(cols.note),
      status: '예정',
    };
    const prev = items[items.length - 1];
    if (prev && prev.title === item.title && prev.area === item.area) {
      prev.quarters = prev.quarters.map((v, k) => v || quarters[k]); // 같은 항목이 여러 줄로 나뉜 경우 합치기
      continue;
    }
    items.push(item);
  }
  return { cols, items };
}

export function parseActivityClipboard(html, text) {
  let grids = [];
  if (html && /<table/i.test(html)) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    grids = [...doc.querySelectorAll('table')].filter((t) => !t.parentElement?.closest('table')).map(tableToGrid);
  } else if (text && text.includes('\t')) {
    grids = [text.split(/\r?\n/).map((l) => l.split('\t'))];
  } else {
    throw new Error('표 구조를 읽지 못했어요. 한글에서 표를 블록으로 지정해 복사(Ctrl + C)한 다음 바로 붙여넣어 주세요.');
  }
  let cols = null;
  const items = [];
  grids.forEach((g) => {
    const res = parseGrid(g, cols);
    if (res.cols) cols = res.cols;
    items.push(...res.items);
  });
  if (!cols) throw new Error('표 제목 줄(1/4, 2/4 같은 분기 칸)을 찾지 못했어요. 표 머리글까지 같이 복사해 주세요.');
  if (items.length === 0) throw new Error('표에서 활동 항목을 하나도 찾지 못했어요.');
  return { items };
}
