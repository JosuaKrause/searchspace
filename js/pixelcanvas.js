/*
 * Searchspace – An interactive visualization for various similarity measures.
 * Copyright (C) 2024 Josua Krause
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
// @ts-check

import {
  download,
  initPositionBuffer,
  loadAsTex,
  loadTexFile,
  loadText,
  setPositionAttribute,
  writeMessage,
} from './misc.js';

/** @typedef {number[]} Matrix4 */
/**
 * @typedef Mat4
 * @prop {() => Matrix4} create
 * @prop {(out: Matrix4, left: number, right: number, bottom: number, top: number, near: number, far: number) => Matrix4} ortho
 * @prop {(out: Matrix4, a: Matrix4, v: number[]) => Matrix4} translate
 */

/** @type {Mat4} */
var mat4; /* eslint no-var: off */

/** @typedef {import("./misc").MeasuresObj} MeasuresObj */
/** @typedef {import("./misc").Buffers} Buffers */
/** @typedef {import("./misc").InfoObj} InfoObj */
/**
 * @typedef {{
 *   monitorValue?: string,
 *   max?: number,
 *   min?: number,
 *   step?: number,
 *   options?: ({ text: string, value: number })[],
 * }} ValueInfo
 */
/** @typedef {'bool' | '2d' | 'enum' | 'range' | 'array2d' | 'float' | 'image'} ValueType */
/** @typedef {'enum' | 'bool' | 'range'} ControlType */
/** @typedef {boolean | number | number[] | number[][] | HTMLImageElement} ValueContent */
/** @typedef {{ name: string, shaderName: string, type: ValueType }} ValueDefObj */
/** @typedef {{ [key: string]: ValueContent }} ValuesObj */
/** @typedef {'no_recording' | 'count_down' | 'is_recording'} RecordingState */

/** @type {RecordingState} */
const NO_RECORDING = 'no_recording';
/** @type {RecordingState} */
const COUNT_DOWN = 'count_down';
/** @type {RecordingState} */
const IS_RECORDING = 'is_recording';

export default class PixelCanvas {
  constructor(
    /** @type {string} */ canvasId,
    /** @type {string} */ topbarId,
    /** @type {string} */ bottombarId,
    /** @type {string} */ errorId,
    /** @type {string} */ vertexShader,
    /** @type {string} */ fragmentShader,
    /** @type {number} */ width,
    /** @type {number} */ height,
    /** @type {number} */ initMaxY,
  ) {
    /** @type {number} */
    this.maxY = initMaxY;
    /** @type {number} */
    this.width = width;
    /** @type {number} */
    this.height = height;
    /** @type {string} */
    this.vertexShader = vertexShader;
    /** @type {string} */
    this.fragmentShader = fragmentShader;
    /** @type {string} */
    this.canvasId = canvasId;
    /** @type {string} */
    this.topbarId = topbarId;
    /** @type {string} */
    this.bottombarId = bottombarId;
    /** @type {string} */
    this.errorId = errorId;
    /** @type {HTMLCanvasElement | null} */
    this.canvas = null;
    /** @type {WebGL2RenderingContext | null} */
    this.gl = null;
    /** @type {MeasuresObj | null} */
    this.measures = null;
    /** @type {Buffers} */
    this.buffers = {};
    /** @type {InfoObj} */
    this.programInfo = {
      program: null,
      attribLocations: {},
      uniformLocations: {},
    };
    /** @type {ValuesObj} */
    this.values = {};
    /** @type {ValueDefObj[]} */
    this.valueDefs = [];
    /** @type { ((values: ValuesObj) => ValuesObj)[] } */
    this.prerender = [];
    /** @type { ((values: ValuesObj) => void)[] } */
    this.postrender = [];
    /** @type {RecordingState} */
    this.recordingState = NO_RECORDING;
    /** @type {boolean} */
    this.isSetupBeforeCanvas = false;
    /** @type {boolean} */
    this.isSetupAfterCanvas = false;
    /** @type {boolean} */
    this.isDrawing = false;
    /** @type {boolean} */
    this.hidden = false;
    /** @type {boolean} */
    this.requestClear = false;
    /** @type {boolean} */
    this.requestFullRepaint = false;
    /** @type {boolean} */
    this.requestRepaint = false;

    window.addEventListener('error', (e) => {
      try {
        if (e.error && e.error.stack) {
          this.writeError(`${e.error.stack}`);
        } else if (e.message) {
          this.writeError(
            `${e.message} (${e.filename}:${e.lineno}:${e.colno})`,
          );
        } else {
          this.writeError(`Uncaught Error: ${e.error}`);
        }
      } catch (_) {
        // can't write -- let normal error reporting handle it
      }
      return false;
    });
  }

