function initBuffers(gl, measures) {
  const positionBuffer = initPositionBuffer(gl, measures);
  return {
    position: positionBuffer,
  };
}

function initPositionBuffer(gl, measures) {
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const positions = [
     measures.sizeX,  measures.sizeY,
    -measures.sizeX,  measures.sizeY,
     measures.sizeX, -measures.sizeY,
    -measures.sizeX, -measures.sizeY,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  return positionBuffer;
}

export { initBuffers };
