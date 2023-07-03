import { initBuffers } from './buffers.js';
import { drawScene } from './draw.js';

function writeError(msg) {
  const elem = document.querySelector('#error');
  `${msg}`.split(/[\r\n\0]+/).forEach((line) => {
    const lineStr = `${line}`.trim();
    if (!lineStr) {
      return;
    }
    const lineElem = document.createElement('div');
    lineElem.textContent = lineStr;
    elem.appendChild(lineElem);
  });
}

async function vertexShader() {
  return (await fetch('/shaders/main.vert')).text();
}

async function fragmentShader() {
  return (await fetch('/shaders/main.frag')).text();
}

async function initShaderProgram(gl, vsSourceCb, fsSourceCb) {
  const [vertexShader, fragmentShader] = await Promise.all([
    loadShader(gl, gl.VERTEX_SHADER, vsSourceCb),
    loadShader(gl, gl.FRAGMENT_SHADER, fsSourceCb),
  ]);
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

async function loadShader(gl, type, sourceCb) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, await sourceCb());
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const eLog = gl.getShaderInfoLog(shader);
    writeError(`An error occurred compiling the shaders:\n${eLog}`);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

async function scene(gl, handlers) {
  const width = gl.canvas.clientWidth;
  const height = gl.canvas.clientHeight;
  const maxY = 10.0;
  const unitY = 0.01;
  const maxX = (maxY / height) * width;
  const unitX = (unitY / height) * width;
  const sizeX = maxX / unitX;
  const sizeY = maxY / unitY;
  const blockX = sizeX / maxX;
  const blockY = sizeY / maxY;
  const measures = {
    width,
    height,
    maxX,
    maxY,
    unitX,
    unitY,
    sizeX,
    sizeY,
    blockX,
    blockY,
  };
  const shaderProgram = await initShaderProgram(
    gl,
    vertexShader,
    fragmentShader,
  );
  if (shaderProgram === null) {
    return;
  }

  const buffers = initBuffers(gl, measures);
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(
        shaderProgram,
        'uProjectionMatrix',
      ),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
      unit: gl.getUniformLocation(shaderProgram, 'uUnit'),
      refPosition: gl.getUniformLocation(shaderProgram, 'uRefPosition'),
      fixedRef: gl.getUniformLocation(shaderProgram, 'uFixedRef'),
      distanceFn: gl.getUniformLocation(shaderProgram, 'uDistanceFn'),
      pointsTex: gl.getUniformLocation(shaderProgram, 'uPointsTex'),
      pointsSize: gl.getUniformLocation(shaderProgram, 'uPointsSize'),
      pointsCount: gl.getUniformLocation(shaderProgram, 'uPointsCount'),
    },
  };
  const values = {
    refPosition: [0.0, 0.0],
    fixedRef: false,
    distanceFn: 3,
    points: [
      [4.0, 2.0],
      [-6.0, 8.0],
      [-8.0, -4.0],
      [2.0, -6.0],
    ],
  };

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
  const canvas = document.querySelector('#main');
  const gl = canvas.getContext('webgl2');
  if (gl === null) {
    writeError('Unable to initialize WebGL 2. It might be not supported.');
    return;
  }
  const distanceFnSelect = document.querySelector('#distancefn');

  function convertMousePosition(measures, e) {
    const rect = canvas.getBoundingClientRect();
    const pixelX = ((e.clientX - rect.left) / rect.width) * measures.width;
    const pixelY = ((e.clientY - rect.top) / rect.height) * measures.height;
    const halfW = measures.width * 0.5;
    const halfH = measures.height * 0.5;
    const orthoX = ((pixelX - halfW) / halfW) * measures.maxX;
    const orthoY = (-(pixelY - halfH) / halfH) * measures.maxY;
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
      updateValue({ distanceFn: newDistanceFn });
    });
  }
  scene(gl, handlers).catch((err) => {
    console.error(err);
    writeError(err);
  });
}
