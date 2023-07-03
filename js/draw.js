function loadAsTex(gl, locationTexture, locationSize, locationCount, values) {
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
  gl.bindTexture(gl.TEXTURE_2D, texture);
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
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.uniform1i(locationTexture, texture);
  gl.uniform1i(locationSize, size);
  gl.uniform1i(locationCount, count);
}

function drawScene(gl, measures, programInfo, buffers, values) {
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
  gl.uniform2fv(programInfo.uniformLocations.refPosition, values.refPosition);
  gl.uniform1i(programInfo.uniformLocations.fixedRef, values.fixedRef);
  gl.uniform1i(programInfo.uniformLocations.distanceFn, values.distanceFn);
  loadAsTex(
    gl,
    programInfo.uniformLocations.pointsTex,
    programInfo.uniformLocations.pointsSize,
    programInfo.uniformLocations.pointsCount,
    values.points,
  );

  {
    const offset = 0;
    const vertexCount = 4;
    gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
  }
}

function setPositionAttribute(gl, buffers, programInfo) {
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

export { drawScene };
