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

    varying highp vec2 vPos;
    varying highp vec2 vUnit;

    void main(void) {
      float unitX = float(${measures.unitX});
      float unitY = float(${measures.unitY});
      vec2 unit = vec2(unitX, unitY);
      vUnit = unit;

      vPos = aVertexPosition.xy * unit;

      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    }
  `;
}

function fragmentShader(measures) {
  return `
    precision highp float;

    uniform vec2 uRefPosition;
    uniform int uFixedRef;
    uniform int uDistanceFn;
    uniform sampler2D uPointsTex;
    uniform int uPointsSize;
    uniform int uPointsCount;

    varying highp vec2 vPos;
    varying highp vec2 vUnit;

    #define PI 3.141592653589793238462643383279502884
    #define MAX_LOOP 1000

    #define TOP 1
    #define RIGHT 2
    #define BOTTOM 3
    #define LEFT 4

    #define DF_L1 0
    #define DF_L2 1
    #define DF_DOT 2
    #define DF_COS 3

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

    float getDistance(int distanceFn, vec2 a, vec2 b) {
      if (distanceFn == DF_L1) {
        return l1Dist(a, b);
      }
      if (distanceFn == DF_L2) {
        return l2Dist(a, b);
      }
      if (distanceFn == DF_DOT) {
        return dotDist(a, b);
      }
      if (distanceFn == DF_COS) {
        return cosDist(a, b);
      }
      return 0.0;
    }

    vec2 getClosest(int distanceFn, vec2 pos, bool includeRef) {
      float size = float(uPointsSize);
      float distNorm = 1.0;
      int closestIx = -1;
      if (includeRef) {
        distNorm = getDistance(distanceFn, pos, uRefPosition);
        closestIx = -2;
      }
      for (int ix = 0; ix < MAX_LOOP; ix += 1) {
        if (ix >= uPointsCount) {
          break;
        }
        float xpos = (mod(float(ix), size) + 0.5) / size;
        float ypos = (floor(float(ix) / size) + 0.5) / size;
        vec2 ref = texture2D(uPointsTex, vec2(xpos, ypos)).xy;
        float curDist = getDistance(distanceFn, pos, ref);
        if (curDist < distNorm) {
          distNorm = curDist;
          closestIx = ix;
        }
      }
      return vec2(distNorm, float(closestIx) + 0.5);
    }

    int getIx(vec2 distAndIx) {
      return int(distAndIx.y);
    }

    float getDist(vec2 distAndIx) {
      return distAndIx.x;
    }

    vec2 getNext(vec2 pos, int direction) {
      vec2 vout = pos;
      vec2 unit = vUnit * 2.0;
      if (direction == RIGHT) {
        vout.x += unit.x;
      }
      if (direction == LEFT) {
        vout.x -= unit.x;
      }
      if (direction == TOP) {
        vout.y += unit.y;
      }
      if (direction == BOTTOM) {
        vout.y -= unit.y;
      }
      return vout;
    }

    bool isBoundary(int distanceFn, vec2 pos, bool includeRef) {
      int center = getIx(getClosest(distanceFn, pos, includeRef));
      int top = getIx(getClosest(distanceFn, getNext(pos, TOP), includeRef));
      int topRight = getIx(getClosest(distanceFn, getNext(getNext(pos, TOP), RIGHT), includeRef));
      int right = getIx(getClosest(distanceFn, getNext(pos, RIGHT), includeRef));
      int bottomRight = getIx(getClosest(distanceFn, getNext(getNext(pos, BOTTOM), RIGHT), includeRef));
      int bottom = getIx(getClosest(distanceFn, getNext(pos, BOTTOM), includeRef));
      int bottomLeft = getIx(getClosest(distanceFn, getNext(getNext(pos, BOTTOM), LEFT), includeRef));
      int left = getIx(getClosest(distanceFn, getNext(pos, LEFT), includeRef));
      int topLeft = getIx(getClosest(distanceFn, getNext(getNext(pos, TOP), LEFT), includeRef));
      return !(
        (center == top)
        && (center == topRight)
        && (center == right)
        && (center == bottomRight)
        && (center == bottom)
        && (center == bottomLeft)
        && (center == left)
        && (center == topLeft));
    }

    void main(void) {
      int distanceFn = uDistanceFn;
      if (getDist(getClosest(DF_L2, vPos, uFixedRef == 1)) < 0.05) {
        gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);
      } else if (isBoundary(distanceFn, vPos, true)) {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
      } else {
        float distNorm = getDist(getClosest(distanceFn, vPos, true));
        gl_FragColor = vec4(distNorm, distNorm, distNorm, 1.0);
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
      fixedRef: gl.getUniformLocation(shaderProgram, "uFixedRef"),
      distanceFn: gl.getUniformLocation(shaderProgram, "uDistanceFn"),
      pointsTex: gl.getUniformLocation(shaderProgram, "uPointsTex"),
      pointsSize: gl.getUniformLocation(shaderProgram, "uPointsSize"),
      pointsCount: gl.getUniformLocation(shaderProgram, "uPointsCount"),
    },
  };
  const values = {
    refPosition: [0.0, 0.0],
    fixedRef: false,
    distanceFn: 0,
    points: [
      [ 4.0,  2.0],
      [-6.0,  8.0],
      [-8.0, -4.0],
      [ 2.0, -6.0],
    ],
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

  handlers(measures, values, updateValue);

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
  const gl = canvas.getContext("webgl2");
  if (gl === null) {
    writeError("Unable to initialize WebGL 2. It might be not supported.");
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

  function handlers(measures, values, updateValue) {
    canvas.addEventListener('mousemove', (e) => {
      if (!values.fixedRef) {
        updateValue({
          refPosition: convertMousePosition(measures, e),
        });
      }
    });
    canvas.addEventListener('click', (e) => {
      updateValue({
        refPosition: convertMousePosition(measures, e),
        fixedRef: !values.fixedRef,
      });
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
