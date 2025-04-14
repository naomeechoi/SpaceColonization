import * as helper from "./lib/helper.js";
import * as spaceColonization from "./spaceColonization.js";
const { mat4 } = glMatrix;

let shaderProgram, attractionShaderProgram;
let buffer, attractionBuffer;

const branches = []; // [[x0, y0, z0, x1, y1, z1, ...], [...], ...]
let attractionPoints = new Float32Array();
let lastFrameTime = 0;
let growthStartIndex = 0; // ✅ 순환 처리용 인덱스

const vertexShaderSource = `
  attribute vec3 position;
  uniform float pointSize;
  uniform mat4 projectionMatrix;
  uniform mat4 modelViewMatrix;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = pointSize;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  void main() {
    gl_FragColor = vec4(1.0); // 가지는 흰색
  }
`;

const attractionFragmentShaderSource = `
  precision mediump float;
  void main() {
    gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0); // 어트랙션 포인트는 시안색
  }
`;

window.onload = () => {
  const canvas = document.getElementById("mainCanvas");
  const gl = canvas.getContext("webgl");
  if (!gl) return alert("WebGL not supported");

  resizeCanvas(canvas, gl);
  window.addEventListener("resize", () => resizeCanvas(canvas, gl));

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 1);

  shaderProgram = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  attractionShaderProgram = createProgram(
    gl,
    vertexShaderSource,
    attractionFragmentShaderSource
  );

  buffer = gl.createBuffer();
  attractionBuffer = gl.createBuffer();

  const projectionMatrix = mat4.create();
  mat4.perspective(
    projectionMatrix,
    Math.PI / 4,
    canvas.width / canvas.height,
    0.1,
    100.0
  );

  const modelViewMatrix = mat4.create();
  mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -2]);

  setupShaderUniforms(
    gl,
    shaderProgram,
    projectionMatrix,
    modelViewMatrix,
    2.0
  );
  setupShaderUniforms(
    gl,
    attractionShaderProgram,
    projectionMatrix,
    modelViewMatrix,
    5.0
  );

  branches.push([0.0, -1.0, 0.0, 0.0, -0.8, 0.0]);

  spaceColonization.initailizeAttractinoPoints(
    canvas.width,
    canvas.height,
    4000
  );
  spaceColonization.setRange(0.08);
  spaceColonization.setExtendLength(0.06);
  spaceColonization.setMinAttraPosDist(0.05);

  requestAnimationFrame((t) => renderLoop(gl, t));
};

function renderLoop(gl, time) {
  const delta = time - lastFrameTime;
  const fps = 60;
  const interval = 1000 / fps;

  if (delta < interval) {
    requestAnimationFrame((t) => renderLoop(gl, t));
    return;
  }
  lastFrameTime = time;

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const newBranches = [];
  const totalBranches = branches.length;
  const MAX_GROWTH_PER_FRAME = 40;
  let growthCount = 0;

  for (
    let i = 0;
    i < totalBranches && growthCount < MAX_GROWTH_PER_FRAME;
    i++
  ) {
    const index = (growthStartIndex + i) % totalBranches;
    const branch = branches[index];
    const branchLength = branch.length / 3;

    if (branchLength >= 40) continue;

    const last = branch.slice(-3);
    const next = spaceColonization.getExtendPosition({
      x: last[0],
      y: last[1],
      z: last[2],
    });

    if (next.x !== last[0] || next.y !== last[1] || next.z !== last[2]) {
      branch.push(next.x, next.y, next.z);

      if (branchLength >= 20 && Math.random() < 0.5) {
        const split = spaceColonization.getExtendPosition(next);
        if (split.x !== next.x || split.y !== next.y || split.z !== next.z) {
          newBranches.push([next.x, next.y, next.z, split.x, split.y, split.z]);
        }
      }
      growthCount++;
    }
  }

  growthStartIndex = (growthStartIndex + MAX_GROWTH_PER_FRAME) % totalBranches;
  branches.push(...newBranches);

  // 가지 버퍼 업데이트
  const lineVertices = [];
  for (const branch of branches) {
    for (let i = 0; i < branch.length - 3; i += 3) {
      lineVertices.push(
        branch[i],
        branch[i + 1],
        branch[i + 2],
        branch[i + 3],
        branch[i + 4],
        branch[i + 5]
      );
    }
  }

  gl.useProgram(shaderProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(lineVertices),
    gl.DYNAMIC_DRAW
  );
  const posLoc = gl.getAttribLocation(shaderProgram, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.LINES, 0, lineVertices.length / 3);

  // 어트랙션 포인트
  gl.useProgram(attractionShaderProgram);
  attractionPoints = spaceColonization.getAttractionPositions();
  gl.bindBuffer(gl.ARRAY_BUFFER, attractionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, attractionPoints, gl.DYNAMIC_DRAW);
  const aPosLoc = gl.getAttribLocation(attractionShaderProgram, "position");
  gl.enableVertexAttribArray(aPosLoc);
  gl.vertexAttribPointer(aPosLoc, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.POINTS, 0, attractionPoints.length / 3);

  requestAnimationFrame((t) => renderLoop(gl, t));
}

function resizeCanvas(canvas, gl) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

function createShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vSrc, fSrc) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

function setupShaderUniforms(
  gl,
  program,
  projectionMatrix,
  modelViewMatrix,
  pointSize
) {
  gl.useProgram(program);
  gl.uniformMatrix4fv(
    gl.getUniformLocation(program, "projectionMatrix"),
    false,
    projectionMatrix
  );
  gl.uniformMatrix4fv(
    gl.getUniformLocation(program, "modelViewMatrix"),
    false,
    modelViewMatrix
  );
  gl.uniform1f(gl.getUniformLocation(program, "pointSize"), pointSize);
}
