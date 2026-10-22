export const COLUMNS = [['todo', 'To do'], ['doing', 'Doing'], ['done', 'Done']]
const IDS = COLUMNS.map(([id]) => id)

export const emptyBoard = () => ({ nextId: 1, columns: { todo: [], doing: [], done: [] } })

export function findCard(board, id) {
  for (const col of IDS) {
    const index = board.columns[col].findIndex(c => c.id === id)
    if (index >= 0) return { col, index, card: board.columns[col][index] }
  }
  throw new Error(`no card ${id}`)
}

function cleanText(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('card text must be non-empty')
  return text.trim()
}

function column(id) {
  if (!IDS.includes(id)) throw new Error(`no column ${id}`)
  return id
}

const clone = board => ({ nextId: board.nextId, columns: Object.fromEntries(IDS.map(c => [c, board.columns[c].map(card => ({ ...card }))])), ...(board.limits && { limits: { ...board.limits } }) })

export function applyAction(board, action) {
  const next = clone(board)
  const cols = next.columns
  const limit = next.limits?.doing
  switch (action.type) {
    case 'add':
      if (action.column === 'doing' && limit && cols.doing.length >= limit) throw new Error('WIP limit')
      cols[column(action.column)].push({ id: `c${next.nextId++}`, text: cleanText(action.text) })
      return next
    case 'edit':
      findCard(next, action.id).card.text = cleanText(action.text)
      return next
    case 'delete': {
      const { col, index } = findCard(next, action.id)
      cols[col].splice(index, 1)
      return next
    }
    case 'move': {
      const { col, index, card } = findCard(next, action.id)
      const to = column(action.to)
      if (to === 'doing' && col !== 'doing' && limit && cols.doing.length >= limit) throw new Error('WIP limit')
      cols[col].splice(index, 1)
      const at = action.index ?? cols[to].length
      if (!Number.isInteger(at) || at < 0 || at > cols[to].length) throw new Error(`bad index ${at}`)
      cols[to].splice(at, 0, card)
      return next
    }
    case 'setLimit':
      if (action.limit === null) delete next.limits
      else {
        const n = Number(action.limit)
        if (!Number.isInteger(n) || n < 1) throw new Error('limit must be positive integer')
        if (cols.doing.length > n) throw new Error('WIP limit')
        next.limits = { doing: n }
      }
      return next
    case 'import':
      return clone(validate(action.board))
    default:
      throw new Error(`unknown action ${action.type}`)
  }
}

export const neighbour = (col, delta) => IDS[IDS.indexOf(column(col)) + delta]

export function validate(board) {
  const fail = msg => { throw new Error(`invalid board: ${msg}`) }
  if (!board || typeof board !== 'object' || Array.isArray(board)) fail('not an object')
  if (!Number.isInteger(board.nextId) || board.nextId < 1) fail('nextId must be a positive integer')
  const cols = board.columns
  if (!cols || typeof cols !== 'object' || Object.keys(cols).sort().join() !== [...IDS].sort().join()) fail(`columns must be exactly ${IDS.join(', ')}`)
  const seen = new Set()
  for (const col of IDS) {
    if (!Array.isArray(cols[col])) fail(`column ${col} is not an array`)
    for (const card of cols[col]) {
      if (!card || typeof card !== 'object' || Object.keys(card).sort().join() !== 'id,text') fail('card must have exactly id and text')
      const m = /^c(\d+)$/.exec(card.id)
      if (!m || Number(m[1]) >= board.nextId) fail(`bad card id ${card.id}`)
      if (seen.has(card.id)) fail(`duplicate card id ${card.id}`)
      seen.add(card.id)
      if (typeof card.text !== 'string' || !card.text.trim()) fail(`card ${card.id} has empty text`)
    }
  }
  if (board.limits) {
    const d = board.limits.doing
    if (Object.keys(board.limits).join() !== 'doing' || !Number.isInteger(d) || d < 1 || board.columns.doing.length > d) fail('invalid board')
  }
  return board
}
