// 안전보건예산 엑셀(「안전보건예산 내역」 시트 양식)을 읽어 대시보드용 숫자로 바꿔요.
// 브라우저에서만 실행돼요. 파일은 서버로 올라가지 않아요.

function cellValue(cell) {
  const v = cell?.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if (v instanceof Date) return v;
    if ('result' in v) return v.result ?? null; // 수식: 계산된 값
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return v.text; // 하이퍼링크
    if ('error' in v) return null;
    return null;
  }
  return v;
}

const txt = (v) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim());
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

function toGrid(ws) {
  const grid = [];
  const rc = ws.rowCount;
  const cc = ws.columnCount;
  for (let r = 1; r <= rc; r++) {
    const row = ws.getRow(r);
    const arr = [];
    for (let c = 1; c <= cc; c++) arr.push(cellValue(row.getCell(c)));
    grid.push(arr);
  }
  return grid;
}

const findRow = (grid, test, from = 0) => {
  for (let i = from; i < grid.length; i++) if (grid[i].some((v) => test(txt(v)))) return i;
  return -1;
};
const findCol = (row, test) => row.findIndex((v) => test(txt(v)));

export async function parseBudgetFile(file) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  return parseWorkbook(wb);
}

export function parseWorkbook(wb) {
  const warnings = [];
  const sheets = wb.worksheets.map((ws) => ({ name: ws.name, grid: toGrid(ws) }));
  const sheet =
    sheets.find((s) => s.name.includes('내역') && findRow(s.grid, (t) => t.includes('연간 예산')) >= 0) ||
    sheets.find((s) => findRow(s.grid, (t) => t.includes('연간 예산')) >= 0);
  if (!sheet) throw new Error('「안전보건예산 내역」 양식의 시트를 찾지 못했어요. "연간 예산" 열이 있는 시트가 필요해요.');
  const g = sheet.grid;

  /* ① 세부 항목 + 월별 합계 */
  const h = findRow(g, (t) => t === '연간 예산');
  const head = g[h];
  const monthRowIdx = findRow(g, (t) => t === '1월', h);
  const monthRow = monthRowIdx >= 0 ? g[monthRowIdx] : [];
  const monthCols = Array.from({ length: 12 }, (_, m) => findCol(monthRow, (t) => t === `${m + 1}월`));
  const cGroup = findCol(head, (t) => t === '구분');
  const cItem = findCol(head, (t) => t === '항목');
  const cSub = findCol(head, (t) => t.replace(/\s/g, '') === '세부항목');
  const cBud = findCol(head, (t) => t === '연간 예산');
  const cSum = findCol(head, (t) => t === '집행 합계' || t === '집행합계');

  const details = [];
  let monthly = Array(12).fill(0);
  let group = '';
  let item = '';
  const start = Math.max(h, monthRowIdx) + 1;
  for (let r = start; r < g.length; r++) {
    const row = g[r];
    const first = txt(row.find((v) => txt(v) !== ''));
    if (first.startsWith('합계') || txt(row[0]).startsWith('합계')) {
      monthly = monthCols.map((c) => (c >= 0 ? num(row[c]) || 0 : 0));
      break;
    }
    if (cGroup >= 0 && txt(row[cGroup])) group = txt(row[cGroup]);
    if (cItem >= 0 && txt(row[cItem])) item = txt(row[cItem]);
    const budget = num(row[cBud]);
    if (budget === null) continue;
    const months = monthCols.map((c) => (c >= 0 ? num(row[c]) || 0 : 0));
    const executed = cSum >= 0 && num(row[cSum]) !== null ? num(row[cSum]) : months.reduce((a, b) => a + b, 0);
    const sub = cSub >= 0 ? txt(row[cSub]) : '';
    details.push({ group, name: sub && sub !== item ? `${item} (${sub})` : item, budget, executed });
  }
  if (details.length === 0) throw new Error('예산 항목을 하나도 읽지 못했어요. 시트 양식을 확인해 주세요.');
  if (monthCols.every((c) => c < 0)) warnings.push('1월~12월 열을 찾지 못해 월별 추이는 비어 있어요.');

  /* ② 구분별 요약 (없으면 세부 항목을 구분별로 합산) */
  let items = [];
  const s = findRow(g, (t) => t.includes('구분별 요약'));
  if (s >= 0) {
    const sh = findRow(g, (t) => t === '구분', s);
    const shRow = g[sh];
    const sg = findCol(shRow, (t) => t === '구분');
    const sb = findCol(shRow, (t) => t.includes('예산'));
    const se = findCol(shRow, (t) => t.includes('집행') && !t.includes('률'));
    for (let r = sh + 1; r < g.length; r++) {
      const row = g[r];
      if (txt(row[0]).startsWith('합계') || txt(row[sg]).startsWith('합계')) break;
      const name = txt(row[sg]);
      if (!name || num(row[sb]) === null) continue;
      items.push({ name, budget: num(row[sb]), executed: num(row[se]) || 0 });
    }
  }
  if (items.length === 0) {
    const map = new Map();
    details.forEach((d) => {
      const k = d.group || d.name;
      const cur = map.get(k) || { name: k, budget: 0, executed: 0 };
      cur.budget += d.budget;
      cur.executed += d.executed;
      map.set(k, cur);
    });
    items = [...map.values()];
    warnings.push('"구분별 요약" 표가 없어 세부 항목을 구분별로 합산했어요.');
  }

  /* ③ 검산 */
  const sumItems = items.reduce((a, b) => a + b.executed, 0);
  const sumDetails = details.reduce((a, b) => a + b.executed, 0);
  if (Math.round(sumItems) !== Math.round(sumDetails))
    warnings.push(`구분별 요약 집행액 합계(${sumItems.toLocaleString()}원)와 세부 항목 합계(${sumDetails.toLocaleString()}원)가 달라요.`);

  return { sheetName: sheet.name, items, details, monthly, warnings };
}
