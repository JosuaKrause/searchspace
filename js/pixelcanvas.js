import {
  initPositionBuffer,
  loadAsTex,
  loadText,
  setPositionAttribute,
  writeMessage,
} from './misc.js';

export default class PixelCanvas {
  constructor(canvasId, topbarId, errorId, vertexShader, fragmentShader) {
    this.maxY = 10.0;
    this.unitY = 0.01;
    this.vertexShader = vertexShader;
    this.fragmentShader = fragmentShader;
    this.canvasId = canvasId;
    this.topbarId = topbarId;
    this.errorId = errorId;
    this.canvas = null;
    this.gl = null;
    this.measures = {};
    this.buffers = {};
    this.programInfo = {
      program: null,
      attribLocations: {},
      uniformLocations: {},
    };
    this.values = {};
    this.valueDefs = [];
  }

  init() {
    const canvas = document.querySelector(this.canvasId);
    if (canvas === null) {
      this.writeError(`Unable to find canvas '${this.canvasId}'.`);
      return;
    }
    const gl = canvas.getContext('webgl2');
    if (gl === null) {
      this.writeError(
        'Unable to initialize WebGL 2. It might be not supported.',
      );
      return;
    }
    this.canvas = canvas;
    this.gl = gl;
    try {
      this.setup();
    } catch (err) {
      console.error(err);
      this.writeError(err);
    }
    this.setupScene().catch((err) => {
      console.error(err);
      this.writeError(err);
    });
  }

  setup() {
    // overwrite in sub-class
  }

  getValues() {
    return this.values;
  }

  getMeasures() {
    return this.measures;
  }

  getCanvas() {
    if (!this.canvas) {
      throw new Error('canvas is not initialized');
    }
    return this.canvas;
  }

  getGL() {
    if (!this.gl) {
      throw new Error('gl is not initialized');
    }
    return this.gl;
  }

  addValue(name, shaderName, type, initialValue) {
    this.valueDefs.push({ name, shaderName, type });
    this.values[name] = initialValue;
  }

  getValueType(name) {
    const vtype = this.valueDefs.reduce(
      (res, { name: cur, type }) => (cur === name ? type : res),
      null,
    );
    if (vtype === null) {
      throw new Error(`${name} not found!`);
    }
    return vtype;
  }

  addControl(name, prettyName, info) {
    const curValue = this.getValues()[name];
    const type = this.getValueType(name);
    const topbar = document.querySelector(this.topbarId);
    const fullName = `value_${name}`;
    let elem;
    if (type === 'enum') {
      elem = document.createElement('select');
      info.options.forEach(({ value, text }) => {
        const option = document.createElement('option');
        option.setAttribute('value', value);
        option.textContent = text;
        elem.appendChild(option);
      });
      elem.value = curValue;
      elem.addEventListener('change', () => {
        const newValue = +elem.value;
        this.updateValue({ [name]: newValue });
      });
    } else if (type === 'bool') {
      elem = document.createElement('input');
      elem.setAttribute('type', 'checkbox');
      elem.checked = curValue;
      elem.addEventListener('change', () => {
        this.updateValue({ [name]: elem.checked });
      });
    } else {
      throw new Error(`unsupported type ${type} for ${name} (${shaderName})`);
    }
    elem.setAttribute('id', fullName);
    elem.setAttribute('name', fullName);
    const label = document.createElement('label');
    label.setAttribute('for', fullName);
    label.textContent = prettyName;
    const div = document.createElement('div');
    div.appendChild(label);
    div.appendChild(elem);
    topbar.appendChild(div);
  }

