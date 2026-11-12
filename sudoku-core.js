
const Sudoku = (() => {
  const ALL = 0x1FF; // 9 бит: бит 0 = цифра 1, ... бит 8 = цифра 9
  const row = i => (i / 9) | 0;
  const col = i => i % 9;
  const box = i => ((row(i) / 3) | 0) * 3 + ((col(i) / 3) | 0);

  const PEERS = [];
  for (let i = 0; i < 81; i++) {
    const list = [];
    for (let j = 0; j < 81; j++) {
      if (j !== i && (row(j) === row(i) || col(j) === col(i) || box(j) === box(i))) list.push(j);
    }
    PEERS.push(list);
  }

  // 27 «юнитов»: 9 строк, 9 столбцов, 9 блоков
  const UNITS = [];
  for (let k = 0; k < 9; k++) {
    const r = [], c = [], b = [];
    for (let m = 0; m < 9; m++) {
      r.push(k * 9 + m);
      c.push(m * 9 + k);
      b.push((((k / 3) | 0) * 3 + ((m / 3) | 0)) * 9 + (k % 3) * 3 + (m % 3));
    }
    UNITS.push({ name: 'строке', cells: r }, { name: 'столбце', cells: c }, { name: 'блоке', cells: b });
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const bitCount = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };

  // Какие цифры можно поставить в клетку i (битовая маска)
  function candMask(b, i) {
    let used = 0;
    for (const p of PEERS[i]) if (b[p]) used |= 1 << (b[p] - 1);
    return ALL & ~used;
  }

  function pickCell(b) {
    let best = -1, bestMask = 0, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (b[i]) continue;
      const m = candMask(b, i), n = bitCount(m);
      if (n === 0) return { dead: true };
      if (n < bestN) { bestN = n; best = i; bestMask = m; if (n === 1) break; }
    }
    return { index: best, mask: bestMask };
  }

  function countSolutions(b, limit = 2) {
    const c = pickCell(b);
    if (c.dead) return 0;
    if (c.index === -1) return 1;
    let total = 0;
    for (let d = 1; d <= 9; d++) {
      if (!(c.mask & (1 << (d - 1)))) continue;
      b[c.index] = d;
      total += countSolutions(b, limit - total);
      b[c.index] = 0;
      if (total >= limit) break;
    }
    return total;
  }

  function fill(b, randomize) {
    const c = pickCell(b);
    if (c.dead) return false;
    if (c.index === -1) return true;
    const digits = [];
    for (let d = 1; d <= 9; d++) if (c.mask & (1 << (d - 1))) digits.push(d);
    if (randomize) shuffle(digits);
    for (const d of digits) {
      b[c.index] = d;
      if (fill(b, randomize)) return true;
    }
    b[c.index] = 0;
    return false;
  }

  function solve(puzzle) {
    const b = puzzle.slice();
    return fill(b, false) ? b : null;
  }

  const CLUES = { easy: 40, medium: 32, hard: 26 };

  function generate(level = 'medium') {
    const solution = new Array(81).fill(0);
    fill(solution, true);               
    const puzzle = solution.slice();
    const target = CLUES[level] ?? 32;
    let clues = 81;
    for (const i of shuffle([...Array(81).keys()])) { 
      if (clues <= target) break;
      const keep = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle.slice(), 2) !== 1) puzzle[i] = keep; 
      else clues--;
    }
    return { puzzle, solution };
  }

  function hint(board, solution) {
    // 0) Сначала ошибки игрока
    for (let i = 0; i < 81; i++) {
      if (board[i] && board[i] !== solution[i]) {
        return { index: i, value: solution[i], text: 'Здесь стоит неверная цифра. Правильная: ' + solution[i] };
      }
    }

    for (let i = 0; i < 81; i++) {
      if (board[i]) continue;
      const m = candMask(board, i);
      if (bitCount(m) === 1) {
        return { index: i, value: solution[i], text: 'Сюда подходит только одна цифра: ' + solution[i] };
      }
    }

    for (const u of UNITS) {
      for (let d = 1; d <= 9; d++) {
        if (u.cells.some(i => board[i] === d)) continue;
        const spots = u.cells.filter(i => !board[i] && (candMask(board, i) & (1 << (d - 1))));
        if (spots.length === 1) {
          return { index: spots[0], value: solution[spots[0]], text: 'В этой ' + u.name + ' цифра ' + d + ' может стоять только здесь' };
        }
      }
    }
    
    const i = board.findIndex(v => !v);
    if (i === -1) return null;
    return { index: i, value: solution[i], text: 'Правильная цифра: ' + solution[i] };
  }

  
  function conflicts(board) {
    const bad = new Set();
    for (let i = 0; i < 81; i++) {
      if (!board[i]) continue;
      for (const p of PEERS[i]) if (board[p] === board[i]) { bad.add(i); bad.add(p); }
    }
    return bad;
  }

  function remaining(board) {
    const left = [0, 9, 9, 9, 9, 9, 9, 9, 9, 9]; // индекс = цифра
    for (const v of board) if (v) left[v]--;
    return left;
  }

  const isSolved = (board, solution) => board.every((v, i) => v === solution[i]);

  function highlight(cells, selected, board) {
    cells.forEach(c => c.classList.remove('sel', 'peer', 'same'));
    if (selected < 0) return;
    const v = board[selected];
    const peers = new Set(PEERS[selected]);
    cells.forEach((c, i) => {
      if (i === selected) c.classList.add('sel');
      else if (peers.has(i)) c.classList.add('peer');
      if (v && i !== selected && board[i] === v) c.classList.add('same');
    });
  }

  return { generate, solve, countSolutions, hint, conflicts, remaining, isSolved, highlight, PEERS };
})();
