# Vercel로 사이트 옮기기 + 내부자 라이브 차트 켜기 (약 5분)

이 저장소는 **정적 사이트(index.html) + 서버리스 함수(/api/insider)** 구조라,
Vercel에 그대로 올리면 **사이트 + 라이브 내부자 차트가 한 번에** 작동합니다.
(같은 도메인이라 CORS·도메인 연결 작업이 필요 없습니다.)

---

## 1. 무료 Finnhub API 키 발급
1. https://finnhub.io → **Get free API key**(가입, 신용카드 불필요)
2. 대시보드에서 **API Key** 복사 (무료 60회/분)

## 2. Vercel에 저장소 연결
1. https://vercel.com → GitHub 계정으로 로그인
2. **Add New… → Project**
3. **Import Git Repository** → `jungrok5/retire-tax-plan` 선택
4. 설정 화면에서:
   - **Framework Preset: Other** (그대로 두면 됩니다)
   - Build Command / Output Directory: **비워둠**(정적 사이트라 빌드 없음)
5. **Deploy** 클릭 → 잠시 후 `https://<프로젝트>.vercel.app` 주소가 생성됩니다.
   - 이 주소가 **새 사이트 주소**입니다. (index.html이 루트에서 바로 서빙됨)

## 3. 환경변수(키) 등록 — 중요
1. 프로젝트 → **Settings → Environment Variables**
2. 추가:
   - **Key**: `FINNHUB_KEY`
   - **Value**: 1번에서 복사한 키
   - Environments: **Production** (Preview도 체크 권장)
3. **Save** → **Deployments → 최신 배포 → ⋯ → Redeploy** (환경변수 적용)

## 4. 확인
- 사이트: `https://<프로젝트>.vercel.app` 접속 → "버블 방어 → 내부자" 섹션의
  **라이브 차트가 자동 표시**되면 성공 (종목 바꾸면 막대그래프 갱신).
- 함수 직접 테스트: `https://<프로젝트>.vercel.app/api/insider?symbol=NVDA` → JSON이 나오면 OK.

## 5. (선택) 자동 배포 & 도메인
- 앞으로 `main` 브랜치에 push하면 **Vercel이 자동으로 재배포**합니다(별도 작업 X).
- 원하면 **Settings → Domains**에서 개인 도메인 연결 가능.
- GitHub Pages는 더 이상 필요 없으니, 저장소 **Settings → Pages**에서 꺼두셔도 됩니다(선택).

---

### 참고 / 주의
- 라이브 차트 데이터: Finnhub `stock/insider-transactions`(SEC Form 4 기반).
  **실시간 틱이 아니라 신고(거래 후 ~2영업일) 기반**이라 월 단위로 집계해 보여줍니다.
- 조회 종목은 `api/insider.js`의 `ALLOW` 목록에서 추가/수정 가능.
- Vercel Hobby(무료): 프로젝트 **무제한**, 함수 호출 100만/월, **개인·비상업용**만 허용.
- ⚠️ **키는 절대 코드/깃허브에 커밋하지 마세요.** Vercel 환경변수에만 두면 안전합니다.
- 코드 동작: 사이트가 `*.vercel.app`에서 열리면 위젯이 같은 도메인의 `/api/insider`를
  자동 호출합니다. (`github.io`에서 열면 "Vercel 연결 후 활성화" 안내가 표시됩니다.)
