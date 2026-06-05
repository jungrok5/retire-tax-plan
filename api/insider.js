// Vercel Serverless Function — 내부자(Form 4) 거래 프록시
// 키(FINNHUB_KEY)는 Vercel 환경변수에만 저장되고, 브라우저로 절대 노출되지 않습니다.
//
// 사용:  /api/insider?symbol=NVDA
// 응답:  { symbol, months: [ { ym:"2026-05", net, buy, sell }, ... ] }
//        net = 내부자 공개시장 순매수액($, 매수 P − 매도 S). 양수=순매수, 음수=순매도.

const ALLOW = new Set([
  "NVDA","MSFT","AVGO","AAPL","GOOGL","AMZN","META","TSLA",
  "AMD","PLTR","SMCI","MU","ORCL","CRM","ARM","DELL"
]);

module.exports = async (req, res) => {
  // 어느 도메인(깃허브 페이지스 등)에서도 호출 가능하도록 CORS 허용
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const symbol = String((req.query.symbol || "NVDA")).toUpperCase();
  if (!ALLOW.has(symbol)) { res.status(400).json({ error: "symbol_not_allowed" }); return; }

  const key = process.env.FINNHUB_KEY;
  if (!key) { res.status(500).json({ error: "FINNHUB_KEY_not_set" }); return; }

  // 최근 ~13개월
  const to = new Date();
  const from = new Date(); from.setMonth(from.getMonth() - 13);
  const f = (d) => d.toISOString().slice(0, 10);
  const url = `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${symbol}&from=${f(from)}&to=${f(to)}&token=${key}`;

  try {
    const r = await fetch(url);
    if (!r.ok) { res.status(502).json({ error: "upstream_" + r.status }); return; }
    const j = await r.json();
    const data = (j && j.data) ? j.data : [];

    // 공개시장 매수(P)·매도(S)만 월별로 집계 (스톡옵션/증여 등 제외)
    const m = {};
    for (const t of data) {
      const code = t.transactionCode;
      if (code !== "P" && code !== "S") continue;
      const ym = String(t.transactionDate || t.filingDate || "").slice(0, 7);
      if (!ym) continue;
      const shares = Math.abs(Number(t.change) || Number(t.share) || 0);
      const price = Number(t.transactionPrice) || 0;
      const val = shares * price;
      if (!m[ym]) m[ym] = { buy: 0, sell: 0 };
      if (code === "P") m[ym].buy += val; else m[ym].sell += val;
    }
    const months = Object.keys(m).sort().map((ym) => ({
      ym,
      net: Math.round(m[ym].buy - m[ym].sell),
      buy: Math.round(m[ym].buy),
      sell: Math.round(m[ym].sell),
    }));

    // CDN 캐시 1시간(과도한 호출 방지)
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ symbol, months });
  } catch (e) {
    res.status(502).json({ error: "fetch_failed" });
  }
};
