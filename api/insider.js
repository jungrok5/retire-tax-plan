// Vercel Serverless Function — 내부자(Form 4) 거래 프록시 (+캐시)
// 키(FINNHUB_KEY)는 Vercel 환경변수에만 저장되고, 브라우저로 절대 노출되지 않습니다.
//
// 캐시: CDN(s-maxage 1h) + 워밍 인스턴스 메모리(마지막 정상 데이터) → 호출 최소화·끊김 방지
// 사용:  /api/insider?symbol=NVDA
// 응답:  { symbol, months: [ { ym, net, buy, sell } ], updated }

const ALLOW = new Set([
  "NVDA","MSFT","AVGO","AAPL","GOOGL","AMZN","META","TSLA",
  "AMD","PLTR","SMCI","MU","ORCL","CRM","ARM","DELL"
]);

const TTL_MS = 1000 * 60 * 60;                 // 메모리 캐시 1시간
const CACHE_HEADER = "public, s-maxage=3600, stale-while-revalidate=86400";
const MEM = globalThis.__insCache || (globalThis.__insCache = {});

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const symbol = String((req.query.symbol || "NVDA")).toUpperCase();
  if (!ALLOW.has(symbol)) { res.status(400).json({ error: "symbol_not_allowed" }); return; }

  const now = Date.now();
  const hit = MEM[symbol];
  if (hit && now - hit.ts < TTL_MS && hit.data.months.length) {
    res.setHeader("Cache-Control", CACHE_HEADER);
    res.setHeader("X-Cache", "MEM");
    res.status(200).json(hit.data);
    return;
  }

  const key = process.env.FINNHUB_KEY;
  if (!key) { res.status(500).json({ error: "FINNHUB_KEY_not_set" }); return; }

  const to = new Date();
  const from = new Date(); from.setMonth(from.getMonth() - 13);
  const f = (d) => d.toISOString().slice(0, 10);
  const url = `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${symbol}&from=${f(from)}&to=${f(to)}&token=${key}`;

  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("upstream_" + r.status);
    const j = await r.json();
    const data = (j && j.data) ? j.data : [];

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

    const out = { symbol, months, updated: new Date().toISOString() };
    if (months.length) MEM[symbol] = { ts: now, data: out };
    res.setHeader("Cache-Control", CACHE_HEADER);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(out);
  } catch (e) {
    if (hit && hit.data.months.length) {
      res.setHeader("Cache-Control", CACHE_HEADER);
      res.setHeader("X-Cache", "STALE");
      res.status(200).json({ ...hit.data, stale: true });
      return;
    }
    res.status(502).json({ error: String(e.message || "fetch_failed") });
  }
};
