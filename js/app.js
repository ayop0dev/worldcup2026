window.dataLayer = window.dataLayer || [];
function track(event, params) {
  try { window.dataLayer.push(Object.assign({ event: event }, params)); } catch (_) {}
}

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
  if (!r) return '<span class="vs">×</span>';

  const st = (r.status || "finished").toUpperCase();

  if (st === "POSTPONED") return '<span class="vs" style="color:var(--gold);font-size:11px">مؤجلة</span>';
  if (st === "CANCELLED")  return '<span class="vs" style="color:var(--red);font-size:11px">ملغاة</span>';
  if (st === "TIMED" || st === "SCHEDULED") return '<span class="vs">×</span>';

  if (r.home === undefined || r.home === null || r.away === undefined || r.away === null) {
    return '<span class="vs">×</span>';
  }

  const isLive   = st === "IN_PLAY" || st === "LIVE";
  const isPaused = st === "PAUSED";
  const label    = isLive ? "🔴" : isPaused ? "استراحة" : "انتهت";
  const scoreCls = (isLive || isPaused) ? " live" : "";

  return `<span class="score${scoreCls}"><b>${r.home}</b><span>-</span><b>${r.away}</b><em>${label}</em></span>`;
}

function timeHTML(result, t) {
  const r = normalizeResult(result);
  if (!r) return `<b>${t}</b>`;
  const st = (r.status || "finished").toUpperCase();
  if (st === "FINISHED" || st === "FT" || st === "AWARDED") {
    return '<b style="color:var(--muted);font-size:12px;letter-spacing:0">انتهت</b>';
  }
  if (st === "IN_PLAY" || st === "LIVE") {
    return '<b style="color:var(--green);font-size:12px;letter-spacing:0">🔴 مباشر</b>';
  }
  if (st === "PAUSED") {
    return '<b style="color:var(--gold);font-size:12px;letter-spacing:0">استراحة</b>';
  }
  return `<b>${t}</b>`;
}

