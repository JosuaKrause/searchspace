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

/**
 * @typedef {{
 *   width: number,
 *   height: number,
 *   maxX: number,
 *   maxY: number,
 *   unitX: number,
 *   unitY: number,
 *   sizeX: number,
 *   sizeY: number,
 *   blockX: number,
 *   blockY: number,
 * }} MeasuresObj
 */
/**
 * @typedef {{
 *   position?: WebGLBuffer,
 * }} Buffers
 */
/**
 * @typedef {{
 *   program: WebGLProgram | null,
 *   attribLocations: {
 *     vertexPosition?: GLint,
 *   },
 *   uniformLocations: {
 *     projectionMatrix?: WebGLUniformLocation,
 *     modelViewMatrix?: WebGLUniformLocation,
 *     [key: string]: WebGLUniformLocation,
 *   },
 * }} InfoObj
 */

export function initPositionBuffer(
  /** @type {WebGL2RenderingContext} */ gl,
  /** @type {MeasuresObj} */ measures,
) {
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const positions = [
    measures.sizeX,
    measures.sizeY,
    -measures.sizeX,
    measures.sizeY,
    measures.sizeX,
    -measures.sizeY,
    -measures.sizeX,
    -measures.sizeY,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  return positionBuffer;
}

export function setPositionAttribute(
  /** @type {WebGL2RenderingContext} */ gl,
  /** @type {Buffers} */ buffers,
  /** @type {InfoObj} */ programInfo,
) {
  const numComponents = 2;
  const type = gl.FLOAT;
  const normalize = false;
  const stride = 0;
  const offset = 0;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexPosition,
    numComponents,
    type,
    normalize,
    stride,
    offset,
  );
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
}

export function writeMessage(
  /** @type {string} */ parentId,
  /** @type {string | Error} */ msg,
) {
  const elem = document.querySelector(parentId);
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

export async function loadImage(/** @type {string} */ url) {
  return new Promise(
    (
      /** @type {(image: HTMLImageElement) => void} */ resolve,
      /** @type {(e: string | Event) => void} */ reject,
    ) => {
      const image = new Image();
      image.onload = () => {
        resolve(image);
      };
      image.onerror = (e) => {
        reject(e);
      };
      image.src = url;
    },
  );
}

export function loadTexFile(
  /** @type {WebGL2RenderingContext} */ gl,
  /** @type {number} */ ix,
  /** @type {WebGLUniformLocation} */ locationTexture,
  /** @type {WebGLUniformLocation} */ locationSize,
  /** @type {HTMLImageElement} */ image,
) {
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + ix);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.uniform1i(locationTexture, ix);
  gl.uniform2fv(locationSize, [+image.width, +image.height]);
}

export function loadAsTex(
  /** @type {WebGL2RenderingContext} */ gl,
  /** @type {number} */ ix,
  /** @type {WebGLUniformLocation} */ locationTexture,
  /** @type {WebGLUniformLocation} */ locationSize,
  /** @type {WebGLUniformLocation} */ locationCount,
  /** @type {number[][]} */ values,
) {
  const count = values.length;
  const size = Math.ceil(Math.sqrt(count));
  const pixs = 4;
  const data = new Float32Array(size * size * pixs);
  let pos = 0;

  function writeData(/** @type {number} */ v) {
    data[pos] = +v;
    pos += 1;
  }

  values.forEach((v) => {
    writeData(v[0]);
    writeData(v[1]);
    writeData(1.0);
    writeData(1.0);
  });
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + ix);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA32F,
    size,
    size,
    0,
    gl.RGBA,
    gl.FLOAT,
    data,
  );
  gl.uniform1i(locationTexture, ix);
  gl.uniform1i(locationSize, size);
  gl.uniform1i(locationCount, count);
}

export async function loadText(/** @type {string} */ path) {
  return (await fetch(path)).text();
}

export function convertMousePosition(
  /** @type {HTMLCanvasElement} */ canvas,
  /** @type {MeasuresObj} */ measures,
  /** @type {boolean} */ snap,
  /** @type {{clientX: number, clientY: number}} */ e,
) {
  const rect = canvas.getBoundingClientRect();
  const pixelX = ((e.clientX - rect.left) / rect.width) * measures.width;
  const pixelY = ((e.clientY - rect.top) / rect.height) * measures.height;
  const halfW = measures.width * 0.5;
  const halfH = measures.height * 0.5;
  const orthoX = ((pixelX - halfW) / halfW) * measures.maxX;
  const orthoY = (-(pixelY - halfH) / halfH) * measures.maxY;
  if (snap) {
    const snapGrid = 0.1;
    return [
      Math.round(orthoX / snapGrid) * snapGrid,
      Math.round(orthoY / snapGrid) * snapGrid,
    ];
  }
  return [orthoX, orthoY];
}

export function convertTouchPosition(
  /** @type {HTMLCanvasElement} */ canvas,
  /** @type {MeasuresObj} */ measures,
  /** @type {boolean} */ snap,
  /** @type {TouchEvent} */ e,
) {
  const totalWeigth = [...e.touches].reduce((p, t) => p + t.force, 0);
  const hasWeigth = totalWeigth > 0;
  const [x, y] = [...e.touches].reduce(
    (p, t) => {
      const weight = hasWeigth ? t.force : 1;
      return [p[0] + t.clientX * weight, p[1] + t.clientY * weight];
    },
    [0, 0],
  );
  return convertMousePosition(canvas, measures, snap, {
    clientX: hasWeigth ? x / totalWeigth : x,
    clientY: hasWeigth ? y / totalWeigth : y,
  });
}

export function download(
  /** @type {string} */ saveURL,
  /** @type {string} */ name,
) {
  const link = document.createElement('a');
  link.download = name;
  link.href = saveURL;
  // document.body.appendChild(link);
  link.click();
  // document.body.removeChild(link);
}

export function precision(
  /** @type {number} */ val,
  /** @type {number} */ digits,
) {
  return `${val >= 0 ? '\xA0' : ''}${val.toFixed(digits)}`;
}
