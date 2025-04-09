// main.js
//git test
import * as helper from "./lib/helper.js";
import * as spaceColonization from "./spaceColonization.js";
const { mat4 } = glMatrix;
if (!mat4) {
  console.error("glMatrix is not loaded correctly.");
} else {
  console.log("glMatrix loaded successfully.");
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
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // 흰색 라인
    }
`;

const attractionVertexShaderSource = `
    attribute vec3 position;
    uniform float pointSize;
    uniform mat4 projectionMatrix;
    uniform mat4 modelViewMatrix;
    void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = pointSize;
    }
`;

const attractionFragmentShaderSource = `
    precision mediump float;
    void main() {
        gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0); // 흰색 라인
    }
`;

let shaderProgram;
let attractionShaderProgram;
let attractionBuffer;
// 선을 그리기 위한 두 점
var vertexArray = [0.0, -1.0, 0.0, 0.0, -0.8, 0.0];

let position = { x: 0.0, y: -0.8, z: 0.0 };
let lastTime = 0;
const fps = 60;

window.onload = function () {
  var canvas = document.getElementById("mainCanvas");

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  var gl = canvas.getContext("webgl");
  if (!gl) {
    console.log("WebGL not supported, falling back on experimental-webgl");
    gl = canvas.getContext("experimental-webgl");
  }
  if (!gl) {
    alert("Your browser does not support WebGL");
  }

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  attractionBuffer = gl.createBuffer();

  // 셰이더 생성
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );

  // 셰이더 프로그램 생성
  shaderProgram = createProgram(gl, vertexShader, fragmentShader);
  ``;

  // position 속성 위치 찾기
  const positionLocation = gl.getAttribLocation(shaderProgram, "position");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

  const pointSizeLocation = gl.getUniformLocation(shaderProgram, "pointSize");
  gl.uniform1f(pointSizeLocation, 10.0);

  // projectionMatrix 설정
  const projectionMatrix = mat4.create();
  mat4.perspective(
    projectionMatrix,
    Math.PI / 4, // 45도
    canvas.width / canvas.height, // 종횡비
    0.1, // 근거리 클리핑
    100.0 // 원거리 클리핑
  );

  // 모델뷰 매트릭스 설정
  const modelViewMatrix = mat4.create();
  mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -2]); // 카메라 뒤로 이동

  // uniform으로 매트릭스 전달
  const projectionMatrixLocation = gl.getUniformLocation(
    shaderProgram,
    "projectionMatrix"
  );
  gl.uniformMatrix4fv(projectionMatrixLocation, false, projectionMatrix);

  const modelViewMatrixLocation = gl.getUniformLocation(
    shaderProgram,
    "modelViewMatrix"
  );
  gl.uniformMatrix4fv(modelViewMatrixLocation, false, modelViewMatrix);

  attractionShaderProgram = createAttractionPointerShader(gl, canvas);

  spaceColonization.initailizeAttractinoPoints(
    canvas.width,
    canvas.height,
    4000
  );
  spaceColonization.setRange(0.07);
  spaceColonization.setExtendLength(0.1);
  spaceColonization.setMinAttraPosDist(0.05);

  requestAnimationFrame(function (time) {
    updateAndRender(gl, buffer, time);
  });
};

function updateAndRender(gl, buffer, time) {
  let deltaTime = time - lastTime;

  if (deltaTime > 1000 / fps) {
    // FPS를 30으로 제한
    lastTime = time;

    gl.clearColor(0.0, 0.0, 0.0, 1.0); // 검은색 배경
    gl.clearDepth(1.0); // 깊이 버퍼도 초기화
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(shaderProgram);
    // spaceColonization 함수에서 새로운 포지션을 받아옴
    let newPosition = spaceColonization.getExtendPosition(position, true);
    const newVertexArray = new Float32Array(vertexArray.length + 3);
    newVertexArray.set(vertexArray);
    newVertexArray.set(
      [newPosition.x, newPosition.y, newPosition.z],
      vertexArray.length
    );
    vertexArray = newVertexArray;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (
      vertexArray.byteLength >
      gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE)
    ) {
      gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.DYNAMIC_DRAW);
    } else {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertexArray);
    }

    // 선 그리기
    gl.drawArrays(gl.LINE_STRIP, 0, vertexArray.length / 3);

    gl.useProgram(attractionShaderProgram);
    /*
    gl.bindBuffer(gl.ARRAY_BUFFER, attractionBuffer);*/
    let tempArray = spaceColonization.getAttractionPositions();
    gl.bufferData(
      gl.ARRAY_BUFFER,
      tempArray.length === 0 ? new Float32Array() : tempArray,
      gl.DYNAMIC_DRAW
    );

    //const posLoc = gl.getAttribLocation(attractionShaderProgram, "position");

    //gl.enableVertexAttribArray(posLoc);
    //gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
    /*if (
      vertexArray.byteLength >
      gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE)
    ) {
      gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.DYNAMIC_DRAW);
    } else {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertexArray);
    }*/
    // 선 그리기
    //console.log(tempArray.length / 3);
    gl.drawArrays(gl.POINTS, 0, tempArray.length / 3);

    position = newPosition;
    //console.log(position.x + ", " + position.y + ", ");
  }

  // 다음 프레임을 요청하여 계속해서 업데이트
  requestAnimationFrame((timestamp) => updateAndRender(gl, buffer, timestamp));
}

// 쉐이더 생성
function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) return shader;

  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("ERROR linking program", gl.getProgramInfoLog(program));
    return;
  }
  gl.validateProgram(program);
  if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
    console.error("ERROR validating program", gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);
  return program;
}

function createAttractionPointerShader(gl, canvas) {
  // 셰이더 생성
  const attVertexShader = createShader(
    gl,
    gl.VERTEX_SHADER,
    attractionVertexShaderSource
  );
  const attFragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    attractionFragmentShaderSource
  );

  // 셰이더 프로그램 생성
  let tempAttractionShaderProgram = createProgram(
    gl,
    attVertexShader,
    attFragmentShader
  );

  // position 속성 위치 찾기
  const positionLocation = gl.getAttribLocation(
    tempAttractionShaderProgram,
    "position"
  );
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
  const pointSizeLocation = gl.getUniformLocation(
    tempAttractionShaderProgram,
    "pointSize"
  );
  gl.uniform1f(pointSizeLocation, 5.0);
  // projectionMatrix 설정
  const projectionMatrix = mat4.create();
  mat4.perspective(
    projectionMatrix,
    Math.PI / 4, // 45도
    canvas.width / canvas.height, // 종횡비
    0.1, // 근거리 클리핑
    100.0 // 원거리 클리핑
  );
  // 모델뷰 매트릭스 설정
  const modelViewMatrix = mat4.create();
  mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -2]); // 카메라 뒤로
  // uniform으로 매트릭스 전달
  const projectionMatrixLocation = gl.getUniformLocation(
    tempAttractionShaderProgram,
    "projectionMatrix"
  );
  gl.uniformMatrix4fv(projectionMatrixLocation, false, projectionMatrix);
  const modelViewMatrixLocation = gl.getUniformLocation(
    tempAttractionShaderProgram,
    "modelViewMatrix"
  );
  gl.uniformMatrix4fv(modelViewMatrixLocation, false, modelViewMatrix);

  return tempAttractionShaderProgram;
}
