const { mat4 } = glMatrix;

let frameCounter = 0;
let fps = 0;
let fpsUpdateTime = 0;

let shaderProgram, attractionShaderProgram;
let buffer, attractionBuffer;

const branches = [];
let activeBranches = [];
let attractionPoints = new Float32Array();
let lastFrameTime = 0;

const MAX_LINES = 100000;
const branchVertexArray = new Float32Array(MAX_LINES * 2 * 3);
let currentVertexCount = 0;
let lastUploadOffset = 0; // 새로 추가된 데이터만 GPU로 전송 목적

const worker = new Worker("./worker.js", { type: "module" });
let requestIdCounter = 0;
const pendingRequests = new Map();

worker.onmessage = (e) => {
  const { type, id, result, data } = e.data;
  if (type === "extendResult" && pendingRequests.has(id)) {
    pendingRequests.get(id)(result);
    pendingRequests.delete(id);
  }
  if (type === "attractionPositions") {
    attractionPoints = new Float32Array(data);
  }
};

function requestExtend(position) {
  return new Promise((resolve) => {
    const id = ++requestIdCounter;
    pendingRequests.set(id, resolve);
    worker.postMessage({ type: "extend", payload: { id, position } });
  });
}

function requestExtendBatch(positions) {
  return new Promise((resolve) => {
    const id = ++requestIdCounter;
    pendingRequests.set(id, resolve);
    worker.postMessage({ type: "extendBatch", payload: { id, positions } });
  });
}

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
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, branchVertexArray.byteLength, gl.DYNAMIC_DRAW);
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

  const initial = [0.0, -1.0, 0.0, 0.0, -0.8, 0.0];
  branches.push(initial);
  activeBranches.push(initial);
  appendLineToVBO(...initial);

  let extendLength = 0.08;
  let minAttraPosDist = extendLength * 1.1;
  let findAttPosRange = extendLength * 1.5;

  worker.postMessage({
    type: "initWithParams",
    payload: {
      width: canvas.width,
      height: canvas.height,
      count: 3000,
      findAttPosRange,
      extendLegth: extendLength,
      minAttraPosDist,
    },
  });

  updateBranchesLoop();
  requestAnimationFrame((t) => renderLoop(gl, t));
};

function renderLoop(gl, time) {
  //프레임 제한
  /*const delta = time - lastFrameTime;
  const fpsLimit = 100;
  if (delta < 1000 / fpsLimit) {
    requestAnimationFrame((t) => renderLoop(gl, t));
    return;
  }*/
  lastFrameTime = time;

  frameCounter++;
  if (time - fpsUpdateTime >= 1000) {
    fps = frameCounter;
    document.getElementById("fpsDisplay").textContent = `FPS: ${fps}`;
    frameCounter = 0;
    fpsUpdateTime = time;
  }

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(shaderProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferSubData(
    gl.ARRAY_BUFFER,
    lastUploadOffset * 4,
    branchVertexArray.subarray(lastUploadOffset, currentVertexCount)
  );
  lastUploadOffset = currentVertexCount;

  const posLoc = gl.getAttribLocation(shaderProgram, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.LINES, 0, currentVertexCount / 3);

  if (frameCounter % 5 === 0) {
    worker.postMessage({ type: "getAttractionPositions" });
  }

  // 어트랙션 포인트 표시
  /*gl.useProgram(attractionShaderProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, attractionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, attractionPoints, gl.DYNAMIC_DRAW);
  const aPosLoc = gl.getAttribLocation(attractionShaderProgram, "position");
  gl.enableVertexAttribArray(aPosLoc);
  gl.vertexAttribPointer(aPosLoc, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.POINTS, 0, attractionPoints.length / 3);*/

  requestAnimationFrame((t) => renderLoop(gl, t));
}

async function updateBranchesLoop() {
  while (true) {
    const selected = pickBranchesWeighted(activeBranches, 100);
    const positions = selected.map((b) => {
      const last = b.slice(-3);
      return { branch: b, pos: { x: last[0], y: last[1], z: last[2] } };
    });

    const posArray = positions.map((r) => r.pos);
    const results = await requestExtendBatch(posArray);

    const branchesToSplit = [];

    for (let i = 0; i < results.length; i++) {
      const branch = positions[i].branch;
      const last = branch.slice(-3);
      const next = results[i];

      if (next.x !== last[0] || next.y !== last[1] || next.z !== last[2]) {
        branch.push(next.x, next.y, next.z);
        appendLineToVBO(last[0], last[1], last[2], next.x, next.y, next.z);

        const branchLength = branch.length / 3;
        if (branchLength >= 30 && Math.random() < 0.5) {
          branchesToSplit.push(next);
        }
      }
    }

    if (branchesToSplit.length > 0) {
      const splits = await requestExtendBatch(branchesToSplit);
      for (let i = 0; i < splits.length; i++) {
        const from = branchesToSplit[i];
        const to = splits[i];
        if (from && (to.x !== from.x || to.y !== from.y || to.z !== from.z)) {
          const newBranch = [from.x, from.y, from.z, to.x, to.y, to.z];
          branches.push(newBranch);
          activeBranches.push(newBranch);
          appendLineToVBO(from.x, from.y, from.z, to.x, to.y, to.z);
        }
      }
    }

    activeBranches = activeBranches.filter((b) => b.length / 3 < 50);
    await new Promise((r) => setTimeout(r, 1000 / (fps || 60)));
  }
}

function appendLineToVBO(x0, y0, z0, x1, y1, z1) {
  if (currentVertexCount + 6 >= branchVertexArray.length) return;
  branchVertexArray.set([x0, y0, z0, x1, y1, z1], currentVertexCount);
  currentVertexCount += 6;
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

function pickBranchesWeighted(branches, count) {
  const selected = [];
  for (const branch of branches) {
    const len = branch.length / 3;
    const weight = 1 - Math.min(len / 100, 1);
    if (Math.random() < weight) {
      selected.push(branch);
      if (selected.length >= count) break;
    }
  }
  return selected;
}

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
    gl_FragColor = vec4(1.0);
  }
`;

const attractionFragmentShaderSource = `
  precision mediump float;
  void main() {
    gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);
  }
`;