  async setupBeforeCanvas() {
    // overwrite in sub-class and call `await super.setupBeforeCanvas()` at the end
    this.isSetupBeforeCanvas = true;
  }

  async setupAfterCanvas() {
    // overwrite in sub-class and call `await super.setupAfterCanvas()` at the end
    this.isSetupAfterCanvas = true;
  }

  isHidden() {
    return this.hidden;
  }

  setHidden(/** @type {boolean} */ hidden) {
    if (this.hidden === hidden) {
      return;
    }
    this.hidden = hidden;
    if (hidden) {
      this.clear();
    } else {
      this.repaint();
    }
  }

  clear() {
    if (this.isDrawing) {
      if (!this.requestClear) {
        requestAnimationFrame(() => {
          this.requestClear = false;
          this.clear();
        });
        this.requestClear = true;
      }
      return;
    }
    this.gl = null;
    this.buffers = {};
    this.programInfo = {
      program: null,
      attribLocations: {},
      uniformLocations: {},
    };
  }

  fullRepaint(/** @type {(() => void)?} */ cb) {
    if (this.isDrawing) {
      if (!this.requestFullRepaint) {
        requestAnimationFrame(() => {
          this.requestFullRepaint = false;
          this.fullRepaint(cb);
        });
        this.requestFullRepaint = true;
      }
      return;
    }
    this.gl = null;
    this.repaint(cb);
  }

  repaint(/** @type {(() => void)?} */ cb) {
    if (this.isHidden()) {
      return;
    }
    if (this.isDrawing) {
      if (!this.requestRepaint || cb) {
        requestAnimationFrame(() => {
          this.requestRepaint = false;
          this.repaint(cb);
        });
        this.requestRepaint = true;
      }
      return;
    }

    const draw = () => {
      this.drawScene();
      if (cb) {
        cb();
      }
    };

    const run = async () => {
      if (!this.isSetupBeforeCanvas) {
        await this.setupBeforeCanvas();
        if (!this.isSetupBeforeCanvas) {
          throw new Error(
            'must call `await super.setupBeforeCanvas()` at end of setup!',
          );
        }
      }
      if (this.canvas === null) {
        const canvasDiv = document.querySelector(this.canvasId);
        if (canvasDiv === null) {
          this.writeError(
            `Unable to find canvas container '${this.canvasId}'.`,
          );
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.setAttribute('width', `${this.width}`);
        canvas.setAttribute('height', `${this.height}`);
        canvas.style.width = `${this.width}px`;
        canvas.style.height = `${this.height}px`;
        canvasDiv.appendChild(canvas);
        this.canvas = canvas;
      }
      const needsSceneSetup = this.gl === null;
      if (needsSceneSetup) {
        await this.initScene();
      }
      if (!this.isSetupAfterCanvas) {
        await this.setupAfterCanvas();
        if (!this.isSetupAfterCanvas) {
          throw new Error(
            'must call `await super.setupAfterCanvas()` at end of setup!',
          );
        }
      }
      if (needsSceneSetup) {
        await this.setupScene();
      }
      draw();
    };

    this.isDrawing = true;
    const finish = () => {
      this.isDrawing = false;
    };
    const finishErr = (/** @type {Error} */ err) => {
      finish();
      console.error(err);
      this.writeError(err);
    };
    if (
      this.canvas !== null &&
      this.gl !== null &&
      this.isSetupBeforeCanvas &&
      this.isSetupAfterCanvas
    ) {
      // fast path
      try {
        draw();
        finish();
      } catch (err) {
        finishErr(err);
      }
    } else {
      // slow path
      run().then(finish).catch(finishErr);
    }
  }

  repaintWhenReady() {
    const doRepaint = () => {
      this.repaint();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doRepaint);
    } else {
      doRepaint();
    }
  }

