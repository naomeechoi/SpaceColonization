import * as helper from "./lib/helper.js";

let grid = new Map();
let findAttPosRange = 10;
let extendLegth = 20;
let minAttraPosDist = 0.001;
let pointIdCounter = 0;
const CELL_SIZE = 0.006; // findAttPosRange랑 유사한 크기면 적절

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

export function initailizeAttractinoPoints(xLimit_, yLimit_, count_) {
  grid.clear();
  for (let i = 0; i < count_; i++) {
    const point = {
      x: helper.getRandomFloat(0, xLimit_) * ((2 * 1.5) / xLimit_) - 1.5,
      y: helper.getRandomFloat(0, yLimit_) * ((2 * 0.8) / yLimit_) - 0.8,
      z: 0.0,
      _id: pointIdCounter++,
    };
    insertToGrid(point);
  }
}

export function setRange(findAttPosRange_) {
  findAttPosRange = findAttPosRange_;
}

export function setExtendLength(extendLegth_) {
  extendLegth = extendLegth_;
}

export function setMinAttraPosDist(minAttraPosDist_) {
  minAttraPosDist = minAttraPosDist_;
}

export function getAttractionPositions() {
  const positions = [];

  for (const points of grid.values()) {
    for (const p of points) {
      positions.push(p.x, p.y, p.z);
    }
  }

  return new Float32Array(positions);
}

export function getExtendPosition(position) {
  let dir = { x: 0.0, y: 0.0, z: 0.0 };
  let usedPoints = [];
  let closestValue = null;
  let closestDist = Infinity;
  let closestKey = null;

  // 1️⃣ 처음 탐색 범위
  let searchRange = findAttPosRange;
  const maxSearchIterations = 3; // 점점 넓혀서 3단계까지 시도
  let found = false;

  for (let level = 0; level < maxSearchIterations && !found; level++) {
    const keys = getSurroundingKeys(position, searchRange);

    for (const key of keys) {
      const points = grid.get(key);
      if (!points) continue;

      for (const p of points) {
        const dist = helper.getDistanceVectors(p, position);
        if (dist <= searchRange) {
          dir.x += p.x - position.x;
          dir.y += p.y - position.y;
          dir.z += p.z - position.z;
          usedPoints.push(p);
          found = true;
        }

        // fallback용 가장 가까운 점
        if (dist < closestDist) {
          closestDist = dist;
          closestValue = p;
          closestKey = key;
        }
      }
    }

    // 2️⃣ 못 찾았으면 탐색 범위 확장
    if (!found) {
      searchRange *= 2.0;
    }
  }

  // 3️⃣ 포인트 없으면 가까운 N개로 방향 결정
  if (usedPoints.length === 0) {
    if (grid.size === 0) return position;

    const allPoints = [];
    for (const [key, pointList] of grid) {
      for (const p of pointList) {
        const dist = helper.getDistanceVectors(p, position);
        allPoints.push({ key, value: p, dist });
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

  // 4️⃣ 이동 및 예외 처리
  const prevPosition = { ...position };
  let newPos = {
    x: position.x + dir.x * extendLegth,
    y: position.y + dir.y * extendLegth,
    z: position.z + dir.z * extendLegth,
  };

  /*
  const noiseStrength = 0.02; // 조정 가능
  const noiseVec = {
    x: (Math.random() - 0.5) * noiseStrength,
    y: (Math.random() - 0.5) * noiseStrength,
    z: (Math.random() - 0.5) * noiseStrength,
  };

  newPos.x += noiseVec.x;
  newPos.y += noiseVec.y;
  newPos.z += noiseVec.z;*/

  let magnitude = helper.getDistanceVectors(prevPosition, newPos);
  const minMagnitude = 0.002;
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
    magnitude = helper.getDistanceVectors(prevPosition, newPos);
    retryCount++;
  }

  if (magnitude < minMagnitude && closestValue !== null) {
    console.warn("Fallback to closest attraction point");
    newPos = {
      x: closestValue.x,
      y: closestValue.y,
      z: closestValue.z,
    };
  }

  // 5️⃣ attraction point 제거
  for (const p of usedPoints) {
    if (helper.getDistanceVectors(p, newPos) < minAttraPosDist) {
      removeFromGrid(p);
    }
  }

  return newPos;
}
