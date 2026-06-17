const cityToStadium = {
  "نيويورك/نيوجيرسي": { name: "ملعب ميتلايف", id: "metlife" },
  "مكسيكو سيتي": { name: "إستاديو أزتيكا", id: "azteca" },
  "دالاس": { name: "ملعب AT&T", id: "attdallas" },
  "أتلانتا": { name: "ملعب مرسيدس بنز", id: "mercedes" },
  "لوس أنجلوس": { name: "ملعب سوفاي", id: "sofi" },
  "هيوستن": { name: "ملعب NRG", id: "nrg" },
  "سان فرانسيسكو": { name: "ملعب ليفايز", id: "levis" },
  "سانتا كلارا": { name: "ملعب ليفايز", id: "levis" },
  "كانساس سيتي": { name: "ملعب أروهيد", id: "arrowhead" },
  "فيلادلفيا": { name: "ملعب لينكولن فاينانشيال فيلد", id: "lincoln" },
  "سياتل": { name: "ملعب لومن فيلد", id: "lumen" },
  "بوسطن": { name: "ملعب جيليت", id: "gillette" },
  "ميامي": { name: "ملعب هارد روك", id: "hardrock" },
  "غوادالاخارا": { name: "إستاديو أكرون", id: "akron" },
  "مونتيري": { name: "إستاديو BBVA", id: "bbva" },
  "تورنتو": { name: "ملعب BMO", id: "bmo" },
  "فانكوفر": { name: "ملعب BC بليس", id: "bcplace" },
};

function isArab(t) {
  return [...ARAB].some(a => t.includes(a));
}
function isBig(t) {
  return [...BIG].some(b => t.includes(b));
}
function cls(t) {
  if (isArab(t)) return "arab";
  if (isBig(t)) return "big";
  return "";
}

let filter = "today";
let liveResults = {};

function matchKey(date, a, b) {
  return `${date}|${a}|${b}`;
}

function matchFromArray(mm, dayDate) {
  const result = mm[5] || liveResults[matchKey(dayDate, mm[1], mm[2])] || null;
  return { day: dayDate, g: mm[0], a: mm[1], b: mm[2], t: mm[3], c: mm[4], result };
}

function normalizeResult(result) {
  if (!result) return null;
  if (Array.isArray(result)) {
    return { home: result[0], away: result[1], status: result[2] || "finished" };
  }
  return result;
}

function resultHTML(result) {
  const r = normalizeResult(result);
  if (!r || r.home === undefined || r.away === undefined) return '<span class="vs">×</span>';
  const status = r.status || "finished";
  const label = status === "live" ? "LIVE" : status === "finished" ? "FT" : status;
  const cls = status === "live" ? " live" : "";
  return `<span class="score${cls}"><b>${r.home}</b><span>-</span><b>${r.away}</b><em>${label}</em></span>`;
}

function render() {
  const root = document.getElementById("schedule");
  root.innerHTML = "";

  const ph = document.createElement("div");
  ph.className = "phase";
  ph.textContent = "دور المجموعات";
  root.appendChild(ph);

  let shown = 0;
  groupStage.forEach(day => {
    const rows = day.m.filter(mm => {
      if (filter === "all") return true;
      if (filter === "arab") return isArab(mm[1]) || isArab(mm[2]);
      if (filter === "big") return isBig(mm[1]) || isBig(mm[2]);
      if (filter === "egypt") return mm[1].includes("مصر") || mm[2].includes("مصر");
    });
    if (!rows.length) return;
    shown += rows.length;
    const box = document.createElement("div");
    box.className = "day";
    box.innerHTML = `<div class="day-head"><span>${day.date}</span><span class="dd">${day.d || ""}</span></div>`;
    const tbl = document.createElement("table");
    rows.forEach(mm => {
      const m = matchFromArray(mm, day.date);
      const { g, a, b, t, c, result } = m;
      const ta = isArab(a) ? '<span class="tag a">عربي</span>' : isBig(a) ? '<span class="tag b">⭐</span>' : '';
      const tb = isArab(b) ? '<span class="tag a">عربي</span>' : isBig(b) ? '<span class="tag b">⭐</span>' : '';
      const tr = document.createElement("tr");
      const std = cityToStadium[c];
      const stdLink = std ? ` • <span class="stadium-tag" onclick="viewStadium('${std.id}')">${std.name}</span>` : '';
      tr.innerHTML = `
        <td class="grp"><span>${g}</span></td>
        <td class="match"><span class="${cls(a)}">${a}</span>${ta}${resultHTML(result)}<span class="${cls(b)}">${b}</span>${tb}</td>
        <td class="time"><b>${t}</b><div class="city">${c}${stdLink}</div></td>`;
      tbl.appendChild(tr);
    });
    box.appendChild(tbl);
    root.appendChild(box);
  });

  if (!shown) {
    const e = document.createElement("div");
    e.className = "empty";
    e.textContent = "لا توجد مباريات مطابقة لهذا الفلتر.";
    root.appendChild(e);
  }

  // knockout always shown
  const kph = document.createElement("div");
  kph.className = "phase";
  kph.textContent = "الأدوار الإقصائية";
  root.appendChild(kph);

  const kb = document.createElement("div");
  kb.className = "day";
  let html = "<table>";
  knockout.forEach(k => {
    html += `<tr><td class="match big">${k.phase}</td><td class="city" style="font-size:13.5px">${k.note}</td></tr>`;
  });
  html += "</table>";
  kb.innerHTML = html;
  root.appendChild(kb);
}

