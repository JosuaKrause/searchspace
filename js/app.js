import { initBuffers } from "./buffers.js";
import { drawScene } from "./draw.js";

function writeError(msg) {
  const elem = document.querySelector("#error");
  elem.textContent = `ERROR: ${msg}`;
}

function vertexShader(measures) {
  return `
    attribute vec4 aVertexPosition;
    attribute vec4 aVertexColor;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying lowp vec4 vColor;
    varying lowp vec4 vPos;

    void main(void) {
      float unitX = float(${measures.unitX});
      float unitY = float(${measures.unitY});
      vPos = aVertexPosition;
      vPos.x *= unitX;
      vPos.y *= unitY;
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vColor = aVertexColor;
    }
  `;
}

function fragmentShader(measures) {
  return `
    precision highp float;

    varying lowp vec4 vColor;
    varying lowp vec4 vPos;

    void main(void) {
      if ((mod(vPos.x, 2.0) < 1.0) != (mod(vPos.y, 2.0) < 1.0)) {
        gl_FragColor = vColor;
      } else {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
      }
    }
  `;
}

function initShaderProgram(gl, measures, vsSourceCb, fsSourceCb) {
  const vertexShader = loadShader(
    gl, gl.VERTEX_SHADER, measures, vsSourceCb);
  const fragmentShader = loadShader(
    gl, gl.FRAGMENT_SHADER, measures, fsSourceCb);
  const shaderProgram = gl.createProgram();
  if (vertexShader === null || fragmentShader === null) {
    return null;
  }
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    const eLog = gl.getProgramInfoLog(shaderProgram);
    writeError(`Unable to initialize the shader program: ${eLog}`);
    return null;
  }
  return shaderProgram;
}

function loadShader(gl, type, measures, sourceCb) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, sourceCb(measures));
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const eLog = gl.getShaderInfoLog(shader);
    writeError(`An error occurred compiling the shaders: ${eLog}`);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function scene(gl) {
  const width = gl.canvas.clientWidth;
  const height = gl.canvas.clientHeight;
  const maxY = 10.0;
  const unitY = 0.01;
  const maxX = maxY / height * width;
  const unitX = unitY / height * width;
  const sizeX = maxX / unitX;
  const sizeY = maxY / unitY;
  const blockX = sizeX / maxX;
  const blockY = sizeY / maxY;
  const measures = {
    maxX, maxY, unitX, unitY, sizeX, sizeY, blockX, blockY
  };
  const shaderProgram = initShaderProgram(
    gl, measures, vertexShader, fragmentShader);
  if (shaderProgram === null) {
    return;
  }
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(
        shaderProgram, "aVertexPosition"),
      vertexColor: gl.getAttribLocation(
        shaderProgram, "aVertexColor"),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(
        shaderProgram, "uProjectionMatrix"),
      modelViewMatrix: gl.getUniformLocation(
        shaderProgram, "uModelViewMatrix"),
    },
  };
  const buffers = initBuffers(gl, measures);
  drawScene(gl, measures, programInfo, buffers);
}

export function main() {
  const gl = document.querySelector("#main").getContext("webgl");
  if (gl === null) {
    writeError("Unable to initialize WebGL. It might be not supported.");
    return;
  }
  try {
    scene(gl);
  } catch (err) {
    console.error(err);
    writeError(err);
  }
}
