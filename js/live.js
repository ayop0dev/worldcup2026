// Live data integration — World Cup 2026
// Uses the Cloudflare Worker proxy; no football-data.org token is exposed here.

var liveStandings = {};
var liveSyncSummary = null;
var liveKnockoutMatches = [];

// FIFA's official bracket order is not chronological. Keeping the match
// numbers here lets the UI place every fixture on the correct route to the
// final, even when football-data.org returns only part of the knockout list.
var KNOCKOUT_STAGE_ORDER = {
  LAST_32: [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
  LAST_16: [89, 90, 93, 94, 91, 92, 95, 96],
  QUARTER_FINALS: [97, 98, 99, 100],
  SEMI_FINALS: [101, 102],
  FINAL: [104]
};

var KNOCKOUT_MATCH_NUMBER_BY_UTC = {
  "2026-06-28T19:00:00Z": 73,
  "2026-06-29T20:30:00Z": 74,
  "2026-06-30T01:00:00Z": 75,
  "2026-06-29T17:00:00Z": 76,
  "2026-06-30T21:00:00Z": 77,
  "2026-06-30T17:00:00Z": 78,
  "2026-07-01T01:00:00Z": 79,
  "2026-07-01T16:00:00Z": 80,
  "2026-07-02T00:00:00Z": 81,
  "2026-07-01T20:00:00Z": 82,
  "2026-07-02T23:00:00Z": 83,
  "2026-07-02T19:00:00Z": 84,
  "2026-07-03T03:00:00Z": 85,
  "2026-07-03T22:00:00Z": 86,
  "2026-07-04T01:30:00Z": 87,
  "2026-07-03T18:00:00Z": 88,
  "2026-07-04T21:00:00Z": 89,
  "2026-07-04T17:00:00Z": 90,
  "2026-07-05T20:00:00Z": 91,
  "2026-07-06T00:00:00Z": 92,
  "2026-07-06T19:00:00Z": 93,
  "2026-07-07T00:00:00Z": 94,
  "2026-07-07T16:00:00Z": 95,
  "2026-07-07T20:00:00Z": 96,
  "2026-07-09T20:00:00Z": 97,
  "2026-07-10T19:00:00Z": 98,
  "2026-07-11T21:00:00Z": 99,
  "2026-07-12T01:00:00Z": 100,
  "2026-07-14T19:00:00Z": 101,
  "2026-07-15T19:00:00Z": 102,
  "2026-07-18T21:00:00Z": 103,
  "2026-07-19T19:00:00Z": 104
};

// Round-of-32 slots published by FIFA. Group positions are resolved from the
// live standings only after all four teams in that group have played 3 games.
var ROUND_OF_32_TEMPLATE = [
  { number: 73, utcDate: "2026-06-28T19:00:00Z", home: { group: "A", position: 2 }, away: { group: "B", position: 2 } },
  { number: 74, utcDate: "2026-06-29T20:30:00Z", home: { group: "E", position: 1 }, away: { third: "A/B/C/D/F" } },
  { number: 75, utcDate: "2026-06-30T01:00:00Z", home: { group: "F", position: 1 }, away: { group: "C", position: 2 } },
  { number: 76, utcDate: "2026-06-29T17:00:00Z", home: { group: "C", position: 1 }, away: { group: "F", position: 2 } },
  { number: 77, utcDate: "2026-06-30T21:00:00Z", home: { group: "I", position: 1 }, away: { third: "C/D/F/G/H" } },
  { number: 78, utcDate: "2026-06-30T17:00:00Z", home: { group: "E", position: 2 }, away: { group: "I", position: 2 } },
  { number: 79, utcDate: "2026-07-01T01:00:00Z", home: { group: "A", position: 1 }, away: { third: "C/E/F/H/I" } },
  { number: 80, utcDate: "2026-07-01T16:00:00Z", home: { group: "L", position: 1 }, away: { third: "E/H/I/J/K" } },
  { number: 81, utcDate: "2026-07-02T00:00:00Z", home: { group: "D", position: 1 }, away: { third: "B/E/F/I/J" } },
  { number: 82, utcDate: "2026-07-01T20:00:00Z", home: { group: "G", position: 1 }, away: { third: "A/E/H/I/J" } },
  { number: 83, utcDate: "2026-07-02T23:00:00Z", home: { group: "K", position: 2 }, away: { group: "L", position: 2 } },
  { number: 84, utcDate: "2026-07-02T19:00:00Z", home: { group: "H", position: 1 }, away: { group: "J", position: 2 } },
  { number: 85, utcDate: "2026-07-03T03:00:00Z", home: { group: "B", position: 1 }, away: { third: "E/F/G/I/J" } },
  { number: 86, utcDate: "2026-07-03T22:00:00Z", home: { group: "J", position: 1 }, away: { group: "H", position: 2 } },
  { number: 87, utcDate: "2026-07-04T01:30:00Z", home: { group: "K", position: 1 }, away: { third: "D/E/I/J/L" } },
  { number: 88, utcDate: "2026-07-03T18:00:00Z", home: { group: "D", position: 2 }, away: { group: "G", position: 2 } }
];

function setKnockoutBracketMetadata(match) {
  if (!match) return match;
  match.matchNumber = match.matchNumber || KNOCKOUT_MATCH_NUMBER_BY_UTC[match.utcDate] || null;
  var order = KNOCKOUT_STAGE_ORDER[match.stage] || [];
  match.bracketSlot = match.matchNumber ? order.indexOf(match.matchNumber) : -1;
  return match;
}

function resolveQualifiedTeam(slot) {
  if (slot.third) {
    return "\u0623\u0641\u0636\u0644 \u062b\u0627\u0644\u062b (" + slot.third + ")";
  }
  var table = liveStandings[slot.group];
  if (!table || table.length !== 4 || table.some(function(row) { return row.played < 3; })) return null;
  var row = table.find(function(team) { return team.position === slot.position; });
  return row ? row.nameAr : null;
}

function hydrateRoundOf32FromStandings() {
  ROUND_OF_32_TEMPLATE.forEach(function(template) {
    var match = liveKnockoutMatches.find(function(candidate) {
      return candidate.matchNumber === template.number;
    });
    if (!match) {
      match = {
        id: "fallback-" + template.number,
        matchNumber: template.number,
        stage: "LAST_32",
        utcDate: template.utcDate,
        status: "TIMED",
        home: null,
        away: null,
        homeScore: null,
        awayScore: null
      };
      liveKnockoutMatches.push(match);
    }

    match.home = match.home || resolveQualifiedTeam(template.home);
    match.away = match.away || resolveQualifiedTeam(template.away);
    setKnockoutBracketMetadata(match);
  });
}

function knockoutStageForMatchNumber(number) {
  if (number <= 88) return "LAST_32";
  if (number <= 96) return "LAST_16";
  if (number <= 100) return "QUARTER_FINALS";
  if (number <= 102) return "SEMI_FINALS";
  if (number === 103) return "THIRD_PLACE";
  return "FINAL";
}

function hydrateFullKnockoutSchedule() {
  Object.keys(KNOCKOUT_MATCH_NUMBER_BY_UTC).forEach(function(utcDate) {
    var number = KNOCKOUT_MATCH_NUMBER_BY_UTC[utcDate];
    var exists = liveKnockoutMatches.some(function(match) {
      return match.matchNumber === number;
    });
    if (exists) return;

    liveKnockoutMatches.push(setKnockoutBracketMetadata({
      id: "fallback-" + number,
      matchNumber: number,
      stage: knockoutStageForMatchNumber(number),
      utcDate: utcDate,
      status: "TIMED",
      home: null,
      away: null,
      homeScore: null,
      awayScore: null
    }));
  });
}

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
  "Bosnia-Herzegovina": "البوسنة والهرسك",
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
  "Cape Verde Islands": "الرأس الأخضر",
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
      liveKnockoutMatches = [];
      var summary = {
        received: apiMatches.length,
        receivedGroup: 0,
        matched: 0,
        localTotal: groupStage.reduce(function(total, day) { return total + day.m.length; }, 0),
        unmappedTeams: [],
        unmatchedFixtures: []
      };

      apiMatches.forEach(function(m) {
        var status = m.status;
        if (m.stage === "GROUP_STAGE") summary.receivedGroup++;

        var homeEn = m.homeTeam && m.homeTeam.name;
        var awayEn = m.awayTeam && m.awayTeam.name;
        if (m.stage && m.stage !== "GROUP_STAGE") {
          var knockoutScore = m.score && m.score.fullTime;
          liveKnockoutMatches.push(setKnockoutBracketMetadata({
            id: m.id,
            stage: m.stage,
            utcDate: m.utcDate,
            status: status,
            home: homeEn ? (EN_TO_AR[homeEn] || homeEn) : null,
            away: awayEn ? (EN_TO_AR[awayEn] || awayEn) : null,
            homeScore: knockoutScore && knockoutScore.home !== null ? knockoutScore.home : null,
            awayScore: knockoutScore && knockoutScore.away !== null ? knockoutScore.away : null
          }));
          return;
        }
        if (!homeEn || !awayEn) return;

        var homeAr = EN_TO_AR[homeEn];
        var awayAr = EN_TO_AR[awayEn];
        if (!homeAr || !awayAr) {
          if (!homeAr && summary.unmappedTeams.indexOf(homeEn) === -1) summary.unmappedTeams.push(homeEn);
          if (!awayAr && summary.unmappedTeams.indexOf(awayEn) === -1) summary.unmappedTeams.push(awayEn);
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
        if (!day || !local) {
          summary.unmatchedFixtures.push(homeEn + " vs " + awayEn);
          return;
        }

        // Results are keyed by FIFA's official fixture date, even when Cairo
        // kick-off is after midnight on the following calendar day.
        var arabicDate = day.date;

        // Handle no-score statuses
        if (status === "POSTPONED" || status === "CANCELLED") {
          liveResults[matchKey(arabicDate, local[1], local[2])] = {
            home: null, away: null, status: status, utcDate: m.utcDate, id: m.id
          };
          summary.matched++;
          return;
        }

        var sc = m.score && m.score.fullTime;
        var apiHomeScore = sc && sc.home !== null ? sc.home : null;
        var apiAwayScore = sc && sc.away !== null ? sc.away : null;

        // Swap scores if API home/away is inverted relative to our local order
        var swapped = (local[1] === awayAr);
        liveResults[matchKey(arabicDate, local[1], local[2])] = {
          home: swapped ? apiAwayScore : apiHomeScore,
          away: swapped ? apiHomeScore : apiAwayScore,
          status: status,
          utcDate: m.utcDate,
          id: m.id
        };
        summary.matched++;
      });

      liveKnockoutMatches.sort(function(a, b) {
        if (a.stage === b.stage && a.bracketSlot >= 0 && b.bracketSlot >= 0) {
          return a.bracketSlot - b.bracketSlot;
        }
        return String(a.utcDate || "").localeCompare(String(b.utcDate || ""));
      });

      liveSyncSummary = summary;
      return summary;
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

function setIndicator(mode, summary) {
  var el = document.getElementById("liveIndicator");
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
  var dot = document.createElement("span");
  if (mode === "live" || mode === "partial") {
    var t = new Date().toLocaleTimeString("ar-EG", {
      hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo"
    });
    dot.className = "ind-dot live-dot";
    el.appendChild(dot);
    var coverage = summary ? " · " + summary.matched + " من " + summary.localTotal + " مباراة متزامنة" : "";
    el.appendChild(document.createTextNode(" بيانات مباشرة" + coverage + " · آخر تحديث: " + t));
    el.className = mode === "partial" ? "live-ind live-ind--partial" : "live-ind live-ind--on";
  } else {
    dot.className = "ind-dot static-dot";
    el.appendChild(dot);
    el.appendChild(document.createTextNode(" بيانات محفوظة"));
    el.className = "live-ind live-ind--off";
  }
}

function refreshLiveData() {
  var matchesError = null;
  var standingsError = null;
  Promise.all([
    fetchAndMergeMatches().catch(function(err) {
      matchesError = err;
      return null;
    }),
    fetchAndStoreStandings().catch(function(err) {
      standingsError = err;
      return null;
    })
  ])
    .then(function(results) {
      var summary = results[0];
      hydrateRoundOf32FromStandings();
      hydrateFullKnockoutSchedule();
      if (summary) {
        var syncMode = summary.matched < summary.localTotal ? "partial" : "live";
        setIndicator(syncMode, summary);
      } else {
        setIndicator("static");
      }
      if (matchesError) console.warn("[live] matches fetch error:", matchesError.message || matchesError);
      if (standingsError) console.warn("[live] standings fetch error:", standingsError.message || standingsError);
      try {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: summary ? 'wc_live_data_loaded' : 'wc_api_fallback_used',
          matches_count: summary ? summary.matched : 0,
          matches_total: summary ? summary.localTotal : 0,
          api_matches_received: summary ? summary.received : 0,
          standings_groups_count: Object.keys(liveStandings).length,
          source: summary ? 'cloudflare_worker' : 'static',
          standings_available: !standingsError,
          updated_at: new Date().toISOString()
        });
      } catch (_) {}
      if (typeof filter !== "undefined" && filter === "teams") {
        if (typeof renderTeams === "function") renderTeams();
      } else {
        if (typeof refreshCurrentScheduleView === "function") refreshCurrentScheduleView();
      }
    });
}

// Kick off immediately, then refresh every 60 seconds
refreshLiveData();
setInterval(refreshLiveData, 60000);