let currentStadiumFilter = 'all';

function stageBadges(s) {
  const map = {
    final: ['b-final', 'نهائي البطولة'],
    open: ['b-open', 'مباراة الافتتاح'],
    semi: ['b-semi', 'نصف النهائي'],
    qf: ['b-qf', 'ربع النهائي'],
    knockout: ['b-group', 'الإقصائيات'],
    group: ['b-group', 'الدور الجماعي'],
  };
  return s.map(k => map[k]).filter(Boolean)
    .map(([c, l]) => `<span class="badge ${c}">${l}</span>`).join('');
}

function countryBadge(c) {
  const m = { us: ['badge-us', '🇺🇸 USA'], mx: ['badge-mx', '🇲🇽 México'], ca: ['badge-ca', '🇨🇦 Canada'] };
  const [cls, lbl] = m[c];
  return `<span class="country-badge ${cls}">${lbl}</span>`;
}

function renderStadiums() {
  const root = document.getElementById("stadiumsView");
  if (!root) return;
  
  if (!document.getElementById("stadiumsGrid")) {
    root.innerHTML = `
      <div class="ctrl" style="padding-top:0; margin-bottom:20px;">
        <button class="fc active" data-sf="all">كل الملاعب</button>
        <button class="fc" data-sf="us">🇺🇸 أمريكا (11)</button>
        <button class="fc" data-sf="mx">🇲🇽 المكسيك (3)</button>
        <button class="fc" data-sf="ca">🇨🇦 كندا (2)</button>
        <button class="fc" data-sf="final">⭐ المراحل الكبرى</button>
      </div>
      <div class="grid" id="stadiumsGrid"></div>
    `;
    
    root.querySelectorAll('.fc').forEach(btn => {
      btn.onclick = () => {
        root.querySelectorAll('.fc').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentStadiumFilter = btn.dataset.sf;
        renderStadiumsList();
      };
    });
  }
  
  renderStadiumsList();
}

