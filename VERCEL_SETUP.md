# 내부자 라이브 차트 — Vercel 연결 가이드 (5분)

사이트의 "내부자 매도" 신호에 **종목별 월간 내부자 순매수/순매도 차트**를 띄우기 위한 설정입니다.
키는 **Vercel 서버에만** 저장되고 브라우저에 노출되지 않습니다.

## 1. 무료 Finnhub API 키 발급
1. https://finnhub.io 접속 → **Get free API key**(회원가입)
2. 대시보드에서 **API Key** 복사 (무료: 60회/분, 신용카드 불필요)

## 2. Vercel에 이 저장소 연결
1. https://vercel.com 로그인(GitHub 계정으로) → **Add New… → Project**
2. **Import Git Repository** → `jungrok5/retire-tax-plan` 선택
3. Framework Preset: **Other** (빌드 설정 변경 불필요) → **Deploy**
   - 정적 사이트 + `/api/insider` 함수가 함께 배포됩니다.

## 3. 환경변수(키) 등록 — 중요
1. 배포된 프로젝트 → **Settings → Environment Variables**
2. 추가:
   - **Name**: `FINNHUB_KEY`
   - **Value**: (1번에서 복사한 키)
   - Environments: Production(+Preview) 체크
3. 저장 후 **Deployments → 최신 배포 → ⋯ → Redeploy** (환경변수 적용)

## 4. 동작 확인
브라우저에서 아래 주소 열기 (프로젝트 도메인으로 교체):
```
https://<your-project>.vercel.app/api/insider?symbol=NVDA
```
→ `{ "symbol":"NVDA", "months":[ ... ] }` 같은 JSON이 보이면 성공.

## 5. 사이트에 연결
배포된 도메인(`https://<your-project>.vercel.app`)을 **알려주시면**,
사이트의 라이브 차트가 그 주소를 호출하도록 1줄만 바꿔 연결하겠습니다.
(또는 `index.html`의 `INSIDER_API` 값을 그 주소로 직접 바꿔도 됩니다.)

---

### 참고
- 데이터: Finnhub `stock/insider-transactions` (SEC Form 4 기반). **실시간 틱이 아니라 신고(거래 후 ~2영업일) 기반**이라 월 단위 집계로 보여줍니다.
- 조회 가능 종목은 `api/insider.js`의 `ALLOW` 목록에서 추가/수정할 수 있습니다.
- Vercel Hobby(무료): 프로젝트 수 **무제한**, 함수 호출 100만/월, **비상업·개인용**만 허용.
- ⚠️ 키는 절대 코드/깃허브에 커밋하지 마세요. Vercel 환경변수에만 두면 안전합니다.
