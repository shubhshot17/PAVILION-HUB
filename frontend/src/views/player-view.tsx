import { Link } from 'react-router'
import { PlayerAvatar, SectionTitle, StatTile } from '@/components/common'
import { formatDate, ROLE_LABEL } from '@/lib/format'
import { useLinks } from '@/lib/links'
import type { PlayerProfile } from '@/lib/types'

export function PlayerView({ profile }: { profile: PlayerProfile }) {
  const links = useLinks()
  const { player, team, stats, recent } = profile
  const { batting, bowling } = stats
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4 rounded-3xl border bg-card p-6 shadow-sm">
        <PlayerAvatar name={player.name} color={team.color} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight">{player.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link to={links.team(team.id)} className="font-semibold hover:underline" style={{ color: team.color }}>{team.name}</Link>
            <span>·</span>
            <span>{ROLE_LABEL[player.role]}</span>
            {player.battingStyle && <><span>·</span><span>{player.battingStyle}</span></>}
            {player.bowlingStyle && <><span>·</span><span>{player.bowlingStyle}</span></>}
          </div>
        </div>
        <StatTile label="Matches" value={stats.matches} className="min-w-28 text-center" />
      </div>

      <section>
        <SectionTitle>Batting</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Runs" value={batting.runs} hint={`${batting.innings} innings`} />
          <StatTile label="Highest" value={`${batting.highest}${batting.highestNotOut ? '*' : ''}`} />
          <StatTile label="Average" value={batting.average ?? '–'} />
          <StatTile label="Strike rate" value={batting.strikeRate} />
          <StatTile label="4s / 6s" value={`${batting.fours} / ${batting.sixes}`} />
          <StatTile label="50s / 100s" value={`${batting.fifties} / ${batting.hundreds}`} />
        </div>
      </section>

      <section>
        <SectionTitle>Bowling</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Wickets" value={bowling.wickets} hint={`${bowling.innings} innings`} />
          <StatTile label="Overs" value={bowling.overs} />
          <StatTile label="Best" value={bowling.best ? `${bowling.best.wickets}/${bowling.best.runs}` : '–'} />
          <StatTile label="Economy" value={bowling.legalBalls ? bowling.economy : '–'} />
          <StatTile label="Average" value={bowling.average ?? '–'} />
          <StatTile label="Maidens" value={bowling.maidens} />
        </div>
      </section>

      <section>
        <SectionTitle>Recent matches</SectionTitle>
        {recent.length ? (
          <div className="divide-y overflow-hidden rounded-2xl border bg-card">
            {recent.map((game) => (
              <Link key={game.matchId} to={links.match(game.matchId)} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-muted/50">
                <div className="min-w-40 flex-1">
                  <div className="font-semibold">vs {game.opponent?.name ?? 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(game.date, false)} · {game.result ?? (game.status === 'live' ? 'Live' : '')}</div>
                </div>
                <div className="tabular text-right">
                  {game.batting
                    ? <span className="font-bold">{game.batting.runs}{game.batting.out ? '' : '*'} <span className="font-normal text-muted-foreground">({game.batting.balls})</span></span>
                    : <span className="text-muted-foreground">DNB</span>}
                </div>
                <div className="tabular w-24 text-right">
                  {game.bowling
                    ? <span className="font-bold">{game.bowling.wickets}/{game.bowling.runs} <span className="font-normal text-muted-foreground">({game.bowling.overs})</span></span>
                    : <span className="text-muted-foreground">–</span>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No matches played yet.</p>
        )}
      </section>
    </div>
  )
}
