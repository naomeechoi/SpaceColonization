// main.js
//git test
const { mat4 } = glMatrix;
if (!mat4) {
  console.error("glMatrix is not loaded correctly.");
} else {
  console.log("glMatrix loaded successfully.");
}

const vertexShaderSource = `
    attribute vec3 position;
    uniform mat4 projectionMatrix;
    uniform mat4 modelViewMatrix;
    void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    void main() {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // 흰색 라인
    }
`;

// 선을 그리기 위한 두 점
const vertices = new Float32Array([
  -0.5,
  0.5,
  0.0, // 점 1 (x, y, z)
  0.5,
  -0.5,
  0.0, // 점 2 (x, y, z)
  0.5,
  0.5,
  0.0, // 점 2 (x, y, z)
]);

window.onload = function () {
  var canvas = document.getElementById("mainCanvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  var gl = canvas.getContext("webgl");
  if (!gl) {
    console.log("WebGL not supported, falling back on experimental-webgl");
    gl = canvas.getContext("experimental-webgl");
  }
  if (!gl) {
    alert("Your browser does not support WebGL");
  }

  // 기본 클리어 색상 설정
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // 버텍스 데이터 버퍼 생성
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  // 셰이더 생성
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );

  // 셰이더 프로그램 생성
  const shaderProgram = createProgram(gl, vertexShader, fragmentShader);
  ``;

  // position 속성 위치 찾기
  const positionLocation = gl.getAttribLocation(shaderProgram, "position");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

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

  // 선 그리기gl.drawArrays(gl.LINE_STRIP, 0, 3);
  gl.drawArrays(gl.LINE_STRIP, 0, 3); // 두 점을 이어서 선을 그림
};

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
