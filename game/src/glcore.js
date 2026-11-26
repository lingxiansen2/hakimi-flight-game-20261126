// WebGL2 program compilation, static/dynamic VAO builders, and heightmap texture helpers.

export function createShaderProgram(gl, vertSrc, fragSrc) {
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const msg = gl.getShaderInfoLog(sh) || 'Shader compile error';
      gl.deleteShader(sh);
      throw new Error(msg);
    }
    return sh;
  };

  const vs = compile(gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) || 'Program link error');
  }

  const uniforms = {};
  const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i += 1) {
    const info = gl.getActiveUniform(prog, i);
    if (info) uniforms[info.name] = gl.getUniformLocation(prog, info.name);
  }
  return { program: prog, uniforms };
}

/** Build a mesh VAO with layout: pos(3), normal(3), color(4), material(3) = 13 floats/vertex. */
export function createColoredMesh(gl, data, dynamic = false) {
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);

  const stride = 13 * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 6 * 4);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 10 * 4);

  gl.bindVertexArray(null);
  return {
    vao,
    vbo,
    vertexCount: Math.floor(data.length / 13),
    update(newData) {
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, newData, gl.DYNAMIC_DRAW);
      this.vertexCount = Math.floor(newData.length / 13);
    },
  };
}

/** Build an indexed or non-indexed position+normal VAO (6 floats/vertex). */
export function createTerrainMesh(gl, verts, indices) {
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  const ebo = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  const stride = 6 * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);

  gl.bindVertexArray(null);
  return { vao, indexCount: indices.length };
}

/** Pack world terrain elevation into an RGBA8 texture for ocean shoreline depth/foam sampling. */
export function createHeightMapTexture(gl, size, worldHalfExtent, heightFn) {
  const pixels = new Uint8Array(size * size * 4);
  for (let iz = 0; iz < size; iz += 1) {
    const wz = ((iz + 0.5) / size - 0.5) * worldHalfExtent * 2;
    for (let ix = 0; ix < size; ix += 1) {
      const wx = ((ix + 0.5) / size - 0.5) * worldHalfExtent * 2;
      const h = heightFn(wx, wz);
      const norm = Math.max(0, Math.min(255, Math.round(((h + 40) / 620) * 255)));
      const idx = (iz * size + ix) * 4;
      pixels[idx] = norm;
      pixels[idx + 1] = h > 0 ? 255 : 0;
      pixels[idx + 2] = 0;
      pixels[idx + 3] = 255;
    }
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
