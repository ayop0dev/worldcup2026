const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

{
  const index = fs.readFileSync("index.html", "utf8");
  const release = JSON.parse(fs.readFileSync("version.json", "utf8"));
  const assetVersions = Array.from(index.matchAll(/(?:css|js)\/[^"']+\?v=([^"']+)/g), match => match[1]);

  assert(release.version);
  assert(index.includes(`window.WC_APP_VERSION = "${release.version}"`));
  assert(assetVersions.length >= 5);
  assert(assetVersions.every(version => version === release.version));
  assert(index.includes('fetch("version.json?t=" + Date.now()'));
  assert(index.includes('cache: "no-store"'));

  const htaccess = fs.readFileSync(".htaccess", "utf8");
  assert(htaccess.includes('Cache-Control "no-store, no-cache, must-revalidate, max-age=0"'));
  assert(htaccess.includes('FilesMatch "\\.(js|css)$"'));

  const app = fs.readFileSync("js/app.js", "utf8");
  const css = fs.readFileSync("css/style.css", "utf8");
  assert(app.includes('row.className = isFinished ? "match-finished" : "match-upcoming"'));
  assert(app.includes('class="finished-label"'));
  assert(app.includes("match-node--finished"));
  assert(app.includes("match-side--qualified"));
  assert(app.includes('class="qualified-badge"'));
  assert(app.includes('class="qualified-mark"'));
  assert(css.includes("tr.match-finished"));
  assert(css.includes(".match-node--finished"));
  assert(css.includes(".qualified-badge"));
  assert(css.includes(".qualified-mark"));
}

function loadLive(groupStage = [], liveResults = {}) {
  const context = {
    console: { warn() {} },
    document: { getElementById() { return null; } },
    fetch() { return Promise.reject(new Error("offline test")); },
    groupStage,
    liveResults,
    matchKey(date, home, away) { return `${date}|${home}|${away}`; },
    setInterval() { return 0; },
    window: {}
  };
  vm.createContext(context);
  const source = fs.readFileSync("js/live.js", "utf8");
  vm.runInContext(source.slice(0, source.lastIndexOf("// Kick off immediately")), context);
  return context;
}

{
  const context = loadLive();
  context.liveKnockoutMatches = [];
  context.hydrateConfirmedRoundOf32();
  const fixtures = context.liveKnockoutMatches.filter(match => match.stage === "LAST_32");
  const teams = fixtures.flatMap(match => [match.home, match.away]);

  assert.equal(fixtures.length, 16);
  assert.equal(new Set(teams).size, 32);
  assert(!teams.some(team => /أفضل ثالث|يتحدد/.test(team)));
  assert.equal(fixtures.find(match => match.matchNumber === 73).home, "جنوب أفريقيا");
  assert.equal(fixtures.find(match => match.matchNumber === 77).away, "السويد");
  assert.deepEqual(
    JSON.parse(JSON.stringify(fixtures
      .filter(match => [73, 74, 75, 76].includes(match.matchNumber))
      .map(match => [match.matchNumber, match.homeScore, match.awayScore, match.status]))),
    [
      [73, 0, 1, "FINISHED"],
      [74, 4, 5, "FINISHED"],
      [75, 1, 1, "FINISHED"],
      [76, 2, 1, "FINISHED"]
    ]
  );
  const moroccoResult = fixtures.find(match => match.matchNumber === 75);
  assert.equal(moroccoResult.homePenalties, 2);
  assert.equal(moroccoResult.awayPenalties, 3);
  assert.equal(moroccoResult.winner, "AWAY_TEAM");
  const mexicoResult = fixtures.find(match => match.matchNumber === 79);
  assert.deepEqual([mexicoResult.homeScore, mexicoResult.awayScore, mexicoResult.status, mexicoResult.winner], [2, 0, "FINISHED", "HOME_TEAM"]);
  const englandResult = fixtures.find(match => match.matchNumber === 80);
  assert.deepEqual([englandResult.homeScore, englandResult.awayScore, englandResult.status, englandResult.winner], [2, 1, "FINISHED", "HOME_TEAM"]);
  const franceResult = fixtures.find(match => match.matchNumber === 77);
  assert.deepEqual([franceResult.homeScore, franceResult.awayScore, franceResult.status, franceResult.winner], [3, 0, "FINISHED", "HOME_TEAM"]);
  const norwayResult = fixtures.find(match => match.matchNumber === 78);
  assert.deepEqual([norwayResult.homeScore, norwayResult.awayScore, norwayResult.status, norwayResult.winner], [1, 2, "FINISHED", "AWAY_TEAM"]);

  context.hydrateConfirmedRoundOf16();
  context.hydrateFullKnockoutSchedule();
  context.hydrateKnownKnockoutAdvancement();
  const paraguayFrance = context.liveKnockoutMatches.find(match => match.matchNumber === 89);
  assert.equal(paraguayFrance.home, "باراغواي");
  assert.equal(paraguayFrance.away, "فرنسا");
  const canadaMorocco = context.liveKnockoutMatches.find(match => match.matchNumber === 90);
  assert.equal(canadaMorocco.home, "كندا");
  assert.equal(canadaMorocco.away, "المغرب");
  const brazilNorway = context.liveKnockoutMatches.find(match => match.matchNumber === 91);
  assert.equal(brazilNorway.home, "البرازيل");
  assert.equal(brazilNorway.away, "النرويج");
  const mexicoEngland = context.liveKnockoutMatches.find(match => match.matchNumber === 92);
  assert.equal(mexicoEngland.home, mexicoResult.home);
  assert.equal(mexicoEngland.away, englandResult.home);

  const apiResult = fixtures.find(match => match.matchNumber === 73);
  apiResult.homeScore = 9;
  apiResult.awayScore = 8;
  context.hydrateConfirmedRoundOf32();
  assert.equal(apiResult.homeScore, 9);
  assert.equal(apiResult.awayScore, 8);
}

{
  const context = loadLive();
  context.liveKnockoutMatches = [
    { id: 1, matchNumber: 73, stage: "LAST_32", homeScore: 1, dataSource: "api" },
    { id: "fallback-74", matchNumber: 74, stage: "LAST_32", dataSource: "fallback" }
  ];
  const merged = context.mergeApiKnockoutMatches([
    { id: 2, matchNumber: 75, stage: "LAST_32", homeScore: 2, dataSource: "api" }
  ]);

  assert.deepEqual(Array.from(merged, match => match.matchNumber).sort(), [73, 75]);
  assert.equal(merged.find(match => match.matchNumber === 73).homeScore, 1);
  assert(!merged.some(match => match.dataSource === "fallback"));
}

{
  const matches = [
    ["A", "فريق أ", "فريق ب", "12:00", "مدينة"],
    ["A", "فريق ج", "فريق د", "12:00", "مدينة"],
    ["A", "فريق أ", "فريق ج", "12:00", "مدينة"],
    ["A", "فريق ب", "فريق د", "12:00", "مدينة"],
    ["A", "فريق أ", "فريق د", "12:00", "مدينة"],
    ["A", "فريق ب", "فريق ج", "12:00", "مدينة"]
  ];
  const day = "اليوم";
  const key = (home, away) => `${day}|${home}|${away}`;
  const results = {
    [key("فريق أ", "فريق ب")]: { home: 1, away: 0, status: "FINISHED" },
    [key("فريق ج", "فريق د")]: { home: 2, away: 2, status: "FINISHED" },
    [key("فريق أ", "فريق ج")]: { home: 3, away: 1, status: "FINISHED" },
    [key("فريق ب", "فريق د")]: { home: 0, away: 1, status: "FINISHED" },
    [key("فريق ب", "فريق ج")]: { home: 1, away: 1, status: "FINISHED" }
  };
  const context = loadLive([{ date: day, m: matches }], results);
  context.liveStandings = {
    A: [
      { nameAr: "فريق أ", played: 3, gf: 6, ga: 3 },
      { nameAr: "فريق ب", played: 3, gf: 1, ga: 3 },
      { nameAr: "فريق ج", played: 3, gf: 4, ga: 6 },
      { nameAr: "فريق د", played: 3, gf: 5, ga: 4 }
    ]
  };

  assert.equal(context.reconcileMissingGroupResultsFromStandings(), 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.liveResults[key("فريق أ", "فريق د")])),
    { home: 2, away: 2, status: "FINISHED", source: "reconciled_from_final_standings" }
  );
}

{
  const source = fs.readFileSync("js/app.js", "utf8");
  const start = source.indexOf("function tournamentDayISOForDate");
  const end = source.indexOf("function arabicCalendarDateLabel");
  const context = {
    liveKnockoutMatches: [
      { matchNumber: 73, utcDate: "2026-06-28T19:00:00Z" },
      { matchNumber: 74, utcDate: "2026-06-29T20:30:00Z" },
      { matchNumber: 75, utcDate: "2026-06-30T01:00:00Z" },
      { matchNumber: 76, utcDate: "2026-06-29T17:00:00Z" }
    ]
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);

  assert.deepEqual(Array.from(context.knockoutMatchesByTournamentDay("2026-06-28"), match => match.matchNumber), [73]);
  assert.deepEqual(Array.from(context.knockoutMatchesByTournamentDay("2026-06-29"), match => match.matchNumber), [76, 74, 75]);
  assert(source.includes("renderKnockoutSchedule(root, todayKnockoutMatches)"));
  assert(source.includes('filter === "knockout"'));
  assert(source.includes("renderKnockoutRoundsSchedule(root)"));
}

console.log("live data tests passed");
