// 화면 맨 아래 공통 바닥글 (kfenc.com 방식, 표시만 하고 동작은 없어요)
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap foot-row">
        <div className="foot-brand">
          <div className="foot-logo">
            <img src="/logo.gif" alt="" />
            <b>안전보건 통합관리시스템</b>
          </div>
          <p>주기별 점검 · 증빙자료 · 협력업체 평가 · 법령 · 양식</p>
        </div>
        <dl className="foot-info">
          <div><dt>운영</dt><dd>(주)오파스넷</dd></div>
          <div><dt>이용 문의</dt><dd>안전보건관리팀</dd></div>
          <div><dt>관련 법령</dt><dd>산업안전보건법 · 중대재해처벌법</dd></div>
          <div><dt>이용 방법</dt><dd>회원가입 후 관리자 승인</dd></div>
        </dl>
      </div>
      <div className="wrap foot-bottom">
        <span>© (주)오파스넷 · 안전보건 통합관리시스템</span>
        <span>기본 점검 항목은 참고용이며, 사업장 상황에 맞게 조정해 사용하세요.</span>
      </div>
    </footer>
  );
}
