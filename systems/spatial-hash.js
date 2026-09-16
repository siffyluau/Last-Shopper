class SpatialHash {
  constructor(cellSize = 192) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  clear() {
    this.cells.clear();
  }

  key(x, y) {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }

  insert(entity) {
    if (!Number.isFinite(entity?.x) || !Number.isFinite(entity?.y)) return;
    const key = this.key(entity.x, entity.y);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(entity);
  }

  rebuild(entities) {
    this.clear();
    for (const entity of entities) this.insert(entity);
    return this;
  }

  queryAabb(minX, minY, maxX, maxY, output = []) {
    const startX = Math.floor(minX / this.cellSize);
    const endX = Math.floor(maxX / this.cellSize);
    const startY = Math.floor(minY / this.cellSize);
    const endY = Math.floor(maxY / this.cellSize);
    for (let cellX = startX; cellX <= endX; cellX += 1) {
      for (let cellY = startY; cellY <= endY; cellY += 1) {
        const cell = this.cells.get(`${cellX},${cellY}`);
        if (cell) output.push(...cell);
      }
    }
    return output;
  }

  queryRadius(x, y, radius, output = []) {
    return this.queryAabb(x - radius, y - radius, x + radius, y + radius, output);
  }
}

module.exports = SpatialHash;