  async loadShader(type, path) {
    const gl = this.getGL();
    const shader = gl.createShader(type);
    gl.shaderSource(shader, await loadText(path));
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const eLog = gl.getShaderInfoLog(shader);
      this.writeError(`An error occurred compiling the shaders:\n${eLog}`);
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  async initShaderProgram(pathVert, pathFrag) {
    const gl = this.getGL();
    const [vertexShader, fragmentShader] = await Promise.all([
      this.loadShader(gl.VERTEX_SHADER, pathVert),
      this.loadShader(gl.FRAGMENT_SHADER, pathFrag),
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
      this.writeError(`Unable to initialize the shader program:\n${eLog}`);
      return null;
    }
    return shaderProgram;
  }

  async setupScene() {
    const gl = this.getGL();
    const width = gl.canvas.clientWidth;
    const height = gl.canvas.clientHeight;
    const maxY = this.maxY;
    const unitY = this.unitY;
    const maxX = (maxY / height) * width;
    const unitX = (unitY / height) * width;
    const sizeX = maxX / unitX;
    const sizeY = maxY / unitY;
    const blockX = sizeX / maxX;
    const blockY = sizeY / maxY;
    const shaderProgram = await this.initShaderProgram(
      this.vertexShader,
      this.fragmentShader,
    );
    if (shaderProgram === null) {
      return;
    }

    this.measures = {
      ...this.measures,
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
    this.buffers = {
      ...this.buffers,
      position: initPositionBuffer(gl, this.measures),
    };
    this.programInfo.program = shaderProgram;
    const { attribLocations, uniformLocations } = this.programInfo;

    attribLocations.vertexPosition = gl.getAttribLocation(
      shaderProgram,
      'aVertexPosition',
    );
    uniformLocations.projectionMatrix = gl.getUniformLocation(
      shaderProgram,
      'uProjectionMatrix',
    );
    uniformLocations.modelViewMatrix = gl.getUniformLocation(
      shaderProgram,
      'uModelViewMatrix',
    );
    uniformLocations.unit = gl.getUniformLocation(shaderProgram, 'uUnit');

    this.valueDefs.forEach(({ name, shaderName, type }) => {
      if (type !== 'array2d') {
        uniformLocations[name] = gl.getUniformLocation(
          shaderProgram,
          shaderName,
        );
      } else {
        uniformLocations[`${name}Tex`] = gl.getUniformLocation(
          shaderProgram,
          `${shaderName}Tex`,
        );
        uniformLocations[`${name}Size`] = gl.getUniformLocation(
          shaderProgram,
          `${shaderName}Size`,
        );
        uniformLocations[`${name}Count`] = gl.getUniformLocation(
          shaderProgram,
          `${shaderName}Count`,
        );
      }
    });

    this.doDraw();
  }

  doDraw() {
    try {
      this.drawScene();
    } catch (err) {
      console.error(err);
      this.writeError(err);
    }
  }

  updateValue(obj) {
    const values = this.getValues();
    Object.keys(obj).forEach((key) => {
      if (values[key] === undefined) {
        writeError(`unknown value key: ${key}`);
      }
      values[key] = obj[key];
    });
    this.doDraw();
  }

  drawScene() {
    const gl = this.getGL();
    const measures = this.getMeasures();
    const values = this.getValues();
    const programInfo = this.programInfo;
    const buffers = this.buffers;
    const valueDefs = this.valueDefs;

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const projectionMatrix = mat4.create();
    mat4.ortho(
      projectionMatrix,
      -measures.sizeX,
      measures.sizeX,
      -measures.sizeY,
      measures.sizeY,
      0.01,
      200,
    );

    const modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, -5.0]);

    setPositionAttribute(gl, buffers, programInfo);
    if (!programInfo.program) {
      this.writeError('shader not initialized!');
      return;
    }
    gl.useProgram(programInfo.program);
    gl.uniformMatrix4fv(
      programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix,
    );
    gl.uniformMatrix4fv(
      programInfo.uniformLocations.modelViewMatrix,
      false,
      modelViewMatrix,
    );
    gl.uniform2fv(programInfo.uniformLocations.unit, [
      measures.unitX,
      measures.unitY,
    ]);

    valueDefs.forEach(({ name, type }) => {
      if (type === '2d') {
        gl.uniform2fv(programInfo.uniformLocations[name], values[name]);
      } else if (['int', 'bool', 'enum'].includes(type)) {
        gl.uniform1i(programInfo.uniformLocations[name], values[name]);
      } else if (type === 'array2d') {
        loadAsTex(
          gl,
          programInfo.uniformLocations[`${name}Tex`],
          programInfo.uniformLocations[`${name}Size`],
          programInfo.uniformLocations[`${name}Count`],
          values[name],
        );
      } else {
        this.writeError(
          `unsupported type ${type} for ${name} (${shaderName})`,
        );
      }
    });

    {
      const offset = 0;
      const vertexCount = 4;
      gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
    }
  }

  writeError(msg) {
    writeMessage(this.errorId, msg);
  }
} // PixelCanvas
