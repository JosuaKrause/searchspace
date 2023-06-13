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

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform vec2 uRefPosition;
    uniform int uDistanceFn;

    varying highp vec2 vPos;
    varying highp vec2 vRefPos;
    varying float vDistanceFn;

    void main(void) {
      float unitX = float(${measures.unitX});
      float unitY = float(${measures.unitY});
      vec2 unit = vec2(unitX, unitY);

      vPos = aVertexPosition.xy * unit;
      vRefPos = uRefPosition;
      vDistanceFn = float(uDistanceFn) + 0.5;

      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    }
  `;
}

function fragmentShader(measures) {
  return `
    precision highp float;

    varying highp vec2 vPos;
    varying highp vec2 vRefPos;
    varying float vDistanceFn;

    #define PI 3.141592653589793238462643383279502884

    float dot2d(vec2 a, vec2 b) {
      return dot(a, b);
    }

    float card(vec2 v) {
      return sqrt(dot(v, v));
    }

    float dotDist(vec2 a, vec2 b) {
      return 1.0 / (1.0 + exp(dot2d(a, b)));
    }

    float cos2d(vec2 a, vec2 b) {
      return dot2d(a, b) / card(a) / card(b);
    }

    float cosDist(vec2 a, vec2 b) {
      return (1.0 - cos2d(a, b)) * 0.5;
    }

    float normAtan(float v) {
      return 2.0 * atan(v) / PI;
    }

    float sumAll(vec2 v) {
      return dot(v, vec2(1.0, 1.0));
    }

    float l2Dist(vec2 a, vec2 b) {
      vec2 res = ((a - b) * (a - b));
      return normAtan(sqrt(sumAll(res)));
    }

    float l1Dist(vec2 a, vec2 b) {
      vec2 res = abs(a - b);
      return normAtan(sumAll(res));
    }

    float getDistance(vec2 a, vec2 b) {
      int distanceFn = int(vDistanceFn);
      if (distanceFn == 0) {
        return l1Dist(a, b);
      }
      if (distanceFn == 1) {
        return l2Dist(a, b);
      }
      if (distanceFn == 2) {
        return dotDist(a, b);
      }
      if (distanceFn == 3) {
        return cosDist(a, b);
      }
      return 0.0;
    }

    void main(void) {
      float distNorm = getDistance(vPos, vRefPos);
      gl_FragColor = vec4(distNorm, distNorm, distNorm, 1.0);
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
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(
        shaderProgram, "uProjectionMatrix"),
      modelViewMatrix: gl.getUniformLocation(
        shaderProgram, "uModelViewMatrix"),
      refPosition: gl.getUniformLocation(shaderProgram, "uRefPosition"),
      distanceFn: gl.getUniformLocation(shaderProgram, "uDistanceFn"),
    },
  };
  const values = {
    refPosition: [1.0, 1.0],
    distanceFn: 3,
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
  const distanceFnSelect = document.querySelector("#distancefn");

  function convertMousePosition(measures, e) {
    const rect = canvas.getBoundingClientRect();
    const pixelX = (e.clientX - rect.left) / rect.width * measures.width;
    const pixelY = (e.clientY - rect.top) / rect.height * measures.height;
    const halfW = measures.width * 0.5;
    const halfH = measures.height * 0.5;
    const orthoX = (pixelX - halfW) / halfW * measures.maxX;
    const orthoY = -(pixelY - halfH) / halfH * measures.maxY;
    return [orthoX, orthoY];
  }

  let trackMouse = true;

  function handlers(measures, updateValue) {
    canvas.addEventListener('mousemove', (e) => {
      if (trackMouse) {
        updateValue({refPosition: convertMousePosition(measures, e)});
      }
    });
    canvas.addEventListener('click', (e) => {
      trackMouse = !trackMouse;
      updateValue({refPosition: convertMousePosition(measures, e)});
    });
    distanceFnSelect.addEventListener('change', () => {
      const newDistanceFn = +distanceFnSelect.value;
      updateValue({distanceFn: newDistanceFn});
    });
  }
  try {
    scene(gl, handlers);
  } catch (err) {
    console.error(err);
    writeError(err);
  }
}
