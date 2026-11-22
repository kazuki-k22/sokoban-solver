// Push-optimal Sokoban solver for make.fun's sokoban-solver-01 levels: a one-wide hallway with small rooms off it.
// Boxes never leave their room (a box pushed into the hallway is lost), so each room is solved on its own by a
// breadth-first search over pushes (optimal in pushes), and the rooms are joined by the player's walk.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const LETTER = 'udlr';

function solveLevel(text: string): string {
  const rows = text.split('\n').map((r) => r.replace(/\r$/, '')).filter((r) => r.length > 0);
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const N = w * h;
  const wall = new Uint8Array(N).fill(1);
  const goal = new Uint8Array(N);
  const box = new Uint8Array(N);
  let player = -1;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      const i = y * w + x;
      if (c === '#') continue;
      wall[i] = 0;
      if (c === '.' || c === '*' || c === '+') goal[i] = 1;
      if (c === '$' || c === '*') box[i] = 1;
      if (c === '@' || c === '+') player = i;
    }
  });
  const D = [-w, w, -1, 1]; // u d l r

  // The hallway: the row the player starts on (the generator always starts the player in the hallway; a room's row can
  // be all floor too, so the row's shape alone cannot tell it apart).
  const hall = Math.floor(player / w);
  const inHall = (i: number) => Math.floor(i / w) === hall;

  // Walk from `from` to `to` over floor, around boxes: the letters, or null.
  const walk = (from: number, to: number, isBox: (i: number) => boolean, allowed: (i: number) => boolean): string | null => {
    if (from === to) return '';
    const prev = new Int32Array(N).fill(-1);
    prev[from] = from;
    const q = [from];
    for (let k = 0; k < q.length; k++) {
      const p = q[k];
      for (let d = 0; d < 4; d++) {
        const n = p + D[d];
        if (wall[n] || prev[n] >= 0 || isBox(n) || !allowed(n)) continue;
        prev[n] = p;
        if (n === to) {
          let s = '';
          for (let c = n; c !== from; c = prev[c]) s = LETTER[D.indexOf(c - prev[c])] + s;
          return s;
        }
        q.push(n);
      }
    }
    return null;
  };

  // The rooms: connected floor off the hallway, each with the hallway square outside its door.
  const seen = new Uint8Array(N);
  let moves = '';
  for (let s = 0; s < N; s++) {
    if (wall[s] || seen[s] || inHall(s)) continue;
    const cells: number[] = [s];
    seen[s] = 1;
    let outside = -1;
    for (let k = 0; k < cells.length; k++) {
      for (const d of D) {
        const n = cells[k] + d;
        if (wall[n]) continue;
        if (inHall(n)) { outside = n; continue; }
        if (!seen[n]) { seen[n] = 1; cells.push(n); }
      }
    }
    if (!cells.some((c) => box[c])) continue;
    cells.push(outside);
    // walk to the room, then play its pushes
    const there = walk(player, outside, (i) => box[i] === 1, () => true);
    if (there === null) throw new Error('room out of reach');
    moves += there;
    player = outside;
    const pushes = solveRoom(cells, outside);
    for (const [b, d] of pushes) {
      const step = walk(player, b - D[d], (i) => box[i] === 1, (i) => cells.includes(i));
      if (step === null) throw new Error('push square out of reach');
      moves += step + LETTER[d].toUpperCase();
      box[b] = 0;
      box[b + D[d]] = 1;
      player = b;
    }
  }
  return moves;

  // Breadth-first search over pushes inside one room: the pushes [box square, direction] of a push-optimal solution.
  function solveRoom(cells: number[], start: number): [number, number][] {
    const n = cells.length;
    const local = new Map<number, number>();
    cells.forEach((c, k) => local.set(c, k));
    const nb: number[][] = cells.map((c) => D.map((d) => (local.has(c + d) ? local.get(c + d)! : -1)));
    const isGoal = cells.map((c) => goal[c] === 1);
    const out = local.get(start)!;
    // Live squares: from where a lone box can still be pushed onto a goal.
    const live = new Uint8Array(n);
    const lq: number[] = [];
    for (let k = 0; k < n; k++) if (isGoal[k]) { live[k] = 1; lq.push(k); }
    for (let k = 0; k < lq.length; k++) {
      const x = lq[k];
      for (let d = 0; d < 4; d++) {
        const y = nb[x][d ^ 1]; // the box came from y, pushed in direction d
        if (y < 0 || live[y]) continue;
        const p = nb[y][d ^ 1]; // the player stood behind it
        if (p < 0) continue;
        live[y] = 1;
        lq.push(y);
      }
    }
    live[out] = 0;
    // A state's key: each box square, then the player's least reachable square, 6 bits each (rooms hold under 64 squares).
    const keyOf = (bs: number[], p: number) => {
      let k = 0;
      for (const b of bs) k = k * 64 + b;
      return k * 64 + p;
    };
    const occ = new Uint8Array(n);
    const reach = new Int32Array(n);
    let stamp = 0;
    // The squares the player reaches from p around the boxes in occ (stamped in reach), and their least.
    const region = (p: number) => {
      stamp++;
      const q = [p];
      reach[p] = stamp;
      let least = p;
      for (let k = 0; k < q.length; k++) {
        for (const m of nb[q[k]]) {
          if (m >= 0 && reach[m] !== stamp && !occ[m]) {
            reach[m] = stamp;
            if (m < least) least = m;
            q.push(m);
          }
        }
      }
      return least;
    };
    // A 2 x 2 block of walls and boxes holding a box off its goal can never move again.
    const blocked = (b: number) => {
      for (const [d1, d2] of [[0, 2], [0, 3], [1, 2], [1, 3]]) {
        const a = nb[b][d1];
        const c = nb[b][d2];
        const e = a >= 0 ? nb[a][d2] : c >= 0 ? nb[c][d1] : -1;
        const sq = [b, a, c, e];
        if (sq.every((x) => x < 0 || occ[x]) && sq.some((x) => x >= 0 && occ[x] && !isGoal[x])) return true;
      }
      return false;
    };
    const startBoxes = cells.map((c, k) => (box[c] ? k : -1)).filter((k) => k >= 0).sort((a, b) => a - b);
    for (const b of startBoxes) occ[b] = 1;
    const startKey = keyOf(startBoxes, region(out));
    for (const b of startBoxes) occ[b] = 0;
    const parent = new Map<number, [number, number, number]>(); // key -> [parent key, box square, direction]
    parent.set(startKey, [-1, -1, -1]);
    let layer: [number[], number, number][] = [[startBoxes, out, startKey]];
    let found = startBoxes.every((b) => isGoal[b]) ? startKey : -1;
    while (found < 0 && layer.length) {
      const next: [number[], number, number][] = [];
      for (const [bs, p, key] of layer) {
        for (const b of bs) occ[b] = 1;
        region(p);
        const can = new Uint8Array(n);
        for (let k = 0; k < n; k++) if (reach[k] === stamp) can[k] = 1;
        for (let i = 0; i < bs.length && found < 0; i++) {
          const b = bs[i];
          for (let d = 0; d < 4; d++) {
            const behind = nb[b][d ^ 1];
            const to = nb[b][d];
            if (behind < 0 || to < 0 || !can[behind] || occ[to] || !live[to]) continue;
            occ[b] = 0;
            occ[to] = 1;
            const dead = blocked(to);
            const nbs = bs.map((x) => (x === b ? to : x)).sort((x, y) => x - y);
            const nk = dead ? -1 : keyOf(nbs, region(b));
            occ[to] = 0;
            occ[b] = 1;
            if (dead || parent.has(nk)) continue;
            parent.set(nk, [key, cells[b], d]);
            if (nbs.every((x) => isGoal[x])) { found = nk; break; }
            next.push([nbs, b, nk]);
          }
        }
        for (const b of bs) occ[b] = 0;
        if (found >= 0) break;
      }
      layer = next;
    }
    if (found < 0) throw new Error('room unsolved');
    const pushes: [number, number][] = [];
    for (let k = found; parent.get(k)![0] >= 0; k = parent.get(k)![0]) {
      const [, b, d] = parent.get(k)!;
      pushes.unshift([b, d]);
    }
    return pushes;
  }
}

for (const id of readdirSync(I).sort()) {
  let moves = '';
  try {
    moves = solveLevel(readFileSync(`${I}/${id}/level.txt`, 'utf8'));
  } catch {
    moves = '';
  }
  mkdirSync(`${O}/${id}`, { recursive: true });
  writeFileSync(`${O}/${id}/solution.txt`, moves + '\n');
}
