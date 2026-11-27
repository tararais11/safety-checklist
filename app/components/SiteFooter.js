// 화면 맨 아래 공통 바닥글 (표시만 하고 동작은 없어요)
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container footer-in">
        <div className="footer-brand">안전보건 <span className="accent">통합관리시스템</span></div>
        <div>산업안전보건법 · 중대재해처벌법 대응 관리</div>
        <div className="footer-copy">Copyright © (주)오파스넷. All rights reserved.</div>
      </div>
    </footer>
  );
}
