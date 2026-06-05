// Vercel Serverless Function — 하이일드 스프레드(ICE BofA US HY OAS) 실시간 프록시
// FRED는 브라우저 직접 호출(CORS)이 막혀 있어 서버가 대신 받아옵니다. API 키 불필요.
// FRED CSV는 최근 ~3년만 제공하므로, 과거 이력은 프런트의 고정 배열을 쓰고
// 최근 구간 + '현재값'만 이 함수로 실시간 갱신합니다.
//
// 응답: { monthly: [["YYYY-MM", val], ...], latest: { date, value }, updated }

const TTL_MS = 1000 * 60 * 60 * 6;          // 메모리 6시간
const CACHE_HEADER = "public, s-maxage=21600, stale-while-revalidate=172800"; // CDN 6시간
const MEM = globalThis.__hyCache || (globalThis.__hyCache = {});

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const now = Date.now();
  const hit = MEM.data;
  if (hit && now - MEM.ts < TTL_MS && hit.monthly.length) {
    res.setHeader("Cache-Control", CACHE_HEADER);
    res.setHeader("X-Cache", "MEM");
    res.status(200).json(hit);
    return;
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000); // 8초 내 응답 없으면 중단(행 방지)
    let text;
    try {
      const r = await fetch("https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2", {
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept": "text/csv,text/plain,*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (!r.ok) throw new Error("upstream_" + r.status);
      text = await r.text();
    } finally {
      clearTimeout(timer);
    }

    const month = {};
    let latest = null;
    for (const line of text.split("\n")) {
      const c = line.split(",");
      if (c.length < 2) continue;
      const d = c[0].trim();
      const v = parseFloat(c[1]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(v)) continue;
      month[d.slice(0, 7)] = v;   // 그 달의 마지막(최신) 값
      latest = { date: d, value: v };
    }
    const monthly = Object.keys(month).sort().map((ym) => [ym, month[ym]]);
    if (!monthly.length || !latest) throw new Error("empty");

    const data = { monthly, latest, updated: new Date().toISOString() };
    MEM.data = data; MEM.ts = now;
    res.setHeader("Cache-Control", CACHE_HEADER);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(data);
  } catch (e) {
    if (hit && hit.monthly.length) {
      res.setHeader("Cache-Control", CACHE_HEADER);
      res.setHeader("X-Cache", "STALE");
      res.status(200).json({ ...hit, stale: true });
      return;
    }
    res.status(502).json({ error: String(e.message || "fetch_failed") });
  }
};
