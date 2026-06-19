// Live data integration — World Cup 2026
// Uses the Cloudflare Worker proxy; no football-data.org token is exposed here.

var liveStandings = {};

var WORKER_BASE = "https://worldcup2026-api.ayopwebdev.workers.dev";

// English (football-data.org) → Arabic team name mapping
var EN_TO_AR = {
  "Mexico": "المكسيك",
  "South Africa": "جنوب أفريقيا",
  "Korea Republic": "كوريا الجنوبية",
  "South Korea": "كوريا الجنوبية",
  "Czechia": "تشيكيا",
  "Czech Republic": "تشيكيا",
  "Canada": "كندا",
  "Bosnia and Herzegovina": "البوسنة والهرسك",
  "Bosnia Herzegovina": "البوسنة والهرسك",
  "Switzerland": "سويسرا",
  "Qatar": "قطر",
  "Brazil": "البرازيل",
  "Morocco": "المغرب",
  "Haiti": "هايتي",
  "Scotland": "اسكتلندا",
  "United States": "الولايات المتحدة",
  "USA": "الولايات المتحدة",
  "Paraguay": "باراغواي",
  "Australia": "أستراليا",
  "Turkey": "تركيا",
  "Türkiye": "تركيا",
  "Germany": "ألمانيا",
  "Curaçao": "كوراساو",
  "Curacao": "كوراساو",
  "Ivory Coast": "ساحل العاج",
  "Côte d'Ivoire": "ساحل العاج",
  "Ecuador": "الإكوادور",
  "Netherlands": "هولندا",
  "Japan": "اليابان",
  "Sweden": "السويد",
  "Tunisia": "تونس",
  "Belgium": "بلجيكا",
  "Egypt": "مصر",
  "Iran": "إيران",
  "IR Iran": "إيران",
  "Islamic Republic of Iran": "إيران",
  "New Zealand": "نيوزيلندا",
  "Spain": "إسبانيا",
  "Cape Verde": "الرأس الأخضر",
  "Saudi Arabia": "السعودية",
  "Uruguay": "الأوروغواي",
  "France": "فرنسا",
  "Senegal": "السنغال",
  "Norway": "النرويج",
  "Iraq": "العراق",
  "Argentina": "الأرجنتين",
  "Austria": "النمسا",
  "Algeria": "الجزائر",
  "Jordan": "الأردن",
  "Portugal": "البرتغال",
  "Uzbekistan": "أوزبكستان",
  "Colombia": "كولومبيا",
  "Congo DR": "الكونغو الديمقراطية",
  "DR Congo": "الكونغو الديمقراطية",
  "Democratic Republic of Congo": "الكونغو الديمقراطية",
  "England": "إنجلترا",
  "Croatia": "كرواتيا",
  "Ghana": "غانا",
  "Panama": "بنما"
};