function renderStadiumsList() {
  const grid = document.getElementById('stadiumsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const filtered = currentStadiumFilter === 'all' ? stadiums
    : currentStadiumFilter === 'final' ? stadiums.filter(s => s.stage.includes('final') || s.stage.includes('semi'))
    : stadiums.filter(s => s.country === currentStadiumFilter);
    
  if (!filtered.length) {
    grid.innerHTML = '<p class="no-results">لا توجد ملاعب مطابقة.</p>';
    return;
  }

  filtered.forEach(s => {
    const isFinal = s.stage.includes('final');
    grid.innerHTML += `
    <div class="card" id="stadium-${s.id}">
      <div class="img-wrap">
        <div class="placeholder-box" aria-hidden="true">
          <span class="placeholder-icon">🏟️</span>
          <span class="placeholder-name">${s.nameAr}</span>
        </div>
        <img src="${s.img}" alt="${s.nameAr}" loading="lazy" onload="this.classList.add('loaded')" onerror="this.style.display='none';">
        ${countryBadge(s.country)}
        ${isFinal ? '<div class="final-badge">🏆 ملعب النهائي</div>' : ''}
      </div>
      <div class="body">
        <div class="name">${s.nameAr} <span style="color:var(--muted);font-size:13px;font-weight:400">${s.name}</span></div>
        <div class="city-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${s.city}
        </div>
        <div class="badges-row">${stageBadges(s.stage)}</div>
        <hr class="divider">
        <div class="meta">
          <div class="m-item"><div class="lbl">السعة</div><div class="val">${s.capacity}</div></div>
          <div class="m-item"><div class="lbl">عدد المباريات</div><div class="val"><span class="matches-count">${s.matches}</span></div></div>
          <div class="m-item" style="grid-column:1/-1"><div class="lbl">☀️ الطقس المتوقع</div><div class="val" style="font-size:13px;font-weight:600">${s.weather}</div></div>
        </div>
        <p class="desc">${s.desc}</p>
      </div>
    </div>`;
  });
}

function viewStadium(id) {
  filter = "stadiums";
  
  document.querySelectorAll(".btn").forEach(x => {
    if (x.id === "bStadiums") {
      x.classList.add("active");
    } else {
      x.classList.remove("active");
    }
  });
  
  document.getElementById("schedule").style.display = "none";
  document.getElementById("teamsView").style.display = "none";
  document.getElementById("stadiumsView").style.display = "block";
  document.getElementById("legend").style.display = "none";
  document.getElementById("mainNote").style.display = "none";
  document.getElementById("searchMatchView").style.display = "none";
  document.getElementById("toolbar").style.display = "none";
  
  currentStadiumFilter = 'all';
  renderStadiums();
  
  setTimeout(() => {
    const el = document.getElementById(`stadium-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.borderColor = 'var(--gold)';
      el.style.boxShadow = '0 0 25px rgba(212, 164, 55, 0.5)';
      el.style.transform = 'translateY(-6px)';
      
      setTimeout(() => {
        el.style.borderColor = '';
        el.style.boxShadow = '';
        el.style.transform = '';
      }, 2500);
    }
  }, 150);
}

function teamName(t) {
  return t.replace(/ 🇦-🇿\S*/u, '').replace(/ [🏴🇦-🇿]\S*/u, '').trim();
}

function renderTeams() {
  const root = document.getElementById("teamsView");
  root.innerHTML = "";
  const grpKeys = Object.keys(groups);

  // summary row
  const confCounts = {};
  Object.values(confed).forEach(c => confCounts[c] = (confCounts[c] || 0) + 1);
  let sumHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;justify-content:center">`;
  Object.entries(confCounts).forEach(([c, n]) => {
    sumHTML += `<span style="background:${confedColor[c]}22;border:1px solid ${confedColor[c]}55;color:${confedColor[c]};padding:5px 14px;border-radius:999px;font-size:13px;font-weight:700">${c} — ${n}</span>`;
  });
  sumHTML += `</div>`;
  root.innerHTML = sumHTML;

  const grid = document.createElement("div");
  grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px";

  grpKeys.forEach(g => {
    const box = document.createElement("div");
    box.style.cssText = `background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden`;
    let html = `<div style="padding:11px 16px;background:var(--panel2);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;background:var(--gold);color:#1a1000;border-radius:8px;font-family:'Cairo',sans-serif;font-size:16px;font-weight:900">${g}</span>
      <span style="font-weight:700;font-size:15px">المجموعة ${g}</span>
    </div><table style="width:100%;border-collapse:collapse">`;

    groups[g].forEach(t => {
      const tn = teamName(t);
      const flag = t.replace(tn, '').trim();
      const isAr = ARAB.has(tn);
      const isBg = BIG.has(tn);
      const cf = confed[tn] || "";
      const cc = confedColor[cf] || "var(--muted)";
      const rowColor = isAr ? "rgba(30,166,114,.07)" : isBg ? "rgba(212,164,55,.06)" : "";
      html += `<tr style="border-top:1px solid var(--line);background:${rowColor}">
        <td style="padding:10px 14px;font-size:22px;width:40px">${flag}</td>
        <td style="padding:10px 6px;font-weight:${isAr || isBg ? 700 : 500};font-size:14px;color:${isAr ? "var(--green)" : isBg ? "var(--gold)" : "var(--txt)"}">${tn}</td>
        <td style="padding:10px 14px;text-align:left"><span style="font-size:11px;padding:2px 7px;border-radius:5px;background:${cc}22;color:${cc};font-weight:700">${cf}</span></td>
      </tr>`;
    });
    html += "</table>";
    box.innerHTML = html;
    grid.appendChild(box);
  });
  root.appendChild(grid);
}

document.querySelectorAll(".btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".btn").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    filter = btn.dataset.f;
    const isTeams = filter === "teams";
    const isStadiums = filter === "stadiums";
    
    document.getElementById("schedule").style.display = (isTeams || isStadiums) ? "none" : "block";
    document.getElementById("teamsView").style.display = isTeams ? "block" : "none";
    document.getElementById("stadiumsView").style.display = isStadiums ? "block" : "none";
    document.getElementById("legend").style.display = (isTeams || isStadiums) ? "none" : "flex";
    document.getElementById("mainNote").style.display = (isTeams || isStadiums) ? "none" : "block";
    document.getElementById("searchMatchView").style.display = "none";
    document.getElementById("toolbar").style.display = (isTeams || isStadiums) ? "none" : "flex";
    
    searchInput.value = "";
    searchResults.classList.remove("open");
    calSelected = null;
    document.getElementById('calToggleLabel').textContent = 'اختر يوم';
    document.getElementById('calDropdown').style.display = 'none';
    document.getElementById('calToggle').style.borderColor = 'var(--line)';
    document.getElementById('calToggle').style.color = 'var(--muted)';
    
    renderCal();
    if (isTeams) {
      renderTeams();
    } else if (isStadiums) {
      renderStadiums();
    } else {
      render();
    }
  };
});

// ── helpers ──────────────────────────────────────────────
function allMatches() {
  return groupStage.flatMap(day => day.m.map(mm => matchFromArray(mm, day.date)));
}
function matchRowHTML(m) {
  const [a, b] = [m.a, m.b];
  const result = m.result || liveResults[matchKey(m.day, a, b)] || null;
  const ta = isArab(a) ? '<span class="tag a">عربي</span>' : isBig(a) ? '<span class="tag b">⭐</span>' : '';
  const tb = isArab(b) ? '<span class="tag a">عربي</span>' : isBig(b) ? '<span class="tag b">⭐</span>' : '';
  const std = cityToStadium[m.c];
  const stdLink = std ? ` • <span class="stadium-tag" onclick="viewStadium('${std.id}')">${std.name}</span>` : '';
  return `<tr>
    <td class="grp"><span>${m.g}</span></td>
    <td class="match"><span class="${cls(a)}">${a}</span>${ta}${resultHTML(result)}<span class="${cls(b)}">${b}</span>${tb}</td>
    <td class="time"><b>${m.t}</b><div class="city">${m.c}${stdLink}</div></td>
  </tr>`;
}
function showMatchesPanel(title, matches) {
  const v = document.getElementById('searchMatchView');
  if (!matches.length) {
    v.style.display = 'none';
    return;
  }
  let html = `<div class="phase">${title}</div><div class="day"><table>`;
  matches.forEach(m => { html += matchRowHTML(m); });
  html += '</table></div>';
  v.innerHTML = html;
  v.style.display = 'block';
  document.getElementById('schedule').style.display = 'none';
  document.getElementById('legend').style.display = 'none';
}
function hideMatchesPanel() {
  document.getElementById('searchMatchView').style.display = 'none';
  document.getElementById('schedule').style.display = 'block';
  document.getElementById('legend').style.display = 'flex';
}

// ── SEARCH ───────────────────────────────────────────────
const allTeams = [...new Set(groupStage.flatMap(d => d.m.flatMap(m => [m[1], m[2]])))];
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  if (!q) {
    searchResults.classList.remove('open');
    hideMatchesPanel();
    render();
    return;
  }
  const hits = allTeams.filter(t => t.includes(q)).slice(0, 8);
  if (!hits.length) {
    searchResults.classList.remove('open');
    return;
  }
  searchResults.innerHTML = hits.map(t => {
    const ms = allMatches().filter(m => m.a.includes(t) || m.b.includes(t));
    return `<div class="sr-item" data-team="${t}"><div>${t}</div><div class="sr-sub">${ms.length} مباريات</div></div>`;
  }).join('');
  searchResults.classList.add('open');
});
searchResults.addEventListener('click', e => {
  const item = e.target.closest('.sr-item');
  if (!item) return;
  const team = item.dataset.team;
  searchInput.value = team;
  searchResults.classList.remove('open');
  const ms = allMatches().filter(m => m.a.includes(team) || m.b.includes(team));
  showMatchesPanel(`مباريات ${team}`, ms);
  calSelected = null;
  renderCal();
});
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) searchResults.classList.remove('open');
});

