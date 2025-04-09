import * as helper from "./lib/helper.js";
let attractionPositions;
let findAttPosRange = 10;
let extendLegth = 20;
let minAttraPosDist = 0.001;
let prevAtt = 0;

export function initailizeAttractinoPoints(xLimit_, yLimit_, count_) {
  attractionPositions = new Map();
  const xRange = 1.5;
  const yRange = 0.8;

  for (let i = 0; i < count_; i++) {
    attractionPositions.set(i, {
      x: helper.getRandomFloat(0, xLimit_) * ((2 * xRange) / xLimit_) - xRange,
      y: helper.getRandomFloat(0, yLimit_) * ((2 * yRange) / yLimit_) - yRange,
      z: 0.0,
    });
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
  let flatArray = [];
  attractionPositions.forEach(({ x, y, z }) => {
    flatArray.push(x, y, z);
  });

  return new Float32Array(flatArray);
}

export function deleteCloseAttractionPos(usedAttractionPos_, dir_) {
  let keysToDelete = [];
  usedAttractionPos_.forEach((value, key) => {
    if (helper.getDistanceVectors(value, dir_) <= minAttraPosDist) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach((key) => attractionPositions.delete(key));
}

export function forceDeleteCloseAttractionPos(key_) {
  attractionPositions.delete(key_);
}

export function getExtendPosition(position, normal) {
  let dir = { x: 0.0, y: 0.0, z: 0.0 };
  let usedAttractionPos = new Map();

  let closestDist = Infinity;
  let closestKey = null;
  let closestValue = null;

  attractionPositions.forEach((value, key) => {
    const dist = helper.getDistanceVectors(value, position);

    if (dist <= findAttPosRange) {
      usedAttractionPos.set(key, value);
      dir.x += value.x - position.x;
      dir.y += value.y - position.y;
      dir.z += value.z - position.z;
    }

    if (dist < closestDist) {
      closestDist = dist;
      closestKey = key;
      closestValue = value;
    }
  });

  if (usedAttractionPos.size === 0) {
    if (attractionPositions.size === 0) return position;

    let distances = [];
    attractionPositions.forEach((value, key) => {
      const dist = helper.getDistanceVectors(value, position);
      distances.push({ key, value, dist });
    });

    distances.sort((a, b) => a.dist - b.dist);
    const topN = distances.slice(0, 10); // 가까운 10개만 사용

    dir = { x: 0.0, y: 0.0, z: 0.0 };
    topN.forEach(({ value }) => {
      dir.x += value.x - position.x;
      dir.y += value.y - position.y;
      dir.z += value.z - position.z;
    });

    dir.x /= topN.length;
    dir.y /= topN.length;
    dir.z /= topN.length;
  } else {
    dir.x /= usedAttractionPos.size;
    dir.y /= usedAttractionPos.size;
    dir.z /= usedAttractionPos.size;
  }

  helper.normalize(dir);

  // 방향이 너무 작으면 fallback
  const isDirTooSmall =
    Math.abs(dir.x) < 0.0001 &&
    Math.abs(dir.y) < 0.0001 &&
    Math.abs(dir.z) < 0.0001;

  /*if (isDirTooSmall && closestValue !== null) {
    dir.x = closestValue.x - position.x;
    dir.y = closestValue.y - position.y;
    dir.z = closestValue.z - position.z;
    helper.normalize(dir);

    console.log(closestValue.x, closestValue.y);
    usedAttractionPos.set(closestKey, closestValue);
    forceDeleteCloseAttractionPos(closestKey);
  }*/

  const prevPosition = { ...position };
  position.x += dir.x * extendLegth;
  position.y += dir.y * extendLegth;
  position.z += dir.z * extendLegth;

  // 너무 안 움직였으면 살짝 더 멀리까지 반복적으로 이동
  let magnitude = helper.getDistanceVectors(prevPosition, position);
  const minMagnitude = 0.001;
  let retryCount = 0;
  const maxRetries = 10;
  const scaleFactor = 1.01;

  while (magnitude < minMagnitude && retryCount < maxRetries) {
    dir.x *= scaleFactor;
    dir.y *= scaleFactor;
    dir.z *= scaleFactor;

    position.x = prevPosition.x + dir.x;
    position.y = prevPosition.y + dir.y;
    position.z = prevPosition.z + dir.z;

    magnitude = helper.getDistanceVectors(prevPosition, position);
    retryCount++;
  }

  // fallback: 그래도 이동 거리가 너무 작으면 가장 가까운 attraction point로 이동
  if (magnitude < minMagnitude && closestValue !== null) {
    console.warn("Fallback to closest attraction point");
    position.x = closestValue.x;
    position.y = closestValue.y;
    position.z = closestValue.z;
    usedAttractionPos.set(closestKey, closestValue);
    console.log(2);
  }

  // attraction point 제거
  deleteCloseAttractionPos(usedAttractionPos, position);

  return position;
}