// Fetch /matches from Worker and merge results into the shared liveResults map
function fetchAndMergeMatches() {
  return fetch(WORKER_BASE + "/matches", { cache: "no-store" })
    .then(function(res) {
      if (!res.ok) throw new Error("matches " + res.status);
      return res.json();
    })
    .then(function(json) {
      var apiMatches = Array.isArray(json) ? json : (json.matches || []);
      var count = 0;

      apiMatches.forEach(function(m) {
        var status = m.status;
        if (status === "TIMED" || status === "SCHEDULED") return;

        var homeEn = m.homeTeam && m.homeTeam.name;
        var awayEn = m.awayTeam && m.awayTeam.name;
        if (!homeEn || !awayEn) return;

        var homeAr = EN_TO_AR[homeEn];
        var awayAr = EN_TO_AR[awayEn];
        if (!homeAr || !awayAr) {
          console.warn("[live] no Arabic mapping for:", homeEn, "/", awayEn);
          return;
        }

        var day = null;
        var local = null;
        for (var i = 0; i < groupStage.length; i++) {
          for (var j = 0; j < groupStage[i].m.length; j++) {
            var candidate = groupStage[i].m[j];
            if ((candidate[1] === homeAr && candidate[2] === awayAr) ||
                (candidate[1] === awayAr && candidate[2] === homeAr)) {
              day = groupStage[i];
              local = candidate;
              break;
            }
          }
          if (local) break;
        }
        if (!day || !local) return;

        // Results are keyed by FIFA's official fixture date, even when Cairo
        // kick-off is after midnight on the following calendar day.
        var arabicDate = day.date;

        // Handle no-score statuses
        if (status === "POSTPONED" || status === "CANCELLED") {
          liveResults[matchKey(arabicDate, local[1], local[2])] = {
            home: null, away: null, status: status
          };
          count++;
          return;
        }

        var sc = m.score && m.score.fullTime;
        if (!sc || sc.home === null || sc.away === null) return;

        // Swap scores if API home/away is inverted relative to our local order
        var swapped = (local[1] === awayAr);
        liveResults[matchKey(arabicDate, local[1], local[2])] = {
          home: swapped ? sc.away : sc.home,
          away: swapped ? sc.home : sc.away,
          status: status
        };
        count++;
      });

      return count;
    });
}

// Fetch /standings from Worker and populate liveStandings
function fetchAndStoreStandings() {
  return fetch(WORKER_BASE + "/standings", { cache: "no-store" })
    .then(function(res) {
      if (!res.ok) throw new Error("standings " + res.status);
      return res.json();
    })
    .then(function(json) {
      (json.standings || []).forEach(function(grp) {
        if (!grp.group || !grp.table) return;
        var letter = grp.group.replace("Group ", "").trim();
        if (!letter || letter.length > 2) return;
        liveStandings[letter] = grp.table.map(function(row) {
          return {
            position: row.position,
            nameEn: row.team.name,
            nameAr: EN_TO_AR[row.team.name] || row.team.name,
            tla: row.team.tla,
            played: row.playedGames,
            won: row.won,
            draw: row.draw,
            lost: row.lost,
            gf: row.goalsFor,
            ga: row.goalsAgainst,
            gd: row.goalDifference,
            points: row.points
          };
        });
      });
    });
}

function setIndicator(mode) {
  var el = document.getElementById("liveIndicator");
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
  var dot = document.createElement("span");
  if (mode === "live") {
    var t = new Date().toLocaleTimeString("ar-EG", {
      hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo"
    });
    dot.className = "ind-dot live-dot";
    el.appendChild(dot);
    el.appendChild(document.createTextNode(" بيانات مباشرة · آخر تحديث: " + t));
    el.className = "live-ind live-ind--on";
  } else {
    dot.className = "ind-dot static-dot";
    el.appendChild(dot);
    el.appendChild(document.createTextNode(" بيانات محفوظة"));
    el.className = "live-ind live-ind--off";
  }
}

function refreshLiveData() {
  Promise.all([fetchAndMergeMatches(), fetchAndStoreStandings()])
    .then(function(results) {
      setIndicator("live");
      try {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: 'wc_live_data_loaded',
          matches_count: results[0] || 0,
          standings_groups_count: Object.keys(liveStandings).length,
          source: 'cloudflare_worker',
          updated_at: new Date().toISOString()
        });
      } catch (_) {}
      if (typeof filter !== "undefined" && filter === "teams") {
        if (typeof renderTeams === "function") renderTeams();
      } else {
        if (typeof refreshCurrentScheduleView === "function") refreshCurrentScheduleView();
      }
    })
    .catch(function(err) {
      console.warn("[live] fetch error:", err.message || err);
      setIndicator("static");
      try {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: 'wc_api_fallback_used',
          reason: err.message || String(err),
          source: 'static'
        });
      } catch (_) {}
    });
}

// Kick off immediately, then refresh every 60 seconds
refreshLiveData();
setInterval(refreshLiveData, 60000);
