export function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRandomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

export function normalize(v) {
  let length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  return length === 0
    ? { x: 0, y: 0, z: 0 }
    : { x: v.x / length, y: v.y / length, z: v.z / length };
}

export function getDistanceVectors(v1, v2) {
  return Math.sqrt(
    Math.pow(v2.x - v1.x, 2) +
      Math.pow(v2.y - v1.y, 2) +
      Math.pow(v2.z - v1.z, 2)
  );
}
