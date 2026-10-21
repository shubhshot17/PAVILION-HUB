import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync('models/index.js', 'utf8')

const OLD = `export const tournaments = {
  list() {
    return database.prepare(\`
      SELECT id, name, season, format, is_active FROM tournaments ORDER BY season DESC, name
    \`).all().map(tournamentRecord)
  },
  get(tournamentId) {
    return tournamentRecord(database.prepare(\`
      SELECT id, name, season, format, is_active FROM tournaments WHERE id = ?
    \`).get(tournamentId))
  },
  create(data) {
    const tournamentId = id()
    database.prepare(\`
      INSERT INTO tournaments (id, name, season, format, is_active) VALUES (?, ?, ?, ?, ?)
    \`).run(tournamentId, data.name, data.season, data.format, Number(data.isActive))
    return this.get(tournamentId)
  },
  update(tournamentId, data) {
    if (!this.get(tournamentId)) {
      return null
    }
    database.prepare(\`
      UPDATE tournaments SET name = ?, season = ?, format = ?, is_active = ? WHERE id = ?
    \`).run(data.name, data.season, data.format, Number(data.isActive), tournamentId)
    return this.get(tournamentId)
  },
  remove(tournamentId) {
    return database.prepare('DELETE FROM tournaments WHERE id = ?').run(tournamentId).changes > 0
  },
}`

const NEW = `function tournamentFullRecord(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    season: row.season,
    format: row.format,
    isActive: Boolean(row.is_active),
    tournamentType: row.tournament_type ?? 'round_robin',
    oversPerInnings: row.overs_per_innings ?? 20,
    winPoints: row.win_points ?? 2,
    tiePoints: row.tie_points ?? 1,
    noResultPoints: row.no_result_points ?? 1,
    isDemo: Boolean(row.is_demo ?? 0),
  }
}

export const tournaments = {
  list() {
    return database.prepare('SELECT * FROM tournaments ORDER BY season DESC, name')
      .all().map(tournamentFullRecord)
  },
  get(tournamentId) {
    return tournamentFullRecord(
      database.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId)
    )
  },
  create(data) {
    const tournamentId = id()
    database.prepare(\`
      INSERT INTO tournaments (
        id, name, season, format, is_active,
        tournament_type, overs_per_innings,
        win_points, tie_points, no_result_points, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    \`).run(
      tournamentId,
      data.name, data.season, data.format,
      Number(data.isActive),
      data.tournamentType ?? 'round_robin',
      data.oversPerInnings ?? 20,
      data.winPoints ?? 2,
      data.tiePoints ?? 1,
      data.noResultPoints ?? 1,
      Number(data.isDemo ?? false),
    )
    return this.get(tournamentId)
  },
  update(tournamentId, data) {
    if (!this.get(tournamentId)) {
      return null
    }
    database.prepare(\`
      UPDATE tournaments SET
        name = ?, season = ?, format = ?, is_active = ?,
        tournament_type = ?, overs_per_innings = ?,
        win_points = ?, tie_points = ?, no_result_points = ?
      WHERE id = ?
    \`).run(
      data.name, data.season, data.format, Number(data.isActive),
      data.tournamentType ?? 'round_robin',
      data.oversPerInnings ?? 20,
      data.winPoints ?? 2,
      data.tiePoints ?? 1,
      data.noResultPoints ?? 1,
      tournamentId,
    )
    return this.get(tournamentId)
  },
  remove(tournamentId) {
    return database.prepare('DELETE FROM tournaments WHERE id = ?').run(tournamentId).changes > 0
  },
}`

if (!src.includes(OLD.slice(0, 40))) {
  console.error('Could not find target block. First 40 chars:', JSON.stringify(OLD.slice(0, 40)))
  // Try normalizing line endings
  const srcNorm = src.replace(/\r\n/g, '\n')
  const oldNorm = OLD.replace(/\r\n/g, '\n')
  if (!srcNorm.includes(oldNorm.slice(0, 40))) {
    console.error('Still not found after normalization')
    process.exit(1)
  }
  writeFileSync('models/index.js', srcNorm.replace(oldNorm, NEW), 'utf8')
  console.log('Patched with normalized line endings')
} else {
  writeFileSync('models/index.js', src.replace(OLD, NEW), 'utf8')
  console.log('Patched successfully')
}
