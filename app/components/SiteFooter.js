// 화면 맨 아래 공통 바닥글 (오파스넷 홈페이지 바닥글 느낌, 표시만 하고 동작은 없어요)
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap foot-row">
        <div className="foot-info">
          <strong>(주)오파스넷 안전보건 통합관리시스템</strong>
          <p>
            <span>서울시 강남구 테헤란로 512, 10층(대치동, 신안빌딩)</span>
            <span>대표전화 02-2193-8600</span>
          </p>
          <p className="foot-contact">
            <b>시스템 이용 문의</b>
            <span>안전보건관리팀</span>
          </p>
          <p className="foot-copy">Copyright © opasnet co., Ltd. All rights reserved.</p>
        </div>
        <div className="foot-brand">
          <img src="/logo.gif" alt="" />
          <p>기본 점검 항목은 참고용이며,<br />사업장 상황에 맞게 조정해 사용하세요.</p>
        </div>
      </div>
    </footer>
  );
}
