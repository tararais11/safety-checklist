import './globals.css';

export const metadata = {
  title: '안전보건 통합관리시스템',
  description: '산업안전보건법 · 중대재해처벌법 대응 주기별 체크리스트',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        {/* 화면 글씨체(Pretendard). 불러오지 못하면 기본 글씨체로 보여요. */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
