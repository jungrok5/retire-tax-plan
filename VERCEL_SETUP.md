# Vercel 배포 가이드 (약 3분 · API 키 불필요)

이 저장소는 **정적 사이트(index.html) + 서버리스 함수(`api/market-insider.js`)** 구조입니다.
Vercel에 import 하면 **사이트 + 라이브 내부자 매도 차트가 한 번에** 작동합니다.
**API 키나 환경변수가 필요 없습니다** — 시장 전체 매도 데이터는 OpenInsider(SEC Form 4)에서
서버가 받아오기 때문입니다.

## 1. Vercel에 저장소 연결
1. https://vercel.com → GitHub 계정으로 로그인
2. **Add New… → Project**
3. **Import Git Repository** → `jungrok5/retire-tax-plan` 선택
4. 설정은 그대로 (Framework Preset **Other**, Build/Output **비워둠**)
5. **Deploy** → `https://<프로젝트>.vercel.app` 생성 = 사이트 주소

## 2. 확인
- 사이트 접속 → **버블방어 → 내부자 매도** 섹션의 **시장 전체 매도 순위 차트**가 표시되면 성공
  (탭: 집중매도 / 이번 주 최대 매도).
- 함수 직접 테스트: `https://<프로젝트>.vercel.app/api/market-insider?view=cluster-sells` → JSON이 나오면 OK.

## 3. (선택) 자동 배포 & 도메인
- `main` 브랜치에 push하면 Vercel이 **자동 재배포**.
- **Settings → Domains**에서 개인 도메인 연결 가능.

---

### 캐시 / 데이터 정책
- 차트 데이터는 **CDN에 3시간 캐시**(`s-maxage`)됩니다 → 사용자가 많아도 OpenInsider는
  캐시 만료 때만 1회 호출(차단 방지). 만료돼도 **stale 데이터를 즉시 주고 뒤에서 갱신**.
- OpenInsider가 먹통이거나 데이터가 비면 **마지막 정상 데이터를 그대로 표시**(끊김 방지).
- 데이터: OpenInsider `latest-cluster-sells` / `top-insider-sales-of-the-week` (SEC Form 4).
  **실시간 틱이 아니라 신고(거래 후 ~2영업일) 기반**입니다.
- 조회 페이지는 `api/market-insider.js`의 `VIEWS`에서 추가/수정 가능.

> 참고: 코드가 `*.vercel.app`에서 열리면 같은 도메인의 `/api/market-insider`를 자동 호출합니다.
> (`github.io`에서 열면 "Vercel에서 표시" 안내가 뜹니다.)
