import './globals.css';

export const metadata = {
  title: '안전보건 통합관리시스템',
  description: '산업안전보건법 · 중대재해처벌법 대응 주기별 체크리스트',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
