// Vercel Serverless Function — OpenInsider 시장 전체 매도 데이터 프록시 (+캐시)
//
// 캐시 전략:
//  1) CDN 캐시(Cache-Control: s-maxage) = 사실상의 '서버 캐시'. 만료 전까지 모든 사용자
//     요청은 OpenInsider를 안 거치고 캐시로 응답 → 긁는 횟수 최소화(차단 방지).
//  2) 워밍된 인스턴스 메모리 캐시(globalThis) = 2차 방어 + '마지막 정상 데이터' 보관.
//  3) 가져오기 실패/빈 데이터면 마지막 정상 데이터를 그대로 반환(끊김 없이 유지).
//
// 사용:  /api/market-insider?view=cluster-sells | top-sales-week

const VIEWS = {
  "cluster-sells": "http://openinsider.com/latest-cluster-sells",
  "top-sales-week": "http://openinsider.com/top-insider-sales-of-the-week",
};

const TTL_MS = 1000 * 60 * 60 * 3;          // 메모리 캐시 신선도 3시간
const S_MAXAGE = 60 * 60 * 3;               // CDN 캐시 3시간
const SWR = 60 * 60 * 24 * 2;               // 만료 후 2일간 stale 허용(백그라운드 갱신)
const CACHE_HEADER = `public, s-maxage=${S_MAXAGE}, stale-while-revalidate=${SWR}`;

// 워밍된 인스턴스에서 살아남는 메모리 캐시
const MEM = globalThis.__miCache || (globalThis.__miCache = {});

function strip(s) {
  return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}

function parseRows(html) {
  const tm = html.match(/<table[^>]*tinytable[^>]*>[\s\S]*?<\/table>/i);
  if (!tm) return [];
  const table = tm[0];
  const heads = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => strip(m[1]));
  const norm = heads.map((h) => h.toLowerCase().replace(/\s+/g, " ").trim());
  const find = (p) => norm.findIndex(p);
  const ci = {
    company: find((h) => h.includes("company")),
    title: norm.indexOf("title"),
    type: find((h) => h.includes("trade type")),
    value: norm.indexOf("value"),
    date: find((h) => h.includes("trade date")),
  };
  const rows = [];
  for (const tr of [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]) {
    const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]));
    if (cells.length < 10) continue;
    const tk = tr[1].match(/href="\/([A-Z0-9.\-]{1,8})"/);
    const ticker = tk ? tk[1] : "";
    const value = parseInt((cells[ci.value] || "").replace(/[^0-9-]/g, ""), 10);
    if (!ticker || isNaN(value)) continue;
    const title = cells[ci.title] || "";
    // 분류: 10%(대주주/PE/창업가문)=major(신호 약) / C레벨(CEO·CFO 등)=clevel(신호 강) / 이사 등=dir
    const cat = /10%/.test(title) ? "major"
      : /\b(CEO|CFO|COO|CAO|CTO|CMO|Pres|President|Chief|Officer)\b/i.test(title) ? "clevel"
      : "dir";
    rows.push({
      ticker,
      company: cells[ci.company] || "",
      title,
      type: cells[ci.type] || "",
      value,
      date: cells[ci.date] || "",
      cat,
    });
  }
  rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return rows.slice(0, 14);
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const view = VIEWS[req.query.view] ? req.query.view : "cluster-sells";
  const now = Date.now();
  const hit = MEM[view];

  // 1) 메모리 캐시가 신선하면 바로 반환
  if (hit && now - hit.ts < TTL_MS && hit.data.rows.length) {
    res.setHeader("Cache-Control", CACHE_HEADER);
    res.setHeader("X-Cache", "MEM");
    res.status(200).json(hit.data);
    return;
  }

  // 2) OpenInsider에서 새로 가져오기
  try {
    const r = await fetch(VIEWS[view], {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; retire-tax-plan/1.0)" },
    });
    if (!r.ok) throw new Error("upstream_" + r.status);
    const rows = parseRows(await r.text());
    if (!rows.length) throw new Error("empty");

    const data = { view, rows, updated: new Date().toISOString() };
    MEM[view] = { ts: now, data };
    res.setHeader("Cache-Control", CACHE_HEADER);
    res.setHeader("X-Cache", "MISS");
    res.status(200).json(data);
  } catch (e) {
    // 3) 실패하면 마지막 정상 데이터라도 제공(끊김 방지)
    if (hit && hit.data.rows.length) {
      res.setHeader("Cache-Control", CACHE_HEADER);
      res.setHeader("X-Cache", "STALE");
      res.status(200).json({ ...hit.data, stale: true });
      return;
    }
    res.status(502).json({ error: String(e.message || "fetch_failed") });
  }
};