  getValues() {
    return this.values;
  }

  computeMeasures() {
    const gl = this.getGL();
    const canvas = /** @type {HTMLCanvasElement} */ (gl.canvas);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
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
    if (!this.isDrawing) {
      this.writeError(
        'obtaining gl context while not drawing. this might be a bug!',
      );
    }
    if (!this.gl) {
      throw new Error('gl is not initialized');
    }
    return this.gl;
  }

  addValue(
    /** @type {string} */ name,
    /** @type {string} */ shaderName,
    /** @type {ValueType} */ type,
    /** @type {ValueContent} */ initialValue,
  ) {
    this.valueDefs.push({ name, shaderName, type });
    this.values[name] = initialValue;
  }

  getValueType(/** @type {string} */ name) {
    const vtype = this.valueDefs.reduce(
      (
        /** @type {ValueType | null} */ res,
        /** @type {ValueDefObj} */ { name: cur, type },
      ) => (cur === name ? type : res),
      null,
    );
    if (vtype === null) {
      throw new Error(`${name} not found!`);
    }
    return vtype;
  }

  addGenericControl(
    /** @type {string} */ fullName,
    /** @type {string} */ prettyName,
    /** @type {ControlType} */ type,
    /** @type {ValueContent} */ initValue,
    /** @type {(value: ValueContent) => void} */ setValue,
    /** @type {ValueInfo} */ info,
  ) {
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
        `unsupported type ${type} for ${fullName} (${prettyName})`,
      );
    }
    const gElem = /** @type {HTMLInputElement | HTMLSelectElement} */ (
      document.createElement(elemType)
    );
    gElem.classList.add(type);
    gElem.setAttribute('id', fullName);
    gElem.setAttribute('name', fullName);
    const div = document.createElement('div');
    div.appendChild(label);
    if (type === 'enum') {
      const elem = /** @type {HTMLSelectElement} */ (gElem);
      info.options.forEach(({ value, text }) => {
        const option = document.createElement('option');
        option.setAttribute('value', `${value}`);
        option.textContent = text;
        elem.appendChild(option);
      });
      elem.value = `${initValue}`;
      elem.addEventListener('change', () => {
        const newValue = +elem.value;
        setValue(newValue);
      });
      if (info.monitorValue) {
        this.addPostrenderHook((values) => {
          elem.value = `${values[info.monitorValue]}`;
        });
      }
    } else if (type === 'bool') {
      const elem = /** @type {HTMLInputElement} */ (gElem);
      elem.setAttribute('type', 'checkbox');
      elem.checked = /** @type {boolean} */ (initValue);
      elem.addEventListener('change', () => {
        setValue(elem.checked);
      });
      if (info.monitorValue) {
        this.addPostrenderHook((values) => {
          elem.checked = /** @type {boolean} */ (values[info.monitorValue]);
        });
      }
    } else if (type === 'range') {
      const elem = /** @type {HTMLInputElement} */ (gElem);
      const maxValue = info['max'];
      const minValue = info['min'];
      const step = info['step'] || 1;
      elem.setAttribute('type', 'range');
      elem.setAttribute('min', `${minValue}`);
      elem.setAttribute('max', `${maxValue}`);
      elem.setAttribute('step', `${step}`);
      const edit = document.createElement('input');
      edit.setAttribute('id', `${fullName}-edit`);
      edit.setAttribute('name', `${fullName}-edit`);
      edit.setAttribute('type', 'text');
      edit.classList.add('rangeedit');
      edit.value = `${initValue}`;
      elem.value = `${initValue}`;
      edit.addEventListener('change', () => {
        const evalue = +edit.value;
        if (Number.isFinite(evalue)) {
          setValue(evalue);
          elem.value = `${evalue}`;
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
          edit.value = `${rvalue}`;
          edit.classList.remove('invalid');
        }
      });
      div.appendChild(edit);
      if (info.monitorValue) {
        this.addPostrenderHook((values) => {
          edit.value = `${values[info.monitorValue]}`;
          elem.value = `${values[info.monitorValue]}`;
        });
      }
    } else {
      throw new Error(
        `unsupported type ${type} for ${fullName} (${prettyName})`,
      );
    }
    div.appendChild(gElem);
    const topbar = document.querySelector(this.topbarId);
    if (!topbar) {
      throw new Error(`Could not find ${this.topbarId}`);
    }
    topbar.appendChild(div);
  }

  addTopDivider() {
    const div = document.createElement('div');
    div.classList.add('divider');
    const topbar = document.querySelector(this.topbarId);
    if (!topbar) {
      throw new Error(`Could not find ${this.topbarId}`);
    }
    topbar.appendChild(div);
  }

  addViewportControl(
    /** @type {string} */ prettyName,
    /** @type {ValueInfo} */ info,
  ) {
    this.addGenericControl(
      'maxY',
      prettyName,
      'range',
      this.maxY,
      (value) => {
        this.maxY = /** @type {number} */ (value);
        this.fullRepaint();
      },
      info,
    );
  }

  addControl(
    /** @type {string} */ name,
    /** @type {string} */ prettyName,
    /** @type {ValueInfo} */ info,
  ) {
    const curValue = this.getValues()[name];
    const type = this.getValueType(name);
    const fullName = `value_${name}`;
    this.addGenericControl(
      fullName,
      prettyName,
      /** @type {ControlType} */ (type),
      curValue,
      (value) => this.updateValue({ [name]: value }),
      info,
    );
  }

  async loadShader(
    /** @type {typeof gl.VERTEX_SHADER | typeof gl.FRAGMENT_SHADER} */ type,
    /** @type {string} */ path,
  ) {
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

  async initShaderProgram(
    /** @type {string} */ pathVert,
    /** @type {string} */ pathFrag,
  ) {
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

  async initScene() {
    const canvas = this.getCanvas();
    const gl = canvas.getContext('webgl2');
    if (gl === null) {
      this.writeError(
        'Unable to initialize WebGL 2. It might be not supported.',
      );
      return;
    }
    this.gl = gl;
    const shaderProgram = await this.initShaderProgram(
      this.vertexShader,
      this.fragmentShader,
    );
    if (shaderProgram === null) {
      return;
    }
    this.programInfo.program = shaderProgram;
    this.measures = this.computeMeasures();
  }

  async setupScene() {
    const gl = this.getGL();
    const measures = this.getMeasures();
    this.buffers = {
      ...this.buffers,
      position: initPositionBuffer(gl, measures),
    };

    const {
      program: shaderProgram,
      attribLocations,
      uniformLocations,
    } = this.programInfo;

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
  }

  updateValue(/** @type {{ [key: string]: ValueContent }} */ obj) {
    const values = this.getValues();
    Object.keys(obj).forEach((key) => {
      if (values[key] === undefined) {
        this.writeError(`unknown value key: ${key}`);
      }
      values[key] = obj[key];
    });
    this.repaint();
  }

  addPrerenderHook(/** @type {(values: ValuesObj) => ValuesObj} */ cb) {
    this.prerender.push(cb);
  }

  addPostrenderHook(/** @type {(values: ValuesObj) => void} */ cb) {
    this.postrender.push(cb);
  }

  getRenderValues() {
    return this.prerender.reduce((vals, cb) => cb(vals), {
      ...this.getValues(),
    });
  }

  drawScene() {
    const gl = this.getGL();
    const measures = this.getMeasures();
    const values = this.getRenderValues();
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
        gl.uniform2fv(pul[name], /** @type {number[]} */ (values[name]));
      } else if (['float', 'range'].includes(type)) {
        gl.uniform1f(pul[name], /** @type {number} */ (values[name]));
      } else if (['int', 'bool', 'enum'].includes(type)) {
        gl.uniform1i(pul[name], /** @type {number} */ (values[name]));
      } else if (type === 'array2d') {
        loadAsTex(
          gl,
          texIx,
          pul[`${name}Tex`],
          pul[`${name}Size`],
          pul[`${name}Count`],
          /** @type {number[][]} */ (values[name]),
        );
        texIx += 1;
      } else if (type === 'image') {
        loadTexFile(
          gl,
          texIx,
          pul[`${name}Tex`],
          pul[`${name}Size`],
          /** @type {HTMLImageElement} */ (values[name]),
        );
        texIx += 1;
      } else {
        this.writeError(`unsupported type ${type} for ${name}`);
      }
    });

    {
      const offset = 0;
      const vertexCount = 4;
      gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
    }

    this.postrender.forEach((cb) => cb(values));
  }

  addStatus(/** @type {(values: ValuesObj) => string} */ cb) {
    const status = document.createElement('div');
    status.classList.add('refstatus');
    this.addPostrenderHook((values) => {
      status.textContent = cb(values);
      return values;
    });
    const bottombar = document.querySelector(this.bottombarId);
    bottombar.appendChild(status);
  }

  addButton(
    /** @type {string} */ text,
    /** @type {string} */ key,
    /** @type {() => void} */ cb,
  ) {
    const btn = document.createElement('input');
    btn.setAttribute('type', 'button');
    btn.value = key ? `${text} (${key})` : text;
    this.addClickEventListener(btn, key, cb);
    const bottombar = document.querySelector(this.bottombarId);
    bottombar.appendChild(btn);
    return btn;
  }

  addCapture(/** @type {string} */ text, /** @type {string} */ key) {
    this.addButton(text, key, () => {
      this.repaint(() => {
        const canvas = this.getCanvas();
        const imageURL = canvas.toDataURL('image/png');
        download(imageURL, 'screen.png');
      });
    });
  }

  addVideoCapture(
    /** @type {string} */ startText,
    /** @type {string} */ stopText,
    /** @type {string} */ startKey,
    /** @type {string} */ stopKey,
  ) {
    const btn = document.createElement('input');
    btn.setAttribute('type', 'button');
    const btnTextInit = `${startText} (${startKey})`;
    btn.value = btnTextInit;
    const canvasDiv = document.querySelector(this.canvasId);
    const videoOverlay = document.createElement('div');
    videoOverlay.style.width = `${this.width}px`;
    videoOverlay.style.height = `${this.height}px`;
    videoOverlay.style.fontSize = `${this.height * 0.6}px`;
    videoOverlay.classList.add('videocounter');
    canvasDiv.appendChild(videoOverlay);
    this.recordingState = NO_RECORDING;
    const that = this;

    function countDown(
      /** @type {number} */ num,
      /** @type {() => void} */ cb,
    ) {
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

    /** @type {MediaStream | null} */
    let videoStream = null;
    /** @type {MediaRecorder | null} */
    let mediaRecorder = null;
    /** @type {BlobPart[]} */
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
      that.repaint();
    }

    function stopRecording() {
      btn.value = btnTextInit;
      that.recordingState = NO_RECORDING;

      if (!mediaRecorder) {
        return;
      }
      that.repaint(() => {
        mediaRecorder.stop();
        videoStream = null;
        mediaRecorder = null;
        chunks = [];
      });
    }

    this.addKeyEventListener(startKey, () => {
      if (this.recordingState === NO_RECORDING) {
        countDown(3, startRecording);
      }
    });
    this.addKeyEventListener(stopKey, () => {
      if (this.recordingState === IS_RECORDING) {
        stopRecording();
      }
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

  addClickEventListener(
    /** @type {HTMLInputElement} */ btn,
    /** @type {string} */ key,
    /** @type {() => void} */ cb,
  ) {
    btn.addEventListener('click', () => {
      cb();
    });
    this.addKeyEventListener(key, cb);
  }

  isTextTarget(/** @type {HTMLElement} */ target) {
    if (!target) {
      return false;
    }
    if (target.localName !== 'input') {
      return false;
    }
    if (target.getAttribute('type') !== 'text') {
      return false;
    }
    return true;
  }

  addKeyEventListener(
    /** @type {string} */ key,
    /** @type {() => void} */ cb,
  ) {
    if (!key) {
      return;
    }
    const lowerKey = key.toLowerCase();
    window.addEventListener('keydown', (e) => {
      if (e.defaultPrevented) {
        return;
      }
      const target = /** @type {HTMLElement | null} */ (e.target);
      if (this.isTextTarget(target)) {
        return;
      }
      if (e.key.toLowerCase() === lowerKey) {
        cb();
        if (target && target.blur) {
          target.blur();
        }
        e.preventDefault();
      }
    });
  }

  addVisibilityCheck() {
    document.addEventListener('visibilitychange', () => {
      this.setHidden(document.hidden);
    });
  }

  writeError(/** @type {string | Error} */ msg) {
    writeMessage(this.errorId, msg);
  }
} // PixelCanvas
