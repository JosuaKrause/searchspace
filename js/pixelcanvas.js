import {
  download,
  initPositionBuffer,
  loadAsTex,
  loadTexFile,
  loadText,
  setPositionAttribute,
  writeMessage,
} from './misc.js';

const NO_RECORDING = 'no_recording';
const COUNT_DOWN = 'count_down';
const IS_RECORDING = 'is_recording';

export default class PixelCanvas {
  constructor(
    canvasId,
    topbarId,
    bottombarId,
    errorId,
    vertexShader,
    fragmentShader,
    width,
    height,
    initMaxY,
  ) {
    this.maxY = initMaxY;
    this.width = width;
    this.height = height;
    this.vertexShader = vertexShader;
    this.fragmentShader = fragmentShader;
    this.canvasId = canvasId;
    this.topbarId = topbarId;
    this.bottombarId = bottombarId;
    this.errorId = errorId;
    this.canvas = null;
    this.gl = null;
    this.measures = null;
    this.buffers = {};
    this.programInfo = {
      program: null,
      attribLocations: {},
      uniformLocations: {},
    };
    this.values = {};
    this.valueDefs = [];
    this.recordingState = NO_RECORDING;
  }

  init() {
    const canvasDiv = document.querySelector(this.canvasId);
    if (canvasDiv === null) {
      this.writeError(`Unable to find canvas container '${this.canvasId}'.`);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.setAttribute('width', this.width);
    canvas.setAttribute('height', this.height);
    canvas.style.width = `${this.width}px`;
    canvas.style.height = `${this.height}px`;
    canvasDiv.appendChild(canvas);
    const gl = canvas.getContext('webgl2');
    if (gl === null) {
      this.writeError(
        'Unable to initialize WebGL 2. It might be not supported.',
      );
      return;
    }
    this.canvas = canvas;
    this.gl = gl;
    this.runSetup().catch((err) => {
      console.error(err);
      this.writeError(err);
    });
  }

  async setup() {
    // overwrite in sub-class
  }

  async runSetup() {
    await this.setup();
    await this.setupScene();
  }

  getValues() {
    return this.values;
  }

  computeMeasures() {
    const gl = this.getGL();
    const width = gl.canvas.clientWidth;
    const height = gl.canvas.clientHeight;
    const maxY = this.maxY;
    const superSampling = 4.0;
    const unitY = (maxY * 2.0) / height / superSampling;
    const maxX = (maxY / height) * width;
    const unitX = (unitY / height) * width;
    const sizeX = maxX / unitX;
    const sizeY = maxY / unitY;
    const blockX = sizeX / maxX;
    const blockY = sizeY / maxY;
    return {
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
  }

  getMeasures() {
    if (this.measures === null) {
      throw new Error('measures are not initialized');
    }
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

  addGenericControl(fullName, prettyName, type, initValue, setValue, info) {
    const label = document.createElement('label');
    label.setAttribute('for', fullName);
    label.textContent = prettyName;
    const elemType = {
      enum: 'select',
      bool: 'input',
      range: 'input',
    }[type];
    if (!elemType) {
      throw new Error(
        `unsupported type ${type} for ${fullName} (${shaderName})`,
      );
    }
    const elem = document.createElement(elemType);
    elem.classList.add(type);
    elem.setAttribute('id', fullName);
    elem.setAttribute('name', fullName);
    const div = document.createElement('div');
    div.appendChild(label);
    div.appendChild(elem);
    if (type === 'enum') {
      info.options.forEach(({ value, text }) => {
        const option = document.createElement('option');
        option.setAttribute('value', value);
        option.textContent = text;
        elem.appendChild(option);
      });
      elem.value = initValue;
      elem.addEventListener('change', () => {
        const newValue = +elem.value;
        setValue(newValue);
      });
    } else if (type === 'bool') {
      elem.setAttribute('type', 'checkbox');
      elem.checked = initValue;
      elem.addEventListener('change', () => {
        setValue(elem.checked);
      });
    } else if (type === 'range') {
      const maxValue = info['max'];
      const minValue = info['min'];
      const step = info['step'] || 1;
      elem.setAttribute('type', 'range');
      elem.setAttribute('min', minValue);
      elem.setAttribute('max', maxValue);
      elem.setAttribute('step', step);
      const edit = document.createElement('input');
      edit.setAttribute('type', 'text');
      edit.classList.add('rangeedit');
      edit.value = initValue;
      elem.value = initValue;
      edit.addEventListener('change', () => {
        const evalue = +edit.value;
        if (Number.isFinite(evalue)) {
          setValue(evalue);
          elem.value = evalue;
          edit.classList.remove('invalid');
        } else {
          edit.classList.add('invalid');
        }
      });
      elem.addEventListener('input', () => {
        const evalue = +edit.value;
        const rvalue = +elem.value;
        if (evalue !== rvalue) {
          setValue(rvalue);
          edit.value = rvalue;
        }
      });
      div.appendChild(edit);
    } else {
      throw new Error(
        `unsupported type ${type} for ${fullName} (${shaderName})`,
      );
    }
    const topbar = document.querySelector(this.topbarId);
    topbar.appendChild(div);
  }

  addViewportControl(prettyName, info) {
    this.addGenericControl(
      'maxY',
      prettyName,
      'range',
      this.maxY,
      (value) => {
        this.maxY = value;
        this.setupScene();
      },
      info,
    );
  }

  addControl(name, prettyName, info) {
    const curValue = this.getValues()[name];
    const type = this.getValueType(name);
    const fullName = `value_${name}`;
    this.addGenericControl(
      fullName,
      prettyName,
      type,
      curValue,
      (value) => this.updateValue({ [name]: value }),
      info,
    );
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
    const shaderProgram = await this.initShaderProgram(
      this.vertexShader,
      this.fragmentShader,
    );
    if (shaderProgram === null) {
      return;
    }

    this.measures = this.computeMeasures();
    const measures = this.getMeasures();
    this.buffers = {
      ...this.buffers,
      position: initPositionBuffer(gl, measures),
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
    uniformLocations.screenSize = gl.getUniformLocation(
      shaderProgram,
      'uScreenSize',
    );

    this.valueDefs.forEach(({ name, shaderName, type }) => {
      if (type === 'array2d') {
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
      } else if (type === 'image') {
        uniformLocations[`${name}Tex`] = gl.getUniformLocation(
          shaderProgram,
          `${shaderName}Tex`,
        );
        uniformLocations[`${name}Size`] = gl.getUniformLocation(
          shaderProgram,
          `${shaderName}Size`,
        );
      } else {
        uniformLocations[name] = gl.getUniformLocation(
          shaderProgram,
          shaderName,
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

  prerender(values) {
    return values;
  }

  drawScene() {
    const gl = this.getGL();
    const measures = this.getMeasures();
    const values = this.prerender({ ...this.getValues() });
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
    const pul = programInfo.uniformLocations;
    gl.uniformMatrix4fv(pul.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(pul.modelViewMatrix, false, modelViewMatrix);
    gl.uniform2fv(pul.screenSize, [measures.sizeX, measures.sizeY]);
    gl.uniform2fv(pul.unit, [measures.unitX, measures.unitY]);

    let texIx = 0;
    valueDefs.forEach(({ name, type }) => {
      if (type === '2d') {
        gl.uniform2fv(pul[name], values[name]);
      } else if (['float', 'range'].includes(type)) {
        gl.uniform1f(pul[name], values[name]);
      } else if (['int', 'bool', 'enum'].includes(type)) {
        gl.uniform1i(pul[name], values[name]);
      } else if (type === 'array2d') {
        loadAsTex(
          gl,
          texIx,
          pul[`${name}Tex`],
          pul[`${name}Size`],
          pul[`${name}Count`],
          values[name],
        );
        texIx += 1;
      } else if (type === 'image') {
        loadTexFile(
          gl,
          texIx,
          pul[`${name}Tex`],
          pul[`${name}Size`],
          values[name],
        );
        texIx += 1;
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

  addCapture(text) {
    const btn = document.createElement('input');
    btn.setAttribute('type', 'button');
    btn.value = text;
    btn.addEventListener('click', () => {
      const canvas = this.getCanvas();
      this.doDraw();
      const imageURL = canvas.toDataURL('image/png');
      download(imageURL, 'screen.png');
    });
    const bottombar = document.querySelector(this.bottombarId);
    bottombar.appendChild(btn);
  }

  addVideoCapture(startText, stopText, stopKey) {
    const btn = document.createElement('input');
    btn.setAttribute('type', 'button');
    btn.value = startText;
    const canvasDiv = document.querySelector(this.canvasId);
    const videoOverlay = document.createElement('div');
    videoOverlay.style.width = `${this.width}px`;
    videoOverlay.style.height = `${this.height}px`;
    videoOverlay.style.fontSize = `${this.height * 0.6}px`;
    videoOverlay.classList.add('videocounter');
    canvasDiv.appendChild(videoOverlay);
    this.recordingState = NO_RECORDING;
    const that = this;

    function countDown(num, cb) {
      that.recordingState = COUNT_DOWN;
      if (num <= 0) {
        videoOverlay.textContent = '';
        cb();
        return;
      }
      videoOverlay.textContent = `${num}`;
      setTimeout(() => {
        countDown(num - 1, cb);
      }, 1000);
    }

    let videoStream = null;
    let mediaRecorder = null;
    let chunks = [];

    function startRecording() {
      btn.value = `${stopText} (${stopKey})`;
      that.recordingState = IS_RECORDING;

      const canvas = that.getCanvas();
      videoStream = canvas.captureStream(60);
      mediaRecorder = new MediaRecorder(videoStream);

      chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };
      mediaRecorder.onstop = (e) => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        chunks = [];
        const videoURL = URL.createObjectURL(blob);
        download(videoURL, 'video.webm');
      };

      mediaRecorder.start();
    }

    function stopRecording() {
      btn.value = startText;
      that.recordingState = NO_RECORDING;

      if (!mediaRecorder) {
        return;
      }
      mediaRecorder.stop();
      videoStream = null;
      mediaRecorder = null;
      chunks = [];
    }

    window.addEventListener('keydown', (e) => {
      if (this.recordingState !== IS_RECORDING) {
        return;
      }
      if (e.key.toLowerCase() !== stopKey) {
        return;
      }
      e.preventDefault();
      stopRecording();
    });
    btn.addEventListener('click', () => {
      if (this.recordingState === IS_RECORDING) {
        stopRecording();
      } else if (this.recordingState === NO_RECORDING) {
        countDown(3, startRecording);
      }
    });
    const bottombar = document.querySelector(this.bottombarId);
    bottombar.appendChild(btn);
  }

  isRecording() {
    return this.recordingState === IS_RECORDING;
  }

  writeError(msg) {
    writeMessage(this.errorId, msg);
  }
} // PixelCanvas