// ── CALENDAR ─────────────────────────────────────────────
const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const dowNames = ["أح", "ث", "ث", "أر", "خ", "ج", "س"]; // Note: preserving standard display
let calYear = 2026, calMonth = 5, calSelected = null;

function getCairoTodayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function openMatchesByISO(iso, options = {}) {
  const label = Object.entries(dateMap).find(([k, v]) => v === iso)?.[0] || iso;
  const day = groupStage.find(d => dateMap[d.date] === iso);
  const matches = day ? day.m.map(mm => matchFromArray(mm, day.date)) : [];

  calSelected = iso;
  calYear = Number(iso.slice(0, 4));
  calMonth = Number(iso.slice(5, 7)) - 1;
  renderCal();

  searchInput.value = "";
  searchResults.classList.remove("open");
  document.getElementById("calToggleLabel").textContent = label.replace(/^[^\s]+\s/, "");
  calDropdown.style.display = "none";
  calToggle.style.borderColor = "var(--gold)";
  calToggle.style.color = "var(--gold)";
  showMatchesPanel(`مباريات ${label}`, matches);

  if (options.clearActiveButtons) {
    document.querySelectorAll(".btn").forEach(x => x.classList.remove("active"));
  }
}

function renderCal() {
  document.getElementById('calTitle').textContent = `${monthNames[calMonth]} ${calYear}`;
  const grid = document.getElementById('calGrid');
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  let html = dowNames.map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const has = matchDays.has(iso);
    const sel = calSelected === iso;
    html += `<div class="cal-day${has ? ' has' : ''}${sel ? ' selected' : ''}" data-iso="${iso}">${d}</div>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.cal-day.has').forEach(el => {
    el.addEventListener('click', () => {
      const iso = el.dataset.iso;
      if (calSelected === iso) {
        calSelected = null;
        renderCal();
        hideMatchesPanel();
        render();
        document.getElementById('calToggleLabel').textContent = 'اختر يوم';
        return;
      }
      openMatchesByISO(iso);
    });
  });
}
document.getElementById('calPrev').onclick = () => {
  if (calMonth === 5 && calYear === 2026) return;
  calMonth--;
  if (calMonth < 0) {
    calMonth = 11;
    calYear--;
  }
  renderCal();
};
document.getElementById('calNext').onclick = () => {
  if (calMonth === 6 && calYear === 2026) return;
  calMonth++;
  if (calMonth > 11) {
    calMonth = 0;
    calYear++;
  }
  renderCal();
};

// toggle open/close
const calToggle = document.getElementById('calToggle');
const calDropdown = document.getElementById('calDropdown');
calToggle.addEventListener('click', e => {
  e.stopPropagation();
  const open = calDropdown.style.display === 'block';
  calDropdown.style.display = open ? 'none' : 'block';
  calToggle.style.borderColor = open ? 'var(--line)' : 'var(--gold)';
  calToggle.style.color = open ? 'var(--muted)' : 'var(--txt)';
});
document.addEventListener('click', e => {
  if (!e.target.closest('#calDropdown') && !e.target.closest('#calToggle')) {
    calDropdown.style.display = 'none';
    calToggle.style.borderColor = 'var(--line)';
    calToggle.style.color = 'var(--muted)';
  }
});

function normalizeExternalResults(payload) {
  const items = Array.isArray(payload) ? payload : (payload.matches || payload.results || []);
  return items
    .map(item => {
      const date = item.date || item.isoDate || item.day;
      const a = item.a || item.home || item.teamA || item.homeTeam;
      const b = item.b || item.away || item.teamB || item.awayTeam;
      const home = item.homeScore ?? item.scoreA ?? item.aScore ?? item.score?.home;
      const away = item.awayScore ?? item.scoreB ?? item.bScore ?? item.score?.away;
      if (!date || !a || !b || home === undefined || away === undefined) return null;
      return {
        key: matchKey(date, a, b),
        result: { home, away, status: item.status || "finished" }
      };
    })
    .filter(Boolean);
}

function applyExternalResults(payload) {
  normalizeExternalResults(payload).forEach(({ key, result }) => {
    liveResults[key] = result;
  });
}

function refreshCurrentScheduleView() {
  if (calSelected) {
    openMatchesByISO(calSelected);
    return;
  }
  render();
}

async function fetchExternalResults() {
  const endpoint = window.RESULTS_ENDPOINT || "";
  if (!endpoint) return;

  try {
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) throw new Error(`Results endpoint failed: ${res.status}`);
    applyExternalResults(await res.json());
    refreshCurrentScheduleView();
  } catch (err) {
    console.warn("Could not update match results", err);
  }
}

function initDefaultView() {
  const today = getCairoTodayISO();
  if (matchDays.has(today)) {
    openMatchesByISO(today, { clearActiveButtons: true });
    return;
  }
  render();
}

renderCal();
initDefaultView();
fetchExternalResults();
