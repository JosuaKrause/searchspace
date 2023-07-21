export function initPositionBuffer(gl, measures) {
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

export function setPositionAttribute(gl, buffers, programInfo) {
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

export function writeMessage(parentId, msg) {
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

export async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = (e) => {
      reject(e);
    };
    image.src = url;
  });
}

export function loadTexFile(gl, ix, locationTexture, locationSize, image) {
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
  gl,
  ix,
  locationTexture,
  locationSize,
  locationCount,
  values,
) {
  const count = values.length;
  const size = Math.ceil(Math.sqrt(count));
  const pixs = 4;
  const data = new Float32Array(size * size * pixs);
  let pos = 0;

  function writeData(v) {
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

export async function loadText(path) {
  return (await fetch(path)).text();
}

export function convertMousePosition(canvas, measures, e) {
  const rect = canvas.getBoundingClientRect();
  const pixelX = ((e.clientX - rect.left) / rect.width) * measures.width;
  const pixelY = ((e.clientY - rect.top) / rect.height) * measures.height;
  const halfW = measures.width * 0.5;
  const halfH = measures.height * 0.5;
  const orthoX = ((pixelX - halfW) / halfW) * measures.maxX;
  const orthoY = (-(pixelY - halfH) / halfH) * measures.maxY;
  return [orthoX, orthoY];
}

export function convertTouchPosition(canvas, measures, e) {
  const [x, y, w] = [...e.touches].reduce(
    (p, t) => {
      const weight = t.force;
      return [
        p[0] + t.clientX * weight,
        p[1] + t.clientY * weight,
        p[2] + weight,
      ];
    },
    [0, 0, 0],
  );
  return convertMousePosition(canvas, measures, {
    clientX: x / w,
    clientY: y / w,
  });
}

export function download(saveURL, name) {
  const link = document.createElement('a');
  link.download = name;
  link.href = saveURL;
  // document.body.appendChild(link);
  link.click();
  // document.body.removeChild(link);
}

export function precision(val, digits) {
  return `${val >= 0 ? '\xA0' : ''}${val.toFixed(digits)}`;
}
