// Pathfinding over the Studio island's walk grid (public/playground/island-nav.json, written by
// art/island/build_island.py). Coordinates are the site's: x right, z towards the viewer; y is height.
// Rules live in the grid: water, obstacles and the island's edge are not walkable (docs/studio.md).

export type NavGrid = { res: number; x0: number; z0: number; size: number; rows: string[] };
export type Cell = { i: number; j: number }; // i: row along z, j: column along x
export type Point = { x: number; z: number };

export async function loadNav(url = "/playground/island-nav.json"): Promise<NavGrid> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Island walk grid: ${res.status}`);
  return res.json();
}

export const toCell = (g: NavGrid, p: Point): Cell => ({ i: Math.round((p.z - g.z0) / g.res), j: Math.round((p.x - g.x0) / g.res) });
export const toPoint = (g: NavGrid, c: Cell): Point => ({ x: g.x0 + c.j * g.res, z: g.z0 + c.i * g.res });

export function walkable(g: NavGrid, i: number, j: number) {
  return i >= 0 && j >= 0 && i < g.size && j < g.size && g.rows[i].charCodeAt(j) === 49; // "1"
}

/** Is a world point on a walkable cell? */
export const canStand = (g: NavGrid, p: Point) => {
  const c = toCell(g, p);
  return walkable(g, c.i, c.j);
};

/** The walkable cell nearest to c (rings outwards), or null if none within maxR cells. */
export function nearestWalkable(g: NavGrid, c: Cell, maxR = 14): Cell | null {
  if (walkable(g, c.i, c.j)) return c;
  for (let r = 1; r <= maxR; r++) {
    let best: Cell | null = null;
    let bestD = Infinity;
    for (let di = -r; di <= r; di++) {
      for (let dj = -r; dj <= r; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = c.i + di, j = c.j + dj;
        if (!walkable(g, i, j)) continue;
        const d = di * di + dj * dj;
        if (d < bestD) {
          bestD = d;
          best = { i, j };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Can you walk in a straight line from a to b? Samples the segment at a quarter of a cell. */
export function lineOfSight(g: NavGrid, a: Point, b: Point) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const steps = Math.ceil(Math.hypot(dx, dz) / (g.res * 0.25));
  for (let k = 0; k <= steps; k++) {
    const t = steps ? k / steps : 0;
    if (!canStand(g, { x: a.x + dx * t, z: a.z + dz * t })) return false;
  }
  return true;
}

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
] as const;

/**
 * A walkable route from `from` to `to` as world points (excluding the start), or [] if there is none.
 * A* over the grid in eight directions without cutting corners, then straightened wherever there is a
 * clear line, so Folio walks in natural lines rather than grid steps.
 */
export function findPath(g: NavGrid, from: Point, to: Point): Point[] {
  const s = nearestWalkable(g, toCell(g, from));
  const e = nearestWalkable(g, toCell(g, to));
  if (!s || !e) return [];
  const N = g.size, idx = (i: number, j: number) => i * N + j;
  const start = idx(s.i, s.j), goal = idx(e.i, e.j);
  const gScore = new Float32Array(N * N).fill(Infinity);
  const came = new Int32Array(N * N).fill(-1);
  const closed = new Uint8Array(N * N);
  const h = (i: number, j: number) => {
    const di = Math.abs(i - e.i), dj = Math.abs(j - e.j);
    return Math.max(di, dj) + (Math.SQRT2 - 1) * Math.min(di, dj);
  };
  // A small binary heap of [f, index].
  const heap: [number, number][] = [];
  const push = (f: number, n: number) => {
    heap.push([f, n]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  gScore[start] = 0;
  push(h(s.i, s.j), start);
  while (heap.length) {
    const [, n] = pop();
    if (n === goal) break;
    if (closed[n]) continue;
    closed[n] = 1;
    const i = Math.floor(n / N), j = n % N;
    for (const [di, dj, cost] of DIRS) {
      const a = i + di, b = j + dj;
      if (!walkable(g, a, b)) continue;
      if (di && dj && (!walkable(g, i + di, j) || !walkable(g, i, j + dj))) continue; // no corner cutting
      const m = idx(a, b), ng = gScore[n] + cost;
      if (ng < gScore[m]) {
        gScore[m] = ng;
        came[m] = n;
        push(ng + h(a, b), m);
      }
    }
  }
  if (start !== goal && came[goal] === -1) return [];
  const cells: Point[] = [];
  for (let n = goal; n !== -1 && n !== start; n = came[n]) cells.push(toPoint(g, { i: Math.floor(n / N), j: n % N }));
  cells.reverse();
  // The exact click point when it is walkable, instead of the cell centre.
  if (canStand(g, to) && cells.length) cells[cells.length - 1] = { ...to };
  if (!cells.length) return canStand(g, to) ? [{ ...to }] : [];
  // String-pulling: keep only the turns that a straight line can't skip.
  const out: Point[] = [];
  let anchor: Point = from;
  for (let k = 0; k < cells.length; k++) {
    const next = cells[k + 1];
    if (!next || !lineOfSight(g, anchor, next)) {
      out.push(cells[k]);
      anchor = cells[k];
    }
  }
  return out;
}
