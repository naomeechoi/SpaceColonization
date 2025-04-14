import * as helper from "./lib/helper.js";

let grid = new Map();
let findAttPosRange = 0.08;
let extendLegth = 0.06;
let minAttraPosDist = 0.05;
let pointIdCounter = 0;
let CELL_SIZE = 0.006;

function getGridKey(pos) {
  const x = Math.floor(pos.x / CELL_SIZE);
  const y = Math.floor(pos.y / CELL_SIZE);
  const z = Math.floor(pos.z / CELL_SIZE);
  return `${x}_${y}_${z}`;
}

function insertToGrid(point) {
  const key = getGridKey(point);
  if (!grid.has(key)) grid.set(key, []);
  grid.get(key).push(point);
}

function removeFromGrid(point) {
  const key = getGridKey(point);
  const cell = grid.get(key);
  if (!cell) return;
  const index = cell.findIndex((p) => p._id === point._id);
  if (index !== -1) cell.splice(index, 1);
  if (cell.length === 0) grid.delete(key);
}

function getSurroundingKeys(pos, radius) {
  const r = Math.ceil(radius / CELL_SIZE);
  const cx = Math.floor(pos.x / CELL_SIZE);
  const cy = Math.floor(pos.y / CELL_SIZE);
  const cz = Math.floor(pos.z / CELL_SIZE);
  let keys = [];
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        keys.push(`${cx + dx}_${cy + dy}_${cz + dz}`);
      }
    }
  }
  return keys;
}

function getExtendPosition(position) {
  let dir = { x: 0.0, y: 0.0, z: 0.0 };
  let usedPoints = [];
  let closestValue = null;
  let closestDist = Infinity;

  const gridSearchRadius = findAttPosRange;
  let searchRange = findAttPosRange * findAttPosRange;
  const maxSearchIterations = 3;
  let found = false;

  for (let level = 0; level < maxSearchIterations && !found; level++) {
    const keys = getSurroundingKeys(
      position,
      gridSearchRadius * Math.pow(2, level)
    );
    for (const key of keys) {
      const points = grid.get(key);
      if (!points) continue;

      for (const p of points) {
        const dist = helper.getSquaredDistance(p, position);
        if (dist <= searchRange) {
          dir.x += p.x - position.x;
          dir.y += p.y - position.y;
          dir.z += p.z - position.z;
          usedPoints.push(p);
          found = true;
        }
        if (dist < closestDist) {
          closestDist = dist;
          closestValue = p;
        }
      }
    }
    if (!found) searchRange *= 2.0;
  }

  if (usedPoints.length === 0) {
    if (grid.size === 0) return position;

    const allPoints = [];
    for (const pointList of grid.values()) {
      for (const p of pointList) {
        const dist = helper.getSquaredDistance(p, position);
        allPoints.push({ value: p, dist });
      }
    }

    allPoints.sort((a, b) => a.dist - b.dist);
    const topN = allPoints.slice(0, 10);

    for (const { value } of topN) {
      dir.x += value.x - position.x;
      dir.y += value.y - position.y;
      dir.z += value.z - position.z;
    }

    dir.x /= topN.length;
    dir.y /= topN.length;
    dir.z /= topN.length;
  } else {
    dir.x /= usedPoints.length;
    dir.y /= usedPoints.length;
    dir.z /= usedPoints.length;
  }

  helper.normalize(dir);

  const prevPosition = { ...position };
  let newPos = {
    x: position.x + dir.x * extendLegth,
    y: position.y + dir.y * extendLegth,
    z: position.z + dir.z * extendLegth,
  };

  let magnitude = helper.getSquaredDistance(prevPosition, newPos);
  let minMagnitude = 0.002 ** 2;
  let retryCount = 0;
  const maxRetries = 10;
  const scaleFactor = 1.01;

  while (magnitude < minMagnitude && retryCount < maxRetries) {
    dir.x *= scaleFactor;
    dir.y *= scaleFactor;
    dir.z *= scaleFactor;
    newPos = {
      x: prevPosition.x + dir.x,
      y: prevPosition.y + dir.y,
      z: prevPosition.z + dir.z,
    };
    magnitude = helper.getSquaredDistance(prevPosition, newPos);
    retryCount++;
  }

  if (magnitude < minMagnitude && closestValue !== null) {
    newPos = {
      x: closestValue.x,
      y: closestValue.y,
      z: closestValue.z,
    };
  }

  for (const p of usedPoints) {
    if (
      helper.getSquaredDistance(p, newPos) <
      minAttraPosDist * minAttraPosDist
    ) {
      removeFromGrid(p);
    }
  }

  return newPos;
}

function getAttractionPositions() {
  const positions = [];
  for (const points of grid.values()) {
    for (const p of points) {
      positions.push(p.x, p.y, p.z);
    }
  }
  return positions;
}

// 메시지 수신 핸들링
self.onmessage = function (e) {
  const { type, payload } = e.data;

  if (type === "initWithParams") {
    const {
      width,
      height,
      count,
      findAttPosRange: range,
      extendLegth: length,
      minAttraPosDist: minDist,
    } = payload;

    findAttPosRange = payload.findAttPosRange ?? findAttPosRange;
    extendLegth = payload.extendLegth ?? extendLegth;
    minAttraPosDist = payload.minAttraPosDist ?? minAttraPosDist;
    // 안정적인 셀 크기 자동 계산
    CELL_SIZE = findAttPosRange / 2; // 14는 실험적 안전값
    console.log(CELL_SIZE);

    // attraction point 초기화
    grid.clear();
    for (let i = 0; i < count; i++) {
      const point = {
        x: helper.getRandomFloat(0, width) * ((2 * 1.5) / width) - 1.5,
        y: helper.getRandomFloat(0, height) * ((2 * 0.8) / height) - 0.8,
        z: 0.0,
        _id: pointIdCounter++,
      };
      insertToGrid(point);
    }
  }

  if (type === "extend") {
    const { id, position } = payload;
    const result = getExtendPosition(position);
    self.postMessage({ type: "extendResult", id, result });
  }

  if (type === "getAttractionPositions") {
    const data = getAttractionPositions();
    self.postMessage({ type: "attractionPositions", data });
  }

  if (type === "extendBatch") {
    const { id, positions } = payload;
    const results = positions.map((pos) => getExtendPosition(pos));
    postMessage({ type: "extendResult", id, result: results });
  }
};
