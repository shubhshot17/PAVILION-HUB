/* Mock data for trying the app: one tournament, four teams, finished, live and
   upcoming matches. Ball-by-ball play is simulated with the real scoring rules.

   npm run db:seed            replace previous mock data with a fresh set
   npm run db:seed -- --clear remove mock data only (your own records stay) */

import { closeDatabase, connectDatabase, db, newId } from "./mongo.js";
import { computeMatch, isLegal, nextCrease } from "../lib/scoring.js";
import { shareCode } from "../routes/tournaments.js";

const TEAMS = [
  [
    "Mumbai Mavericks",
    "MUM",
    "#F97316",
    "Mumbai",
    [
      "Rohan Sharma",
      "Aditya Patil",
      "Kunal Mehta",
      "Siddharth Joshi",
      "Varun Deshmukh",
      "Nikhil Kulkarni",
      "Omkar Jadhav",
      "Pratik Shinde",
      "Sagar Pawar",
      "Tejas More",
      "Yash Gaikwad",
    ],
  ],
  [
    "Pune Panthers",
    "PUN",
    "#0EA5E9",
    "Pune",
    [
      "Aniket Kale",
      "Harsh Bhosale",
      "Ritesh Naik",
      "Saurabh Wagh",
      "Mandar Gokhale",
      "Chinmay Apte",
      "Akshay Thorat",
      "Ganesh Salunkhe",
      "Vishal Chavan",
      "Rahul Mane",
      "Sumit Kadam",
    ],
  ],
  [
    "Nashik Strikers",
    "NSK",
    "#16A34A",
    "Nashik",
    [
      "Arjun Rao",
      "Karan Iyer",
      "Dev Malhotra",
      "Ishaan Verma",
      "Manav Gupta",
      "Parth Saxena",
      "Rishabh Nair",
      "Tanmay Rane",
      "Uday Shetty",
      "Vivek Menon",
      "Zaid Khan",
    ],
  ],
  [
    "Thane Titans",
    "THN",
    "#E11D48",
    "Thane",
    [
      "Aman Singh",
      "Bhavesh Patel",
      "Chirag Shah",
      "Darshan Desai",
      "Faisal Shaikh",
      "Gaurav Mishra",
      "Hitesh Yadav",
      "Imran Qureshi",
      "Jatin Solanki",
      "Kartik Pandey",
      "Lalit Tiwari",
    ],
  ],
];
const ROLES = [
  "batter",
  "batter",
  "wicket-keeper",
  "batter",
  "all-rounder",
  "all-rounder",
  "all-rounder",
  "bowler",
  "bowler",
  "bowler",
  "bowler",
];
const OVERS = 8;
const VENUES = [
  "Central Maidan, Ground 1",
  "Riverside Turf",
  "Central Maidan, Ground 2",
];

