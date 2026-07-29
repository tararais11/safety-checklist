# 안전보건서류 주기별 체크리스트 — 배포 가이드

친구분 사이트(hyeong-ilmae.vercel.app)와 같은 구조예요: **Next.js(웹앱) + Supabase(로그인·데이터베이스) + Vercel(호스팅)**.
전부 무료로 시작할 수 있어요. 순서대로만 따라 하시면 됩니다. 컴퓨터에 아무것도 설치되어 있지 않아도 괜찮아요.

---

## 1. 준비물 (전부 무료 가입)

1. [GitHub](https://github.com) 계정 
2. [Supabase](https://supabase.com) 계정 (GitHub로 바로 가입 가능)
3. [Vercel](https://vercel.com) 계정 (GitHub로 바로 가입 가능)
4. 컴퓨터에 [Node.js](https://nodejs.org) 설치 (LTS 버전) — 로컬에서 미리 테스트해보고 싶을 때만 필요, 바로 배포만 할 거면 생략 가능

---

## 2. Supabase 프로젝트 만들기 (로그인 + 데이터베이스)

1. [supabase.com](https://supabase.com) → **New Project**
2. 프로젝트 이름, 비밀번호(DB 비밀번호, 아무거나 강력하게) 설정 후 생성 — 1~2분 소요
3. 왼쪽 메뉴 **SQL Editor** 클릭 → **New query**
4. 이 폴더에 들어있는 `supabase_schema.sql` 파일 내용을 전부 복사해서 붙여넣고 **Run** 실행
   - 이 SQL이 체크리스트 항목/기록을 저장할 테이블 2개를 만들고, "본인 데이터만 볼 수 있도록" 보안 규칙(RLS)까지 설정해줍니다.
5. 왼쪽 메뉴 **Project Settings → API** 클릭
   - **Project URL** 값 복사해두기
   - **anon public** 키 값 복사해두기 (이 두 개가 나중에 필요해요)
6. (선택) **Authentication → Providers → Email** 설정에서 "Confirm email"을 꺼두면, 회원가입 즉시 이메일 인증 없이 바로 로그인할 수 있어요. 테스트할 때 편리합니다.

---

## 3. 코드를 GitHub에 올리기

1. GitHub에서 새 저장소(Repository) 생성 (예: `safety-checklist`)
2. 이 폴더(`safety-app`) 전체를 그 저장소에 업로드
   - GitHub 웹사이트에서 "Add file → Upload files"로 폴더째 드래그해도 되고,
   - 터미널을 쓸 수 있다면:
     ```bash
     cd safety-app
     git init
     git add .
     git commit -m "안전보건 체크리스트 초기 커밋"
     git branch -M main
     git remote add origin https://github.com/내계정/safety-checklist.git
     git push -u origin main
     ```

---

## 4. Vercel에 배포하기

1. [vercel.com](https://vercel.com) 로그인 → **Add New → Project**
2. 방금 만든 GitHub 저장소 선택 → **Import**
3. **Environment Variables**(환경 변수) 항목에 아래 2개를 추가:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | 2단계에서 복사한 Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 2단계에서 복사한 anon public 키 |

4. **Deploy** 클릭 → 1~2분 후 `https://내프로젝트이름.vercel.app` 주소로 접속 가능

---

## 5. 사용해보기

1. 배포된 주소로 접속 → **회원가입** 탭에서 이메일/비밀번호로 가입
2. 로그인하면 자동으로 기본 체크리스트 항목(일일~연간)이 생성됩니다
3. 체크박스를 누르면 Supabase 데이터베이스에 바로 저장되고, 다른 기기에서 로그인해도 동일하게 보여요
4. 항목은 자유롭게 추가/삭제 가능

---

## 로컬에서 미리 테스트하고 싶다면

```bash
cd safety-app
npm install
cp .env.local.example .env.local   # 이후 .env.local 안의 값을 실제 Supabase 값으로 교체
npm run dev
```
브라우저에서 `http://localhost:3000` 접속

---

## 참고 사항

- 기본으로 들어있는 체크리스트 항목은 **일반 참고용**입니다. 실제 산업안전보건법·중대재해처벌법상 의무사항은 업종, 상시근로자 수, 도급 여부에 따라 달라지므로 반드시 사업장 상황에 맞게 항목을 수정하세요.
- Supabase 무료 플랜은 소규모 사용(개인/소기업)에는 충분하지만, 사용량이 늘어나면 유료 플랜 전환이 필요할 수 있습니다.
- 이 프로젝트는 `next@14.2.31`을 사용합니다. 배포 후에도 보안 업데이트를 위해 가끔 `npm outdated`로 최신 버전을 확인하는 걸 권장해요.
