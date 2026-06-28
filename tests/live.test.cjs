const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

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
}

console.log("live data tests passed");
