// Vercel Serverless Function — OpenInsider 시장 전체 매도 데이터 프록시
// 서버에서 OpenInsider HTML을 받아 파싱(브라우저 CORS 우회) → JSON으로 제공.
//
// 사용:  /api/market-insider?view=cluster-sells   (집중매도)
//        /api/market-insider?view=top-sales-week  (이번 주 최대 매도)

const VIEWS = {
  "cluster-sells": "http://openinsider.com/latest-cluster-sells",
  "top-sales-week": "http://openinsider.com/top-insider-sales-of-the-week",
};

function strip(s) {
  return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const view = VIEWS[req.query.view] ? req.query.view : "cluster-sells";
  const url = VIEWS[view];

  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; retire-tax-plan/1.0)" } });
    if (!r.ok) { res.status(502).json({ error: "upstream_" + r.status }); return; }
    const html = await r.text();

    const tm = html.match(/<table[^>]*tinytable[^>]*>[\s\S]*?<\/table>/i);
    if (!tm) { res.status(502).json({ error: "no_table" }); return; }
    const table = tm[0];

    const heads = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => strip(m[1]));
    const norm = heads.map((h) => h.toLowerCase().replace(/\s+/g, " ").trim());
    const find = (p) => norm.findIndex(p);
    const ci = {
      ticker: norm.indexOf("ticker"),
      company: find((h) => h.includes("company")),
      insider: find((h) => h.includes("insider")),
      title: norm.indexOf("title"),
      type: find((h) => h.includes("trade type")),
      price: norm.indexOf("price"),
      qty: norm.indexOf("qty"),
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
      rows.push({
        ticker,
        company: cells[ci.company] || "",
        title: cells[ci.title] || "",
        type: cells[ci.type] || "",
        value, // 매도는 음수
        date: cells[ci.date] || "",
      });
    }
    rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
    res.status(200).json({ view, rows: rows.slice(0, 14) });
  } catch (e) {
    res.status(502).json({ error: "fetch_failed" });
  }
};
