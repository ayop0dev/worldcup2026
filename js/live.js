// Live data integration — World Cup 2026
// Uses the Cloudflare Worker proxy; no football-data.org token is exposed here.

var liveStandings = {};
var liveSyncSummary = null;
var liveKnockoutMatches = [];
var liveRefreshInFlight = false;

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

// Confirmed Round-of-32 fixtures after the group stage was completed.
// These are the authoritative fallback when football-data.org omits a match.
var ROUND_OF_32_TEMPLATE = [
  { number: 73, utcDate: "2026-06-28T19:00:00Z", home: "جنوب أفريقيا", away: "كندا" },
  { number: 74, utcDate: "2026-06-29T20:30:00Z", home: "ألمانيا", away: "باراغواي" },
  { number: 75, utcDate: "2026-06-30T01:00:00Z", home: "هولندا", away: "المغرب" },
  { number: 76, utcDate: "2026-06-29T17:00:00Z", home: "البرازيل", away: "اليابان" },
  { number: 77, utcDate: "2026-06-30T21:00:00Z", home: "فرنسا", away: "السويد" },
  { number: 78, utcDate: "2026-06-30T17:00:00Z", home: "ساحل العاج", away: "النرويج" },
  { number: 79, utcDate: "2026-07-01T01:00:00Z", home: "المكسيك", away: "الإكوادور" },
  { number: 80, utcDate: "2026-07-01T16:00:00Z", home: "إنجلترا", away: "الكونغو الديمقراطية" },
  { number: 81, utcDate: "2026-07-02T00:00:00Z", home: "الولايات المتحدة", away: "البوسنة والهرسك" },
  { number: 82, utcDate: "2026-07-01T20:00:00Z", home: "بلجيكا", away: "السنغال" },
  { number: 83, utcDate: "2026-07-02T23:00:00Z", home: "البرتغال", away: "كرواتيا" },
  { number: 84, utcDate: "2026-07-02T19:00:00Z", home: "إسبانيا", away: "النمسا" },
  { number: 85, utcDate: "2026-07-03T03:00:00Z", home: "سويسرا", away: "الجزائر" },
  { number: 86, utcDate: "2026-07-03T22:00:00Z", home: "الأرجنتين", away: "الرأس الأخضر" },
  { number: 87, utcDate: "2026-07-04T01:30:00Z", home: "كولومبيا", away: "غانا" },
  { number: 88, utcDate: "2026-07-03T18:00:00Z", home: "أستراليا", away: "مصر" }
];

function setKnockoutBracketMetadata(match) {
  if (!match) return match;
  match.matchNumber = match.matchNumber || KNOCKOUT_MATCH_NUMBER_BY_UTC[match.utcDate] || null;
  var order = KNOCKOUT_STAGE_ORDER[match.stage] || [];
  match.bracketSlot = match.matchNumber ? order.indexOf(match.matchNumber) : -1;
  return match;
}

