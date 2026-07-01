const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3050;
const TIDE_URL = "https://www.tide-forecast.com/locations/Reykjavik-Iceland/tides/latest";
const NAUTHOLSVIK_URL = "https://nautholsvik.is/";

function send(res, status, type, body) {
  res.writeHead(status, {
    "Content-Type": type + "; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  });
  res.end(body);
}
function sendJson(res, obj, status = 200) {
  send(res, status, "application/json", JSON.stringify(obj, null, 2));
}
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
function normalizeTime(time, ampm) {
  let [h, m] = time.split(":").map(Number);
  const suffix = String(ampm).toUpperCase();
  if (suffix === "PM" && h !== 12) h += 12;
  if (suffix === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function timeToMinute(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function isoTodayUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}
function parseDateToIso(s) {
  const months = {
    january:"01", february:"02", march:"03", april:"04", may:"05", june:"06",
    july:"07", august:"08", september:"09", october:"10", november:"11", december:"12"
  };
  const m = String(s || "").match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return isoTodayUTC();
  return `${m[3]}-${months[m[2].toLowerCase()] || "01"}-${String(Number(m[1])).padStart(2,"0")}`;
}
async function fetchWithTimeout(url, ms = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SjosundNautholsvik/1.0)"
      }
    });
  } finally {
    clearTimeout(timer);
  }
}
function calcEventsFor(events) {
  const calcEvents = events.map(e => ({...e, minute: timeToMinute(e.time)}));
  if (calcEvents.length >= 4) {
    // Needed so calculations after the last tide of the day have a next point.
    calcEvents.push({...calcEvents[0], minute: calcEvents[0].minute + 1440, nextDay: true});
  }
  return calcEvents;
}
async function getTides() {
  const response = await fetchWithTimeout(TIDE_URL, 7000);
  if (!response.ok) throw new Error("Tide-Forecast svaraði " + response.status);

  const text = stripHtml(await response.text());

  const dateMatch =
    text.match(/Today's tide times for Reykjavik:\s*([A-Za-z]+day\s+\d{1,2}\s+[A-Za-z]+\s+\d{4})/i) ||
    text.match(/today on\s+([A-Za-z]+day\s+\d{1,2}\s+[A-Za-z]+\s+\d{4})\s+for Reykjavik/i);

  const date = parseDateToIso(dateMatch?.[1]);

  // Current Tide-Forecast text looks like:
  // Low Tide 1:20 AM(Wed 01 July)2.65 ft (0.81 m)
  // High Tide 7:19 AM(Wed 01 July)10.76 ft (3.28 m)
  const rows = [];
  const rowRe = /(Low Tide|High Tide)\s+(\d{1,2}:\d{2})\s*(AM|PM)\([^)]*\)\s*[0-9.]+\s*ft\s*\(([0-9.]+)\s*m\)/gi;
  let match;
  while ((match = rowRe.exec(text)) !== null && rows.length < 4) {
    const time = normalizeTime(match[2], match[3]);
    rows.push({
      type: match[1].toLowerCase().startsWith("high") ? "high" : "low",
      time,
      height: Number(match[4]),
      minute: timeToMinute(time)
    });
  }

  if (rows.length < 4) {
    throw new Error("Fann ekki 4 flóðaviðburði í Tide-Forecast textanum");
  }

  return {
    station: "Reykjavík",
    source: "Tide-Forecast",
    date,
    events: rows,
    calcEvents: calcEventsFor(rows)
  };
}
function pickValueBeforeLabel(text, label, unit) {
  const re = new RegExp("([0-9]+(?:[.,][0-9]+)?)\\s*" + unit + "\\s*" + label, "i");
  return (text.match(re) || [])[1] || null;
}
async function getNautholsvik() {
  const response = await fetchWithTimeout(NAUTHOLSVIK_URL, 7000);
  if (!response.ok) throw new Error("Nauthólsvík svaraði " + response.status);

  const text = stripHtml(await response.text());
  const updated = ((text.match(/Síðasta athugun:\s*([0-9./: ]+)/i) || [])[1] || "").trim() || null;

  return {
    seaTemp: pickValueBeforeLabel(text, "Sjávarhiti", "°?C"),
    airTemp: pickValueBeforeLabel(text, "Lofthiti", "°?C"),
    wind: pickValueBeforeLabel(text, "Vindhraði", "m\\/s"),
    updated,
    source: "Nauthólsvík"
  };
}
function serveFile(res, file) {
  const full = path.join(__dirname, file);
  if (!fs.existsSync(full)) return send(res, 404, "text/plain", "Fann ekki skrána.");
  const ext = path.extname(full).toLowerCase();
  const type = ext === ".html" ? "text/html" :
               ext === ".json" ? "application/json" :
               ext === ".js" ? "application/javascript" :
               "text/plain";
  send(res, 200, type, fs.readFileSync(full));
}
const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/tides")) return sendJson(res, await getTides());
    if (req.url.startsWith("/api/nautholsvik")) return sendJson(res, await getNautholsvik());
    if (req.url === "/" || req.url.startsWith("/index.html")) return serveFile(res, "index.html");
    return serveFile(res, req.url.replace(/^\//, ""));
  } catch (err) {
    return sendJson(res, { error: err.message }, 502);
  }
});
server.listen(PORT, () => console.log(`Sjósund Nauthólsvík keyrir á porti ${PORT}`));