function random(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daysFromNow(days, hour) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

/** Simulates one innings; `stopAfterBalls` leaves it unfinished for the live match. */
function simulateInnings({
  rng,
  match,
  index,
  battingXI,
  bowlingXI,
  target,
  firstSeq,
  stopAfterBalls = Infinity,
}) {
  const balls = [];
  const order = [...battingXI];
  let nextBatter = 2;
  const bowlers = bowlingXI.slice(-5);
  let crease = {
    strikerId: order[0],
    nonStrikerId: order[1],
    bowlerId: bowlers[0],
  };
  let legalBalls = 0;
  let runs = 0;
  let wickets = 0;
  let overNumber = 0;
  const keeper = bowlingXI[2];

  while (
    legalBalls < OVERS * 6 &&
    wickets < battingXI.length - 1 &&
    !(target && runs >= target) &&
    balls.length < stopAfterBalls
  ) {
    const roll = rng();
    const ball = {
      _id: newId(),
      matchId: match._id,
      innings: index,
      seq: firstSeq + balls.length,
      ...crease,
      runs: 0,
      extra: null,
      wicket: null,
      createdAt: new Date().toISOString(),
      isMock: true,
    };
    if (roll < 0.33) ball.runs = 0;
    else if (roll < 0.62) ball.runs = 1;
    else if (roll < 0.71) ball.runs = 2;
    else if (roll < 0.73) ball.runs = 3;
    else if (roll < 0.84) ball.runs = 4;
    else if (roll < 0.9) ball.runs = 6;
    else if (roll < 0.93) ball.extra = "wide";
    else if (roll < 0.94) {
      ball.extra = "noball";
      ball.runs = rng() < 0.5 ? 0 : 1;
    } else if (roll < 0.95) {
      ball.extra = "legbye";
      ball.runs = 1;
    } else {
      const kind = rng();
      const type =
        kind < 0.35
          ? "caught"
          : kind < 0.6
            ? "bowled"
            : kind < 0.78
              ? "lbw"
              : kind < 0.9
                ? "runout"
                : "stumped";
      const fielderId =
        type === "stumped"
          ? keeper
          : ["caught", "runout"].includes(type)
            ? bowlingXI[Math.floor(rng() * bowlingXI.length)]
            : undefined;
      ball.wicket = {
        type,
        playerOutId: crease.strikerId,
        ...(fielderId ? { fielderId } : {}),
      };
    }

    balls.push(ball);
    if (isLegal(ball)) legalBalls += 1;
    runs +=
      ball.runs + (ball.extra === "wide" || ball.extra === "noball" ? 1 : 0);
    if (ball.wicket) wickets += 1;
    crease = nextCrease(ball, legalBalls);
    if (!crease.strikerId && nextBatter < order.length)
      crease.strikerId = order[nextBatter++];
    if (!crease.nonStrikerId && nextBatter < order.length)
      crease.nonStrikerId = order[nextBatter++];
    if (!crease.bowlerId) {
      overNumber += 1;
      crease.bowlerId = bowlers[overNumber % bowlers.length];
    }
  }
  return { balls, crease, runs };
}

/** Removes mock records, but keeps mock teams (and their players) that your own matches or tournaments use. */
async function clearMock() {
  const [ownMatches, ownTournaments] = await Promise.all([
    db()
      .matches.find({ isMock: { $ne: true } })
      .project({ teamAId: 1, teamBId: 1 })
      .toArray(),
    db()
      .tournaments.find({ isMock: { $ne: true } })
      .project({ teamIds: 1 })
      .toArray(),
  ]);
  const inUse = [
    ...new Set([
      ...ownMatches.flatMap((match) => [match.teamAId, match.teamBId]),
      ...ownTournaments.flatMap((tournament) => tournament.teamIds ?? []),
    ]),
  ];
  const results = await Promise.all([
    db().balls.deleteMany({ isMock: true }),
    db().matches.deleteMany({ isMock: true }),
    db().tournaments.deleteMany({ isMock: true }),
    db().players.deleteMany({ isMock: true, teamId: { $nin: inUse } }),
    db().teams.deleteMany({ isMock: true, _id: { $nin: inUse } }),
  ]);
  return results.reduce((sum, result) => sum + result.deletedCount, 0);
}

async function seed() {
  const rng = random(2026);
  const now = new Date().toISOString();
  const teams = [];
  const players = [];
  for (const [name, shortName, color, city, names] of TEAMS) {
    const team = {
      _id: newId(),
      name,
      shortName,
      color,
      city,
      createdAt: now,
      isMock: true,
    };
    teams.push(team);
    names.forEach((playerName, i) =>
      players.push({
        _id: newId(),
        teamId: team._id,
        name: playerName,
        role: ROLES[i],
        jerseyNumber: 7 + i * 3,
        battingStyle: i % 4 === 1 ? "Left-hand bat" : "Right-hand bat",
        ...(i >= 4
          ? {
              bowlingStyle: [
                "Right-arm medium",
                "Right-arm off-break",
                "Left-arm orthodox",
                "Right-arm fast",
              ][i % 4],
            }
          : {}),
        createdAt: now,
        isMock: true,
      }),
    );
  }
  const squad = (team) =>
    players
      .filter((player) => player.teamId === team._id)
      .map((player) => player._id);

  const tournament = {
    _id: newId(),
    name: "Summer Premier League 2026",
    season: "2026",
    city: "Mumbai",
    ground: "Central Maidan",
    organizer: "PAVILION HUB",
    overs: OVERS,
    startDate: daysFromNow(-4, 0),
    endDate: daysFromNow(10, 0),
    teamIds: teams.map((team) => team._id),
    shareCode: shareCode(),
    createdAt: now,
    isMock: true,
  };

  const fixtures = [
    [0, 1, -3, "completed"],
    [2, 3, -2, "completed"],
    [0, 2, -1, "completed"],
    [1, 3, 0, "live"],
    [0, 3, 1, "upcoming"],
    [1, 2, 2, "upcoming"],
  ];
  const matches = [];
  const balls = [];
  const names = {
    name: (id) => players.find((player) => player._id === id)?.name ?? "?",
    teamName: (id) => teams.find((team) => team._id === id)?.name ?? "?",
  };

  for (const [n, [a, b, day, status]] of fixtures.entries()) {
    const teamA = teams[a];
    const teamB = teams[b];
    const match = {
      _id: newId(),
      tournamentId: tournament._id,
      title: `Match ${n + 1}`,
      teamAId: teamA._id,
      teamBId: teamB._id,
      venue: VENUES[n % VENUES.length],
      date: daysFromNow(day, status === "live" ? new Date().getHours() : 16),
      overs: OVERS,
      status: "upcoming",
      toss: null,
      playingXI: null,
      innings: [],
      live: null,
      scores: [],
      result: null,
      createdAt: now,
      updatedAt: now,
      isMock: true,
    };
    if (status !== "upcoming") {
      const tossWinner = rng() < 0.5 ? teamA : teamB;
      const decision = rng() < 0.6 ? "bowl" : "bat";
      const batFirst =
        (decision === "bat") === (tossWinner === teamA) ? teamA : teamB;
      const bowlFirst = batFirst === teamA ? teamB : teamA;
      match.toss = { winnerId: tossWinner._id, decision };
      match.playingXI = {
        [teamA._id]: squad(teamA),
        [teamB._id]: squad(teamB),
      };
      match.innings = [
        {
          battingTeamId: batFirst._id,
          bowlingTeamId: bowlFirst._id,
          closed: false,
        },
        {
          battingTeamId: bowlFirst._id,
          bowlingTeamId: batFirst._id,
          closed: false,
        },
      ];
      match.status = "live";
      const first = simulateInnings({
        rng,
        match,
        index: 0,
        battingXI: squad(batFirst),
        bowlingXI: squad(bowlFirst),
        firstSeq: 1,
      });
      const second = simulateInnings({
        rng,
        match,
        index: 1,
        battingXI: squad(bowlFirst),
        bowlingXI: squad(batFirst),
        target: first.runs + 1,
        firstSeq: first.balls.length + 1,
        stopAfterBalls: status === "live" ? 22 : Infinity,
      });
      const matchBalls = [...first.balls, ...second.balls];
      balls.push(...matchBalls);
      match.live = second.crease;
      const computed = computeMatch(match, matchBalls, names);
      match.scores = computed.innings.map((inn) => ({
        teamId: inn.battingTeamId,
        runs: inn.runs,
        wickets: inn.wickets,
        legalBalls: inn.legalBalls,
        allOut: inn.allOut,
      }));
      if (status === "completed") {
        Object.assign(match, {
          status: "completed",
          result: computed.result,
          live: null,
        });
      }
    }
    matches.push(match);
  }

  await db().teams.insertMany(teams);
  await db().players.insertMany(players);
  await db().tournaments.insertOne(tournament);
  await db().matches.insertMany(matches);
  await db().balls.insertMany(balls);
  return {
    tournament,
    teams: teams.length,
    players: players.length,
    matches: matches.length,
    balls: balls.length,
  };
}

await connectDatabase();
try {
  const removed = await clearMock();
  if (process.argv.includes("--clear")) {
    console.log(`Removed ${removed} mock records.`);
  } else {
    const summary = await seed();
    console.log(
      `Seeded "${summary.tournament.name}": ${summary.teams} teams, ${summary.players} players, ` +
        `${summary.matches} matches, ${summary.balls} balls.`,
    );
    console.log(`Public share link path: /t/${summary.tournament.shareCode}`);
  }
} finally {
  await closeDatabase();
}