function hydrateConfirmedRoundOf32() {
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

    match.home = match.home || template.home;
    match.away = match.away || template.away;
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
      var nextKnockoutMatches = [];
      var nextLiveResults = Object.assign({}, liveResults);
      var summary = {
        received: apiMatches.length,
        receivedGroup: 0,
        receivedRoundOf32: 0,
        matched: 0,
        localTotal: groupStage.reduce(function(total, day) { return total + day.m.length; }, 0),
        unmappedTeams: [],
        unmatchedFixtures: []
      };

      apiMatches.forEach(function(m) {
        var status = m.status;
        if (m.stage === "GROUP_STAGE") summary.receivedGroup++;
        if (m.stage === "LAST_32") summary.receivedRoundOf32++;

        var homeEn = m.homeTeam && m.homeTeam.name;
        var awayEn = m.awayTeam && m.awayTeam.name;
        if (m.stage && m.stage !== "GROUP_STAGE") {
          var knockoutScore = m.score && m.score.fullTime;
          nextKnockoutMatches.push(setKnockoutBracketMetadata({
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
          nextLiveResults[matchKey(arabicDate, local[1], local[2])] = {
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
        nextLiveResults[matchKey(arabicDate, local[1], local[2])] = {
          home: swapped ? apiAwayScore : apiHomeScore,
          away: swapped ? apiHomeScore : apiAwayScore,
          status: status,
          utcDate: m.utcDate,
          id: m.id
        };
        summary.matched++;
      });

      nextKnockoutMatches.sort(function(a, b) {
        if (a.stage === b.stage && a.bracketSlot >= 0 && b.bracketSlot >= 0) {
          return a.bracketSlot - b.bracketSlot;
        }
        return String(a.utcDate || "").localeCompare(String(b.utcDate || ""));
      });

      liveResults = nextLiveResults;
      liveKnockoutMatches = nextKnockoutMatches;
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
      var nextStandings = {};
      (json.standings || []).forEach(function(grp) {
        if (!grp.group || !grp.table) return;
        var letter = grp.group.replace("Group ", "").trim();
        if (!letter || letter.length > 2) return;
        nextStandings[letter] = grp.table.map(function(row) {
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
      if (Object.keys(nextStandings).length !== 12) {
        throw new Error("standings incomplete: " + Object.keys(nextStandings).length + "/12");
      }
      liveStandings = nextStandings;
      return nextStandings;
    });
}

function completedGroupResult(result) {
  if (!result) return false;
  var status = String(result.status || "").toUpperCase();
  return status !== "TIMED" && status !== "SCHEDULED" &&
    status !== "POSTPONED" && status !== "CANCELLED" &&
    Number.isFinite(Number(result.home)) && Number.isFinite(Number(result.away));
}

// football-data.org currently omits one finished fixture from four groups.
// When exactly one fixture is absent, the final GF/GA totals determine its
// score uniquely. We accept it only when both teams produce the same score.
function reconcileMissingGroupResultsFromStandings() {
  var restored = 0;

  Object.keys(liveStandings).forEach(function(group) {
    var table = liveStandings[group];
    if (!table || table.length !== 4 || table.some(function(row) { return row.played !== 3; })) return;

    var totals = {};
    table.forEach(function(row) {
      totals[row.nameAr] = { gf: 0, ga: 0, targetGf: row.gf, targetGa: row.ga };
    });

    var missing = [];
    groupStage.forEach(function(day) {
      day.m.filter(function(match) { return match[0] === group; }).forEach(function(match) {
        var key = matchKey(day.date, match[1], match[2]);
        var result = liveResults[key];
        if (!completedGroupResult(result)) {
          missing.push({ key: key, home: match[1], away: match[2] });
          return;
        }
        if (!totals[match[1]] || !totals[match[2]]) return;
        var homeScore = Number(result.home);
        var awayScore = Number(result.away);
        totals[match[1]].gf += homeScore;
        totals[match[1]].ga += awayScore;
        totals[match[2]].gf += awayScore;
        totals[match[2]].ga += homeScore;
      });
    });

    if (missing.length !== 1) return;
    var fixture = missing[0];
    var homeTotals = totals[fixture.home];
    var awayTotals = totals[fixture.away];
    if (!homeTotals || !awayTotals) return;

    var homeScore = homeTotals.targetGf - homeTotals.gf;
    var awayScore = homeTotals.targetGa - homeTotals.ga;
    var awayHomeCheck = awayTotals.targetGa - awayTotals.ga;
    var awayScoreCheck = awayTotals.targetGf - awayTotals.gf;
    var valid = Number.isInteger(homeScore) && Number.isInteger(awayScore) &&
      homeScore >= 0 && awayScore >= 0 &&
      homeScore === awayHomeCheck && awayScore === awayScoreCheck;
    if (!valid) return;

    liveResults[fixture.key] = {
      home: homeScore,
      away: awayScore,
      status: "FINISHED",
      source: "reconciled_from_final_standings"
    };
    restored++;
  });

  return restored;
}

function countCompletedGroupResults() {
  var completed = 0;
  groupStage.forEach(function(day) {
    day.m.forEach(function(match) {
      if (completedGroupResult(liveResults[matchKey(day.date, match[1], match[2])])) completed++;
    });
  });
  return completed;
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
    var coverage = summary
      ? " · المجموعات " + summary.groupComplete + "/" + summary.localTotal +
        (summary.reconciledGroup ? " (" + summary.reconciledGroup + " مستعادة من الترتيب النهائي)" : "") +
        " · دور الـ32 " + summary.roundOf32Complete + "/16" +
        " · الترتيب " + summary.standingsGroups + "/12"
      : "";
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
  if (liveRefreshInFlight) return Promise.resolve(null);
  liveRefreshInFlight = true;
  var matchesError = null;
  var standingsError = null;
  return Promise.all([
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
      hydrateConfirmedRoundOf32();
      hydrateFullKnockoutSchedule();
      if (summary) {
        summary.reconciledGroup = standingsError ? 0 : reconcileMissingGroupResultsFromStandings();
        summary.groupComplete = countCompletedGroupResults();
        summary.roundOf32Complete = liveKnockoutMatches.filter(function(match) {
          return match.stage === "LAST_32" && match.home && match.away;
        }).length;
        summary.standingsGroups = Object.keys(liveStandings).length;
        summary.standingsFresh = !standingsError;
        var syncMode = summary.groupComplete === summary.localTotal &&
          summary.roundOf32Complete === 16 &&
          summary.standingsGroups === 12 &&
          summary.standingsFresh ? "live" : "partial";
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
          matches_count: summary ? summary.groupComplete : 0,
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
    })
    .finally(function() {
      liveRefreshInFlight = false;
    });
}

// Kick off immediately, then refresh every 60 seconds
refreshLiveData();
setInterval(refreshLiveData, 60000);
