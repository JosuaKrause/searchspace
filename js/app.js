import { initBuffers } from "./buffers.js";
import { drawScene } from "./draw.js";

function writeError(msg) {
  const elem = document.querySelector("#error");
  `${msg}`.split(/[\r\n\0]+/).forEach((line) => {
    const lineStr = `${line}`.trim();
    if (!lineStr) {
      return;
    }
    const lineElem = document.createElement("div");
    lineElem.textContent = lineStr;
    elem.appendChild(lineElem);
  });
}

function vertexShader(measures) {
  return `
    attribute vec4 aVertexPosition;
    attribute vec4 aVertexColor;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform vec4 uRefPosition;

    varying highp vec4 vColor;
    varying highp vec4 vPos;
    varying highp vec4 vRefPos;

    void main(void) {
      float unitX = float(${measures.unitX});
      float unitY = float(${measures.unitY});
      vec4 unit = vec4(unitX, unitY, 1.0, 1.0);

      vPos = aVertexPosition * unit;
      vRefPos = uRefPosition;

      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vColor = aVertexColor;
    }
  `;
}

function fragmentShader(measures) {
  return `
    precision highp float;

    varying highp vec4 vColor;
    varying highp vec4 vPos;
    varying highp vec4 vRefPos;

    float dot2d(vec4 a, vec4 b) {
      return a.x * b.x + a.y * b.y;
    }

    float card(vec4 v) {
      return sqrt(v.x * v.x + v.y * v.y);
    }

    float dotDist(vec4 a, vec4 b) {
      return 1.0 / (1.0 + exp(dot2d(a, b)));
    }

    float cos2d(vec4 a, vec4 b) {
      return dot2d(a, b) / card(a) / card(b);
    }

    float cosDist(vec4 a, vec4 b) {
      return (1.0 - cos2d(a, b)) * 0.5;
    }

    void main(void) {
      // float distNorm = cosDist(vPos, vRefPos);
      float distNorm = dotDist(vPos, vRefPos);
      gl_FragColor = vec4(distNorm, distNorm, distNorm, 1.0);
      // vec4 ref = floor(vRefPos);
      // if (vPos.x >= ref.x && vPos.x < ref.x + 1.0
      //     && vPos.y >= ref.y && vPos.y < ref.y + 1.0) {
      //   gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
      // } else {
      //   gl_FragColor = vColor;
      // }
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
    writeError(`Unable to initialize the shader program:\n${eLog}`);
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
    writeError(`An error occurred compiling the shaders:\n${eLog}`);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function scene(gl, handlers) {
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
    width, height, maxX, maxY, unitX, unitY, sizeX, sizeY, blockX, blockY
  };
  const shaderProgram = initShaderProgram(
    gl, measures, vertexShader, fragmentShader);
    if (shaderProgram === null) {
      return;
    }

  const buffers = initBuffers(gl, measures);
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
      vertexColor: gl.getAttribLocation(shaderProgram, "aVertexColor"),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(
        shaderProgram, "uProjectionMatrix"),
      modelViewMatrix: gl.getUniformLocation(
        shaderProgram, "uModelViewMatrix"),
      refPosition: gl.getUniformLocation(shaderProgram, "uRefPosition")
    },
  };
  const values = {
    refPosition: [1.0, 1.0, 1.0, 1.0],
  }

  function updateValue(obj) {
    Object.keys(obj).forEach((key) => {
      if (values[key] === undefined) {
        writeError(`unknown value key: ${key}`);
      }
      values[key] = obj[key];
    });
    doDraw();
  }

  handlers(measures, updateValue);

  function doDraw() {
    try {
      drawScene(gl, measures, programInfo, buffers, values);
    } catch (err) {
      console.error(err);
      writeError(err);
    }
  }

  doDraw();
}

export function main() {
  const canvas = document.querySelector("#main");
  const gl = canvas.getContext("webgl");
  if (gl === null) {
    writeError("Unable to initialize WebGL. It might be not supported.");
    return;
  }

  function handlers(measures, updateValue) {
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const pixelX = (e.clientX - rect.left) / rect.width * measures.width;
      const pixelY = (e.clientY - rect.top) / rect.height * measures.height;
      const halfW = measures.width * 0.5;
      const halfH = measures.height * 0.5;
      const orthoX = (pixelX - halfW) / halfW * measures.maxX;
      const orthoY = -(pixelY - halfH) / halfH * measures.maxY;
      updateValue({refPosition: [orthoX, orthoY, 1.0, 1.0]});
    });
  }
  try {
    scene(gl, handlers);
  } catch (err) {
    console.error(err);
    writeError(err);
  }
}
