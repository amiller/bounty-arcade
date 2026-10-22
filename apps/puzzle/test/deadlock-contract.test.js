import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as L from '../logic.js'

const levels = JSON.parse(readFileSync(new URL('../levels.json', import.meta.url)))
const board = (walls, boxes = [12], goals = []) => ({ w: 5, h: 5, walls: new Set(walls), boxes, goals: new Set(goals) })

test('all supplied starting boards have no dead boxes', () => {
  for (const level of levels) assert.deepEqual(L.deadBoxes(L.parse(level.map)), [], level.name)
})

test('every vertical and horizontal corner orientation is detected', () => {
  for (const vertical of [7, 17]) for (const horizontal of [11, 13]) {
    assert.deepEqual(L.deadBoxes(board([vertical, horizontal])), [12])
  }
})

test('goal boxes are never dead, including fully enclosed goals', () => {
  assert.deepEqual(L.deadBoxes(board([7, 17, 11, 13], [12], [12])), [])
  assert.deepEqual(L.deadBoxes(L.parse(['####', '#@*#', '####'])), [])
})

test('one-axis walls, diagonals and other boxes do not count as a corner', () => {
  for (const walls of [[], [7], [11], [7, 17], [11, 13], [6, 8, 16, 18]]) {
    assert.deepEqual(L.deadBoxes(board(walls)), [])
  }
  assert.deepEqual(L.deadBoxes(board([7], [12, 11, 13])), [])
})

test('both published push sequences detect the exact cell and undo clears it', () => {
  for (const [index, sequence, cell] of [[1, 'DLdR', 28], [4, 'URurDD', 33]]) {
    const stuck = L.play(L.parse(levels[index].map), sequence)
    assert.deepEqual(L.deadBoxes(stuck), [cell])
    assert.deepEqual(L.deadBoxes(L.undo(stuck)), [])
  }
})

test('result is numerically sorted without mutating boxes, walls or goals', () => {
  const state = { w: 10, h: 5, walls: new Set([12, 3, 21, 10]), boxes: Object.freeze([11, 2]), goals: new Set() }
  const walls = [...state.walls]
  assert.deepEqual(L.deadBoxes(state), [2, 11])
  assert.deepEqual(state.boxes, [11, 2])
  assert.deepEqual([...state.walls], walls)
  assert.equal(state.goals.size, 0)
})

test('horizontal neighbors do not wrap across rows, and edges are not walls', () => {
  assert.deepEqual(L.deadBoxes(board([5, 9], [10])), [])
  assert.deepEqual(L.deadBoxes(board([9, 15], [14])), [])
  assert.deepEqual(L.deadBoxes(board([1], [0])), [])
})

test('a solved first level keeps its goal box alive', () => {
  const solved = L.play(L.parse(levels[0].map), 'rRR')
  assert.equal(L.isWon(solved), true)
  assert.deepEqual(L.deadBoxes(solved), [])
})
