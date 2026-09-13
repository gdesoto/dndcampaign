import { test } from 'node:test'
import assert from 'node:assert/strict'
import { csvCell, toCsv } from '../app/components/kit/csv.ts'

test('CSV preserves punctuation, multiline strings, and empty values', () => {
  assert.equal(csvCell('A, "quoted" value\nnext'), '"A, ""quoted"" value\nnext"')
  assert.equal(csvCell(null), '""')
  assert.equal(toCsv(['Name'], [['Alex']]), '\uFEFF"Name"\r\n"Alex"')
})
test('CSV neutralizes user strings that spreadsheet apps can execute', () => {
  for (const value of ['=SUM(A1)', '+cmd', '-formula', '@SUM(A1)', '  =1', '\t=1']) assert.ok(csvCell(value).startsWith('"\''))
  assert.equal(csvCell(-3), '"-3"')
})

