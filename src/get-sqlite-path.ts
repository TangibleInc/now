import path from 'path'
import getWpNowPath from './get-wp-now-path.ts'
import { SQLITE_FILENAME } from './constants.ts'

/**
 * The full path to the "SQLite database integration" folder.
 */
export default function getSqlitePath() {
  return path.join(getWpNowPath(), 'mu-plugins', `${SQLITE_FILENAME}`)
}

/**
 * The full path to the "SQLite database integration" db.copy file.
 */
export function getSqliteDbCopyPath() {
  return path.join(getSqlitePath(), 'db.copy')
}
