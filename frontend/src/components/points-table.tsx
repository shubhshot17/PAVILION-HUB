import { Link } from 'react-router'
import { TeamBadge } from '@/components/common'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLinks } from '@/lib/links'
import type { StandingRow } from '@/lib/types'
import { cn } from '@/lib/utils'

export function PointsTable({ rows }: { rows: StandingRow[] }) {
  const links = useLinks()
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            <TableHead className="w-10 pl-4">#</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-center">P</TableHead>
            <TableHead className="text-center">W</TableHead>
            <TableHead className="text-center">L</TableHead>
            <TableHead className="hidden text-center sm:table-cell">T/NR</TableHead>
            <TableHead className="text-right">NRR</TableHead>
            <TableHead className="pr-4 text-right">Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="tabular">
          {rows.map((row, index) => (
            <TableRow key={row.teamId}>
              <TableCell className="pl-4 font-bold text-muted-foreground">{index + 1}</TableCell>
              <TableCell>
                <Link to={links.team(row.teamId)} className="flex items-center gap-2.5 font-semibold hover:text-primary">
                  <TeamBadge team={row} size="sm" />
                  <span className="hidden sm:inline">{row.name}</span>
                  <span className="sm:hidden">{row.shortName}</span>
                </Link>
              </TableCell>
              <TableCell className="text-center">{row.played}</TableCell>
              <TableCell className="text-center">{row.won}</TableCell>
              <TableCell className="text-center">{row.lost}</TableCell>
              <TableCell className="hidden text-center sm:table-cell">{row.tied + row.noResult}</TableCell>
              <TableCell className={cn('text-right', row.netRunRate > 0 ? 'text-success' : row.netRunRate < 0 ? 'text-destructive' : '')}>
                {row.netRunRate > 0 ? '+' : ''}{row.netRunRate.toFixed(3)}
              </TableCell>
              <TableCell className="pr-4 text-right text-base font-extrabold">{row.points}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
