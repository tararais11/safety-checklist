// PDF 내보내기용 공시자료 (화면에는 안 보이고 인쇄할 때만 나와요)

const won = (n) => (Number(n) || 0).toLocaleString('ko-KR');
const pct = (a, b) => (b > 0 ? (Math.round((a / b) * 1000) / 10).toFixed(1) : '0.0');
const ROLES = [
  ['ceo', '안전보건관리책임자'],
  ['teamLead', '안전보건관리팀장'],
  ['safetyMgr', '안전관리자'],
  ['healthMgr', '보건관리자'],
];
const Q = ({ q = [] }) =>
  [0, 1, 2, 3].map((k) => (
    <td key={k} className="c">
      {q[k] ? '◉' : ''}
    </td>
  ));
const today = () => {
  const t = new Date();
  return `${t.getFullYear()}. ${String(t.getMonth() + 1).padStart(2, '0')}. ${String(t.getDate()).padStart(2, '0')}.`;
};
const dot = (s) => (s ? s.replaceAll('-', '. ') + '.' : '');

function Empty({ cols, text = '해당 사항 없음' }) {
  return (
    <tr>
      <td colSpan={cols} className="c muted">
        {text}
      </td>
    </tr>
  );
}

export default function PrintReport({ year, d, rec }) {
  const meta = d.meta || {};
  const sys = d.system;
  const sup = sys.supervisors || [];
  const acc = d.accident;
  const accRate = acc.workers > 0 ? ((acc.injured / acc.workers) * 100).toFixed(2) : '0.00';
  const results = d.activity.items.filter((i) => i.kind === 'result' || (i.kind === 'plan' && ['완료', '진행중', '지연', '미실시'].includes(i.status)));
  const plans = d.activity.items.filter((i) => i.kind === 'plan');
  const inv = d.invest;
  const tb = inv.items.reduce((s, i) => s + (Number(i.budget) || 0), 0);
  const te = inv.items.reduce((s, i) => s + (Number(i.executed) || 0), 0);
  const details = inv.details || [];
  const monthly = inv.monthly || [];
  const prev = d.prevent.items;
  const prevDone = prev.filter((p) => p.status === '조치완료').length;
  const ctr = d.contractor;

  return (
    <div className="print-only report">
      {/* 머리 */}
      <header className="r-head">
        <div className="r-kicker">산업안전보건법 제10조의2에 따른</div>
        <h1>{year}년 안전보건 현황 공시자료</h1>
        <table className="r-meta">
          <tbody>
            <tr>
              <th>회사명</th>
              <td>{meta.company || ''}</td>
              <th>기준연도</th>
              <td>{year}년</td>
            </tr>
            <tr>
              <th>작성부서</th>
              <td>{meta.dept || ''}</td>
              <th>작성자</th>
              <td>{meta.writer || ''}</td>
            </tr>
            <tr>
              <th>작성일</th>
              <td>{today()}</td>
              <th>대표자 확인</th>
              <td>{rec.ceo_confirmed ? `확인 완료 (${dot(rec.ceo_confirmed_at)})` : '확인 전'}</td>
            </tr>
          </tbody>
        </table>
      </header>

      {/* 1호 */}
      <section>
        <h2>1. 안전보건관리체제</h2>
        <h3>가. 안전보건 조직</h3>
        <table className="r-tbl">
          <thead>
            <tr>
              <th style={{ width: '30%' }}>직책</th>
              <th style={{ width: '25%' }}>성명</th>
              <th>직위·소속</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map(([k, label]) => (
              <tr key={k}>
                <td>{label}</td>
                <td className="c">{sys.roles?.[k]?.name || '-'}</td>
                <td>{sys.roles?.[k]?.title || '-'}</td>
              </tr>
            ))}
            <tr>
              <td>산업안전보건위원회</td>
              <td className="c">{sys.committee}</td>
              <td>{sys.note || ''}</td>
            </tr>
          </tbody>
        </table>

        <h3>
          나. 관리감독자 지정 및 교육 현황 <span className="r-sub">(지정 {sup.length}명 · 교육 완료 {sup.filter((x) => x.eduDate).length}명)</span>
        </h3>
        <table className="r-tbl">
          <thead>
            <tr>
              <th style={{ width: '8%' }}>No</th>
              <th>소속</th>
              <th style={{ width: '22%' }}>성명</th>
              <th style={{ width: '24%' }}>교육완료일자</th>
            </tr>
          </thead>
          <tbody>
            {sup.length === 0 ? (
              <Empty cols={4} text="등록된 관리감독자 없음" />
            ) : (
              sup.map((x, i) => (
                <tr key={i}>
                  <td className="c">{i + 1}</td>
                  <td>{x.dept}</td>
                  <td className="c">{x.name}</td>
                  <td className="c">{x.eduDate ? dot(x.eduDate) : '미이수'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* 2호 */}
      <section>
        <h2>2. 산업재해 발생 현황</h2>
        <table className="r-tbl">
          <thead>
            <tr>
              <th>상시근로자 수</th>
              <th>재해자 수</th>
              <th>사망자 수</th>
              <th>업무상 질병자 수</th>
              <th>재해율</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="c">{won(acc.workers)}명</td>
              <td className="c">{acc.injured}명</td>
              <td className="c">{acc.deaths}명</td>
              <td className="c">{acc.disease}명</td>
              <td className="c">{accRate}%</td>
            </tr>
          </tbody>
        </table>
        <p className="r-note">※ 재해율 = 재해자 수 ÷ 상시근로자 수 × 100</p>
      </section>

      {/* 3호 */}
      <section>
        <h2>3. 안전보건 활동 실적 및 활동계획</h2>
        <h3>가. 안전보건 활동 실적</h3>
        <table className="r-tbl">
          <thead>
            <tr>
              <th style={{ width: '6%' }}>No</th>
              <th style={{ width: '18%' }}>구분</th>
              <th>활동 내용</th>
              <th style={{ width: '24%' }}>목표(성과지표)</th>
              <th style={{ width: '11%' }}>실시 결과</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <Empty cols={5} />
            ) : (
              results.map((a, i) => (
                <tr key={i}>
                  <td className="c">{i + 1}</td>
                  <td>{a.area || '-'}</td>
                  <td>
                    {a.title}
                    {a.months ? ` (${a.months})` : ''}
                  </td>
                  <td>{a.detail}</td>
                  <td className="c">{a.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <h3>나. 안전보건 활동계획</h3>
        <table className="r-tbl small">
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: '13%' }}>
                구분
              </th>
              <th rowSpan={2}>세부 추진계획</th>
              <th rowSpan={2} style={{ width: '16%' }}>
                목표(성과지표)
              </th>
              <th colSpan={4}>추진일정(분기)</th>
              <th rowSpan={2} style={{ width: '12%' }}>
                담당
              </th>
              <th rowSpan={2} style={{ width: '10%' }}>
                소요예산(원)
              </th>
              <th rowSpan={2} style={{ width: '9%' }}>
                비고
              </th>
            </tr>
            <tr>
              <th style={{ width: '4%' }}>1</th>
              <th style={{ width: '4%' }}>2</th>
              <th style={{ width: '4%' }}>3</th>
              <th style={{ width: '4%' }}>4</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <Empty cols={10} />
            ) : (
              plans.map((a, i) => (
                <tr key={i}>
                  <td>{a.area !== plans[i - 1]?.area ? a.area : ''}</td>
                  <td>
                    {a.title}
                    {a.months ? ` (${a.months})` : ''}
                  </td>
                  <td>{a.detail}</td>
                  <Q q={a.quarters} />
                  <td className="c">{a.owner}</td>
                  <td className="r">{a.budget}</td>
                  <td>{a.note}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* 4호 */}
      <section>
        <h2>4. 안전보건에 관한 투자</h2>
        <h3>
          가. 구분별 편성 및 집행 현황 <span className="r-sub">(단위: 원)</span>
        </h3>
        <table className="r-tbl">
          <thead>
            <tr>
              <th>구분</th>
              <th style={{ width: '22%' }}>편성액</th>
              <th style={{ width: '22%' }}>집행액</th>
              <th style={{ width: '14%' }}>집행률</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.length === 0 ? (
              <Empty cols={4} />
            ) : (
              inv.items.map((it, i) => (
                <tr key={i}>
                  <td>{it.name}</td>
                  <td className="r">{won(it.budget)}</td>
                  <td className="r">{won(it.executed)}</td>
                  <td className="c">{pct(it.executed, it.budget)}%</td>
                </tr>
              ))
            )}
            <tr className="r-total">
              <td className="c">합계</td>
              <td className="r">{won(tb)}</td>
              <td className="r">{won(te)}</td>
              <td className="c">{pct(te, tb)}%</td>
            </tr>
          </tbody>
        </table>

        {details.length > 0 && (
          <>
            <h3>
              나. 세부 항목별 집행 현황 <span className="r-sub">(단위: 원)</span>
            </h3>
            <table className="r-tbl small">
              <thead>
                <tr>
                  <th style={{ width: '6%' }}>No</th>
                  <th style={{ width: '16%' }}>구분</th>
                  <th>항목</th>
                  <th style={{ width: '16%' }}>편성액</th>
                  <th style={{ width: '16%' }}>집행액</th>
                  <th style={{ width: '10%' }}>집행률</th>
                </tr>
              </thead>
              <tbody>
                {details.map((x, i) => (
                  <tr key={i}>
                    <td className="c">{i + 1}</td>
                    <td>{x.group !== details[i - 1]?.group ? x.group : ''}</td>
                    <td>{x.name}</td>
                    <td className="r">{won(x.budget)}</td>
                    <td className="r">{won(x.executed)}</td>
                    <td className="c">{pct(x.executed, x.budget)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {monthly.some((m) => m > 0) && (
          <>
            <h3>
              {details.length > 0 ? '다' : '나'}. 월별 집행액 <span className="r-sub">(단위: 원)</span>
            </h3>
            <table className="r-tbl small">
              <thead>
                <tr>
                  {Array.from({ length: 6 }, (_, i) => (
                    <th key={i}>{i + 1}월</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {monthly.slice(0, 6).map((m, i) => (
                    <td key={i} className="r">
                      {won(m)}
                    </td>
                  ))}
                </tr>
              </tbody>
              <thead>
                <tr>
                  {Array.from({ length: 6 }, (_, i) => (
                    <th key={i}>{i + 7}월</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {monthly.slice(6, 12).map((m, i) => (
                    <td key={i} className="r">
                      {won(m)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </>
        )}
        {inv.source && <p className="r-note">※ 자료: {inv.source.file} 「{inv.source.sheet}」 ({dot(inv.source.at)} 기준)</p>}
      </section>

      {/* 5호 */}
      <section>
        <h2>5. 산업재해 재발방지 대책 및 이행계획</h2>
        <table className="r-tbl">
          <thead>
            <tr>
              <th style={{ width: '6%' }}>No</th>
              <th>재발방지 대책</th>
              <th style={{ width: '18%' }}>이행기한</th>
              <th style={{ width: '14%' }}>이행 상태</th>
            </tr>
          </thead>
          <tbody>
            {prev.length === 0 ? (
              <Empty cols={4} />
            ) : (
              prev.map((p, i) => (
                <tr key={i}>
                  <td className="c">{i + 1}</td>
                  <td>{p.title}</td>
                  <td className="c">{p.due ? dot(p.due) : '-'}</td>
                  <td className="c">{p.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {prev.length > 0 && (
          <p className="r-note">
            ※ 대책 {prev.length}건 중 조치완료 {prevDone}건 (이행률 {pct(prevDone, prev.length)}%)
          </p>
        )}
      </section>

      {/* 6호 */}
      <section>
        <h2>6. 도급인 사업장 관계수급인 근로자 사망 현황</h2>
        <table className="r-tbl">
          <thead>
            <tr>
              <th style={{ width: '30%' }}>해당 여부</th>
              <th style={{ width: '20%' }}>사망자 수</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="c">{ctr.applicable ? '해당' : '해당 없음'}</td>
              <td className="c">{ctr.applicable ? `${ctr.deaths}명` : '-'}</td>
              <td>{ctr.note}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 확인 */}
      <section className="r-sign">
        <p>위 내용이 사실과 다름없음을 확인합니다.</p>
        <p className="r-date">{rec.ceo_confirmed && rec.ceo_confirmed_at ? dot(rec.ceo_confirmed_at) : '        년      월      일'}</p>
        <table className="r-signbox">
          <tbody>
            <tr>
              <th>{meta.company || '회사명'}</th>
            </tr>
            <tr>
              <td>
                대표이사 &nbsp; {meta.ceoName || ''} &nbsp;&nbsp; (서명 또는 인)
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
