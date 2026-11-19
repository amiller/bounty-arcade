// Standard Sokoban notation: # wall, . goal, $ box, * box on goal, @ player, + player on goal, space floor.
export const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }

export function parse(rows) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length))
  const walls = new Set(), goals = new Set(), boxes = []
  let player = -1
  rows.forEach((row, y) => [...row.padEnd(w)].forEach((c, x) => {
    const i = y * w + x
    if (!'#.$*@+ '.includes(c)) throw new Error(`bad tile '${c}' at ${x},${y}`)
    if (c === '#') walls.add(i)
    if ('.*+'.includes(c)) goals.add(i)
    if ('$*'.includes(c)) boxes.push(i)
    if ('@+'.includes(c)) {
      if (player >= 0) throw new Error('more than one player')
      player = i
    }
  }))
  if (player < 0) throw new Error('no player')
  if (boxes.length !== goals.size) throw new Error(`${boxes.length} boxes but ${goals.size} goals`)
  return { w, h, walls, goals, player, boxes, history: [] }
}

export const moves = state => state.history.length
export const pushes = state => state.history.filter(m => m === m.toUpperCase()).length
export const isWon = state => state.boxes.every(b => state.goals.has(b))

// Returns sorted indices of boxes trapped in a non-goal corner (wall on one vertical and one horizontal side).
export function deadBoxes(state) {
  const { w, walls, goals, boxes } = state
  const dead = []
  for (const b of boxes) {
    if (goals.has(b)) continue
    const x = b % w, y = Math.floor(b / w)
    const up = (y - 1) * w + x
    const down = (y + 1) * w + x
    const left = y * w + (x - 1)
    const right = y * w + (x + 1)
    const hasVert = walls.has(up) || walls.has(down)
    const hasHoriz = walls.has(left) || walls.has(right)
    if (hasVert && hasHoriz) dead.push(b)
  }
  return dead.sort((a, b) => a - b)
}

// Returns the same state object when the move is blocked.
export function move(state, dir) {
  const d = DIRS[dir]
  if (!d) throw new Error(`bad direction '${dir}'`)
  const { w, walls, player, boxes } = state
  const x = player % w + d[0], y = Math.floor(player / w) + d[1]
  if (x < 0 || x >= w || y < 0 || y >= state.h) return state
  const next = y * w + x
  if (walls.has(next)) return state
  if (!boxes.includes(next)) return { ...state, player: next, history: [...state.history, dir] }
  const bx = x + d[0], by = y + d[1], beyond = by * w + bx
  if (bx < 0 || bx >= w || by < 0 || by >= state.h || walls.has(beyond) || boxes.includes(beyond)) return state
  return { ...state, player: next, boxes: boxes.map(b => b === next ? beyond : b), history: [...state.history, dir.toUpperCase()] }
}

export function undo(state) {
  const last = state.history.at(-1)
  if (!last) return state
  const d = DIRS[last.toLowerCase()], back = d[1] * state.w + d[0]
  const boxes = last === last.toUpperCase() ? state.boxes.map(b => b === state.player + back ? state.player : b) : state.boxes
  return { ...state, player: state.player - back, boxes, history: state.history.slice(0, -1) }
}

// Applies a LURD string (case-insensitive); throws on a blocked move so solutions are checked exactly.
export function play(state, lurd) {
  for (const c of lurd) {
    const next = move(state, c.toLowerCase())
    if (next === state) throw new Error(`blocked move '${c}' at step ${moves(state)}`)
    state = next
  }
  return state
}

// Cells reachable from the player ignoring boxes: the level's floor, as opposed to the empty outside.
export function interior(state) {
  const { w, h, walls } = state, seen = new Set([state.player]), todo = [state.player]
  while (todo.length) {
    const i = todo.pop(), x = i % w, y = Math.floor(i / w)
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx, ny = y + dy, n = ny * w + nx
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && !walls.has(n) && !seen.has(n)) { seen.add(n); todo.push(n) }
    }
  }
  return seen
}

export function render(state) {
  const rows = []
  for (let y = 0; y < state.h; y++) {
    let row = ''
    for (let x = 0; x < state.w; x++) {
      const i = y * state.w + x, g = state.goals.has(i)
      row += state.walls.has(i) ? '#' : i === state.player ? (g ? '+' : '@') : state.boxes.includes(i) ? (g ? '*' : '$') : g ? '.' : ' '
    }
    rows.push(row.trimEnd())
  }
  return rows
}