function render() {
  const root = document.getElementById("schedule");
  root.innerHTML = "";

  const ph = document.createElement("div");
  ph.className = "phase";
  ph.textContent = "دور المجموعات";
  root.appendChild(ph);

  let shown = 0;
  const todayISO = filter === "today" ? getCairoTodayISO() : null;
  groupStage.forEach(day => {
    const rows = day.m.filter(mm => {
      if (filter === "today") return dateMap[day.date] === todayISO;
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
        <td class="time">${timeHTML(result, t)}<div class="city">${c}${stdLink}</div></td>`;
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
  const _sd = typeof stadiums !== 'undefined' && stadiums.find(s => s.id === id);
  track('wc_stadium_open', { stadium_id: id, stadium_name: _sd ? _sd.nameAr : id });
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
  document.getElementById("toolbar").style.display = "flex";
  
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

// Build { "المكسيك": "🇲🇽", ... } from the groups data
function buildFlagMap() {
  const map = {};
  Object.values(groups).forEach(arr => arr.forEach(t => {
    const tn = teamName(t);
    map[tn] = t.replace(tn, '').trim();
  }));
  return map;
}

// Compute standings for group g from liveResults (fallback when API standings unavailable)
function computeGroupStandings(g) {
  const rows = {};
  (groups[g] || []).forEach(t => {
    const tn = teamName(t);
    rows[tn] = { nameAr: tn, played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
  });

  groupStage.forEach(day => {
    day.m.filter(mm => mm[0] === g).forEach(mm => {
      const r = normalizeResult(liveResults[matchKey(day.date, mm[1], mm[2])]);
      if (!r || r.home === null || r.away === null) return;
      const st = (r.status || "finished").toUpperCase();
      if (st === "TIMED" || st === "SCHEDULED" || st === "POSTPONED" || st === "CANCELLED") return;

      const [a, b] = [mm[1], mm[2]];
      if (!rows[a] || !rows[b]) return;
      const ha = r.home, hb = r.away;
      rows[a].played++; rows[b].played++;
      rows[a].gf += ha; rows[a].ga += hb;
      rows[b].gf += hb; rows[b].ga += ha;
      rows[a].gd = rows[a].gf - rows[a].ga;
      rows[b].gd = rows[b].gf - rows[b].ga;
      if (ha > hb) { rows[a].won++; rows[a].points += 3; rows[b].lost++; }
      else if (ha < hb) { rows[b].won++; rows[b].points += 3; rows[a].lost++; }
      else { rows[a].draw++; rows[a].points++; rows[b].draw++; rows[b].points++; }
    });
  });

  return Object.values(rows)
    .sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf)
    .map((s, i) => ({ ...s, position: i + 1 }));
}

// Return live standings if available; fall back to computed standings
function getGroupStandings(g) {
  if (typeof liveStandings !== "undefined" && liveStandings[g] && liveStandings[g].length) {
    return liveStandings[g];
  }
  return computeGroupStandings(g);
}

function renderTeams() {
  const root = document.getElementById("teamsView");
  root.innerHTML = "";
  const flagMap = buildFlagMap();

  // Confederation summary
  const confCounts = {};
  Object.values(confed).forEach(c => confCounts[c] = (confCounts[c] || 0) + 1);
  const sumDiv = document.createElement("div");
  sumDiv.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;justify-content:center";
  Object.entries(confCounts).forEach(([c, n]) => {
    const sp = document.createElement("span");
    sp.style.cssText = `background:${confedColor[c]}22;border:1px solid ${confedColor[c]}55;color:${confedColor[c]};padding:5px 14px;border-radius:999px;font-size:13px;font-weight:700`;
    sp.textContent = `${c} — ${n}`;
    sumDiv.appendChild(sp);
  });
  root.appendChild(sumDiv);

  const grid = document.createElement("div");
  grid.className = "teams-grid";

  Object.keys(groups).forEach(g => {
    const standings = getGroupStandings(g);
    const box = document.createElement("div");
    box.className = "group-block";

    // ── Group header ──
    const hdr = document.createElement("div");
    hdr.className = "group-header";
    const badge = document.createElement("span");
    badge.className = "grp-badge";
    badge.textContent = g;
    const title = document.createElement("span");
    title.className = "grp-title";
    title.textContent = `المجموعة ${g}`;
    hdr.appendChild(badge);
    hdr.appendChild(title);
    box.appendChild(hdr);

    // ── Standings table ──
    const scrollWrap = document.createElement("div");
    scrollWrap.className = "std-scroll";

    const tbl = document.createElement("table");
    tbl.className = "std-table";

    const thead = document.createElement("thead");
    const hRow = document.createElement("tr");
    ["#", "المنتخب", "لعب", "فوز", "تعادل", "خسارة", "له", "عليه", "فرق", "نقاط"].forEach((col, i) => {
      const th = document.createElement("th");
      th.textContent = col;
      th.className = i === 0 ? "std-pos" : i === 1 ? "std-team-h" : "std-num";
      hRow.appendChild(th);
    });
    thead.appendChild(hRow);
    tbl.appendChild(thead);

    const tbody = document.createElement("tbody");
    standings.forEach(row => {
      const tr = document.createElement("tr");
      const isAr = ARAB.has(row.nameAr);
      const isBg = BIG.has(row.nameAr);
      if (isAr) tr.style.background = "rgba(30,166,114,.06)";
      else if (isBg) tr.style.background = "rgba(212,164,55,.04)";

      // Position
      const tdPos = document.createElement("td");
      tdPos.className = "std-pos";
      tdPos.textContent = row.position;
      tr.appendChild(tdPos);

      // Team name + flag
      const tdTeam = document.createElement("td");
      tdTeam.className = "std-team";
      const flagSpan = document.createElement("span");
      flagSpan.className = "std-flag";
      flagSpan.textContent = flagMap[row.nameAr] || "";
      const nameSpan = document.createElement("span");
      nameSpan.textContent = row.nameAr;
      nameSpan.style.color = isAr ? "var(--green)" : isBg ? "var(--gold)" : "var(--txt)";
      tdTeam.appendChild(flagSpan);
      tdTeam.appendChild(nameSpan);
      tr.appendChild(tdTeam);

      // Numeric stats
      const nums = [row.played, row.won, row.draw, row.lost, row.gf, row.ga,
                    (row.gd > 0 ? "+" : "") + row.gd, row.points];
      nums.forEach((val, idx) => {
        const td = document.createElement("td");
        td.className = idx === 7 ? "std-num std-pts" : "std-num";
        if (idx === 7 && row.points > 0) {
          td.style.cssText = "color:var(--gold);font-weight:800";
        }
        td.textContent = val;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    scrollWrap.appendChild(tbl);
    box.appendChild(scrollWrap);

    // ── Group matches ──
    const groupMatchRows = [];
    groupStage.forEach(day => {
      day.m.filter(mm => mm[0] === g).forEach(mm => {
        groupMatchRows.push(matchFromArray(mm, day.date));
      });
    });

    if (groupMatchRows.length) {
      const matchDiv = document.createElement("div");
      matchDiv.className = "group-matches";
      const mt = document.createElement("table");
      // matchRowHTML builds from static data.js strings + integer scores + hardcoded labels only
      let rowsHtml = "";
      groupMatchRows.forEach(m => { rowsHtml += matchRowHTML(m); });
      mt.innerHTML = rowsHtml;
      matchDiv.appendChild(mt);
      box.appendChild(matchDiv);
    }

    grid.appendChild(box);
  });

  root.appendChild(grid);
}

document.querySelectorAll(".btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".btn").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    filter = btn.dataset.f;
    track('wc_filter_click', { filter: filter, label: btn.textContent.trim() });
    const isTeams = filter === "teams";
    const isStadiums = filter === "stadiums";
    
    document.getElementById("schedule").style.display = (isTeams || isStadiums) ? "none" : "block";
    document.getElementById("teamsView").style.display = isTeams ? "block" : "none";
    document.getElementById("stadiumsView").style.display = isStadiums ? "block" : "none";
    document.getElementById("legend").style.display = (isTeams || isStadiums) ? "none" : "flex";
    document.getElementById("mainNote").style.display = (isTeams || isStadiums) ? "none" : "block";
    document.getElementById("searchMatchView").style.display = "none";
    document.getElementById("toolbar").style.display = "flex";
    
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
    <td class="time">${timeHTML(result, m.t)}<div class="city">${m.c}${stdLink}</div></td>
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
let _searchTimer = null;

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
  if (q.length >= 2) {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      track('wc_team_search', { query: q, result_count: hits.length });
    }, 600);
  }
});
searchResults.addEventListener('click', e => {
  const item = e.target.closest('.sr-item');
  if (!item) return;
  const team = item.dataset.team;
  searchInput.value = team;
  searchResults.classList.remove('open');
  const ms = allMatches().filter(m => m.a.includes(team) || m.b.includes(team));
  track('wc_team_open', { team: team, match_count: ms.length });
  showMatchesPanel(`مباريات ${team}`, ms);
  calSelected = null;
  renderCal();
});
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) searchResults.classList.remove('open');
});

document.getElementById("homeIcon")?.addEventListener("click", e => {
  e.preventDefault();
  document.getElementById("bToday")?.click();
  window.scrollTo({ top: 0, behavior: "smooth" });
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

  track('wc_calendar_day_select', { date: iso, label: label, match_count: matches.length });
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
    filter = "today";
    document.querySelectorAll(".btn").forEach(x => x.classList.toggle("active", x.dataset.f === "today"));
    render();
    return;
  }
  render();
}

renderCal();
initDefaultView();
fetchExternalResults();
