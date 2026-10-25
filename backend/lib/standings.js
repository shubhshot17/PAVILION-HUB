/* Points table: 2 points for a win, 1 for a tie or no result.
   Net run rate treats an all-out innings as the full quota of overs. */

export function computeStandings(teams, matches) {
  const rows = new Map(teams.map((team) => [team.id, {
    teamId: team.id,
    name: team.name,
    shortName: team.shortName,
    color: team.color,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    noResult: 0,
    points: 0,
    runsFor: 0,
    ballsFaced: 0,
    runsAgainst: 0,
    ballsBowled: 0,
  }]))

  for (const match of matches) {
    const pair = [rows.get(match.teamAId), rows.get(match.teamBId)]
    if (pair.some((row) => !row)) continue

    if (match.status === 'abandoned') {
      for (const row of pair) {
        row.played += 1
        row.noResult += 1
        row.points += 1
      }
      continue
    }
    if (match.status !== 'completed' || !match.result) continue

    for (const row of pair) {
      row.played += 1
      if (match.result.tie) {
        row.tied += 1
        row.points += 1
      } else if (match.result.winnerId === row.teamId) {
        row.won += 1
        row.points += 2
      } else {
        row.lost += 1
      }
    }
    for (const score of match.scores ?? []) {
      const balls = score.allOut ? match.overs * 6 : score.legalBalls
      const batting = rows.get(score.teamId)
      const bowling = pair.find((row) => row.teamId !== score.teamId)
      batting.runsFor += score.runs
      batting.ballsFaced += balls
      bowling.runsAgainst += score.runs
      bowling.ballsBowled += balls
    }
  }

  return [...rows.values()]
    .map(({ runsFor, ballsFaced, runsAgainst, ballsBowled, ...row }) => {
      const forRate = ballsFaced ? (runsFor * 6) / ballsFaced : 0
      const againstRate = ballsBowled ? (runsAgainst * 6) / ballsBowled : 0
      return { ...row, netRunRate: Math.round((forRate - againstRate) * 1000) / 1000 }
    })
    .sort((a, b) => b.points - a.points || b.netRunRate - a.netRunRate || b.won - a.won
      || a.name.localeCompare(b.name))
}
