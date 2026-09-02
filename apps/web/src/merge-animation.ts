export type Cell = [number, number];

export interface MergeStep {
  from: Cell;
  to: Cell;
}

export type MergeLayer = MergeStep[];

function cellKey([row, col]: Cell): string {
  return `${row},${col}`;
}

function adjacentCells([row, col]: Cell): Cell[] {
  return [[row - 1, col], [row, col - 1], [row, col + 1], [row + 1, col]];
}

export function buildMergeLayers(cells: Cell[], anchor: Cell): MergeLayer[] {
  const cellKeys = new Set(cells.map(cellKey));
  const distance = new Map<string, number>([[cellKey(anchor), 0]]);
  const parent = new Map<string, Cell>();
  const queue: Cell[] = [anchor];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const nextDistance = distance.get(cellKey(current))! + 1;
    for (const neighbor of adjacentCells(current)) {
      const key = cellKey(neighbor);
      if (!cellKeys.has(key) || distance.has(key)) continue;
      distance.set(key, nextDistance);
      parent.set(key, current);
      queue.push(neighbor);
    }
  }

  const layers = new Map<number, MergeLayer>();
  for (const cell of cells) {
    const key = cellKey(cell);
    const depth = distance.get(key);
    const target = parent.get(key);
    if (!depth || !target) continue;
    const layer = layers.get(depth) ?? [];
    layer.push({ from: cell, to: target });
    layers.set(depth, layer);
  }

  return [...layers.entries()]
    .sort(([leftDepth], [rightDepth]) => rightDepth - leftDepth)
    .map(([, layer]) => layer.sort((left, right) => left.from[0] - right.from[0] || left.from[1] - right.from[1]));
}
