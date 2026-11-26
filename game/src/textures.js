// Offline procedural CanvasTexture generator for WebGL2 PBR terrain, tarmac, metal, and soft cloud sprites.

function seededNoise(x, y, seed = 1) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

function makeWebGLTexture(gl, canvas, repeat = true) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  return tex;
}

/** Bake tileable 256x256 terrain micro-detail (grass speckles, rock fissures, sand grain). */
function buildTerrainDetailCanvas() {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const fine = seededNoise(x, y, 3);
      const med = seededNoise(Math.floor(x / 4), Math.floor(y / 4), 11);
      const crack = Math.abs(Math.sin((x + med * 12) * 0.098) * Math.cos((y + fine * 8) * 0.098));
      const idx = (y * size + x) * 4;
      d[idx] = Math.round(110 + fine * 70 + med * 55);      // R: organic micro variation
      d[idx + 1] = Math.round(90 + crack * 145);             // G: rock fissure / foliage cluster
      d[idx + 2] = Math.round(105 + med * 90 + fine * 45);   // B: sand / ash grain
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** Bake 256x256 weathered asphalt runway texture with aggregate grain and tire skid marks. */
function buildTarmacCanvas() {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');

  ctx.fillStyle = '#252a32';
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const px = (i / 4) % size;
    const py = Math.floor(i / 4 / size);
    const grit = (seededNoise(px, py, 19) - 0.5) * 24;
    d[i] = Math.max(15, Math.min(255, d[i] + grit));
    d[i + 1] = Math.max(15, Math.min(255, d[i + 1] + grit));
    d[i + 2] = Math.max(18, Math.min(255, d[i + 2] + grit));
  }
  ctx.putImageData(img, 0, 0);

  // Subtle rubber touchdown skid streaks along runway center
  ctx.fillStyle = 'rgba(12, 14, 18, 0.42)';
  for (let s = 0; s < 14; s += 1) {
    const sx = 68 + seededNoise(s, 1, 29) * 120;
    const sy = seededNoise(s, 2, 31) * 140;
    ctx.fillRect(sx, sy, 3.5, 48 + seededNoise(s, 3, 41) * 55);
  }
  return cv;
}

/** Bake 256x256 brushed aircraft metal texture with panel seams and micro-rivets. */
function buildMetalPanelCanvas() {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');

  ctx.fillStyle = '#e8ecf0';
  ctx.fillRect(0, 0, size, size);

  // Brushed anisotropic streaks
  for (let y = 0; y < size; y += 2) {
    const v = 224 + Math.round((seededNoise(y, 4, 7) - 0.5) * 18);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
    ctx.fillRect(0, y, size, 1);
  }

  // Panel seams
  ctx.strokeStyle = 'rgba(70, 82, 98, 0.34)';
  ctx.lineWidth = 1.5;
  for (const pos of [64, 128, 192]) {
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(size, pos);
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, size);
    ctx.stroke();
  }

  // Subtle rivets along panel edges
  ctx.fillStyle = 'rgba(55, 65, 80, 0.45)';
  for (const seam of [64, 128, 192]) {
    for (let p = 8; p < size; p += 16) {
      ctx.beginPath();
      ctx.arc(p, seam - 4, 1.3, 0, Math.PI * 2);
      ctx.arc(p, seam + 4, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return cv;
}

/** Bake 256x256 soft feathered multi-lobe cumulus cloud sprite. */
function buildCloudSpriteCanvas() {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const lobes = [
    [128, 126, 86, 0.68],
    [82, 140, 62, 0.56],
    [174, 138, 64, 0.56],
    [108, 96, 56, 0.52],
    [152, 98, 54, 0.50],
  ];
  for (const [cx, cy, rad, peak] of lobes) {
    const g = ctx.createRadialGradient(cx, cy - rad * 0.14, rad * 0.1, cx, cy, rad);
    g.addColorStop(0, `rgba(255, 253, 248, ${peak})`);
    g.addColorStop(0.55, `rgba(244, 246, 252, ${peak * 0.55})`);
    g.addColorStop(1, 'rgba(235, 240, 248, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  return cv;
}

export function createProceduralTextures(gl) {
  return {
    terrainDetail: makeWebGLTexture(gl, buildTerrainDetailCanvas(), true),
    tarmac: makeWebGLTexture(gl, buildTarmacCanvas(), true),
    metalPanel: makeWebGLTexture(gl, buildMetalPanelCanvas(), true),
    cloudSprite: makeWebGLTexture(gl, buildCloudSpriteCanvas(), false),
  };
}
