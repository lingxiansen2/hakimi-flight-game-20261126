// WebGL2 PBR 3D rendering pipeline (with graceful Canvas2D fallback if WebGL2 is unavailable).

import { VIEWPORT } from './config.js';
import {
  buildBasis,
  clamp,
  mat4FromBasisPos,
  mat4Identity,
  mat4Multiply,
  mat4Perspective,
  mat4View,
  norm3,
  pushVertexQuad,
  pushVertexTri,
} from './math3d.js';
import { WORLD_HALF_EXTENT } from './world.js';
import { SKY_FRAG, SKY_VERT } from './shaders/sky.glsl.js';
import { OCEAN_FRAG, OCEAN_VERT } from './shaders/ocean.glsl.js';
import { TERRAIN_FRAG, TERRAIN_VERT } from './shaders/terrain.glsl.js';
import { MESH_FRAG, MESH_VERT } from './shaders/mesh.glsl.js';
import { createColoredMesh, createHeightMapTexture, createShaderProgram, createTerrainMesh } from './glcore.js';
import { buildSculptedAirframeData, buildAircraftDynamicData } from './aircraft.js';
import { buildStaticTerrainBuffers, buildStaticWorldPropsData } from './worldmesh.js';

const THEMES = {
  day: {
    zenith: [0.07, 0.25, 0.56],
    mid: [0.22, 0.52, 0.80],
    horizon: [0.80, 0.88, 0.94],
    sunColor: [1.0, 0.97, 0.86],
    sunDir: norm3({ x: 0.52, y: 0.56, z: 0.64 }),
  },
  golden: {
    zenith: [0.09, 0.22, 0.46],
    mid: [0.34, 0.48, 0.72],
    horizon: [0.96, 0.75, 0.50],
    sunColor: [1.0, 0.88, 0.64],
    sunDir: norm3({ x: 0.45, y: 0.34, z: 0.82 }),
  },
  storm: {
    zenith: [0.08, 0.13, 0.21],
    mid: [0.19, 0.26, 0.36],
    horizon: [0.42, 0.49, 0.57],
    sunColor: [0.82, 0.86, 0.92],
    sunDir: norm3({ x: -0.35, y: 0.44, z: 0.82 }),
  },
  sunset: {
    zenith: [0.11, 0.12, 0.32],
    mid: [0.46, 0.27, 0.48],
    horizon: [0.98, 0.54, 0.36],
    sunColor: [1.0, 0.74, 0.45],
    sunDir: norm3({ x: 0.60, y: 0.22, z: 0.76 }),
  },
};

function createOceanPlaneVao(gl) {
  const N = 64;
  const verts = [];
  for (let iz = 0; iz <= N; iz += 1) {
    for (let ix = 0; ix <= N; ix += 1) {
      verts.push((ix / N) * 2 - 1, (iz / N) * 2 - 1);
    }
  }
  const indices = [];
  for (let iz = 0; iz < N; iz += 1) {
    for (let ix = 0; ix < N; ix += 1) {
      const i00 = iz * (N + 1) + ix;
      const i10 = i00 + 1;
      const i01 = i00 + (N + 1);
      const i11 = i01 + 1;
      indices.push(i00, i01, i10, i10, i01, i11);
    }
  }
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  const ebo = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.bindVertexArray(null);
  return { vao, indexCount: indices.length };
}

function createFullscreenQuadVao(gl) {
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.bindVertexArray(null);
  return vao;
}

/** Build dynamic cloud + turbine blade + target gate + contrail geometry. */
function buildDynamicWorldData(world, ac, missionState, simTime, storm) {
  const arr = [];
  const cloudTop = storm > 0.4 ? [0.54, 0.59, 0.66, 0.88] : [1.0, 0.98, 0.95, 0.90];
  const cloudBot = storm > 0.4 ? [0.34, 0.39, 0.46, 0.84] : [0.78, 0.85, 0.93, 0.84];
  const cloudMatTop = storm > 0.4 ? [0.95, 0.0, 0.28] : [0.95, 0.0, 0.56];
  const cloudMatBot = storm > 0.4 ? [0.95, 0.0, 0.16] : [0.95, 0.0, 0.34];

  // Volumetric shaded 3D cloud decks (8-triangle octahedral puffs with lit scatter)
  for (let i = 0; i < world.clouds.length; i += 1) {
    const c = world.clouds[i];
    const driftX = ((c.x + simTime * 4.5 + 4200) % 8400) - 4200;
    for (let j = 0; j < c.puffs.length; j += 1) {
      const p = c.puffs[j];
      const cx = driftX + p.ox;
      const cy = c.y + p.oy;
      const cz = c.z + p.oz;
      const top = { x: cx, y: cy + p.ry, z: cz };
      const bot = { x: cx, y: cy - p.ry * 0.45, z: cz };
      const ring = [
        { x: cx - p.rx, y: cy, z: cz - p.rz * 0.6 },
        { x: cx + p.rx, y: cy, z: cz - p.rz * 0.6 },
        { x: cx + p.rx, y: cy, z: cz + p.rz * 0.6 },
        { x: cx - p.rx, y: cy, z: cz + p.rz * 0.6 },
      ];
      for (let k = 0; k < 4; k += 1) {
        const a = ring[k];
        const b = ring[(k + 1) % 4];
        pushVertexTri(arr, a, b, top, cloudTop, cloudMatTop, { x: 0, y: 1, z: 0 });
        pushVertexTri(arr, b, a, bot, cloudBot, cloudMatBot, { x: 0, y: -1, z: 0 });
      }
    }
  }

  // Spinning wind turbine blades
  for (let i = 0; i < world.landmarks.length; i += 1) {
    const lm = world.landmarks[i];
    if (lm.kind !== 'turbine') continue;
    const hy = lm.y + lm.height;
    for (let b = 0; b < 3; b += 1) {
      const ang = simTime * 2.1 + lm.phase + (b * Math.PI * 2) / 3;
      const bx = Math.cos(ang) * 26;
      const by = Math.sin(ang) * 26;
      const px = -Math.sin(ang) * 1.1;
      const py = Math.cos(ang) * 1.1;
      pushVertexQuad(
        arr,
        { x: lm.x - px, y: hy - py, z: lm.z - 2.5 },
        { x: lm.x + px, y: hy + py, z: lm.z - 2.5 },
        { x: lm.x + bx + px * 0.3, y: hy + by + py * 0.3, z: lm.z - 2.5 },
        { x: lm.x + bx - px * 0.3, y: hy + by - py * 0.3, z: lm.z - 2.5 },
        [0.95, 0.96, 0.98, 1],
        [0.35, 0.25, 0],
        { x: 0, y: 0, z: -1 },
      );
    }
  }

  // Glowing 3D checkpoint rings
  const gates = missionState.gates;
  for (let i = 0; i < gates.length; i += 1) {
    const g = gates[i];
    if (g.cleared) continue;
    const isNext = i === missionState.currentGateIndex;
    const pulse = isNext ? 1 + 0.05 * Math.sin(simTime * 6) : 1;
    const rOuter = g.radius * pulse;
    const rInner = rOuter * 0.84;
    const nextG = gates[i + 1];
    const yaw = nextG ? Math.atan2(nextG.x - g.x, nextG.z - g.z) : 0;
    const ca = Math.cos(yaw);
    const sa = Math.sin(yaw);
    const segs = 18;
    const cyan = isNext ? [0.25, 0.96, 0.88, 0.94] : [0.45, 0.72, 0.90, 0.45];
    const gold = isNext ? [1.0, 0.82, 0.25, 0.96] : [0.45, 0.72, 0.90, 0.45];
    const mat = isNext ? [0.2, 0.0, 1.35] : [0.4, 0.0, 0.45];

    for (let s = 0; s < segs; s += 1) {
      const a0 = (s / segs) * Math.PI * 2 + simTime * (isNext ? 0.45 : 0.1);
      const a1 = ((s + 1) / segs) * Math.PI * 2 + simTime * (isNext ? 0.45 : 0.1);
      const pt = (rad, ang, depthOff) => {
        const lx = Math.cos(ang) * rad;
        const ly = Math.sin(ang) * rad;
        return { x: g.x + lx * ca + depthOff * sa, y: g.y + ly, z: g.z - lx * sa + depthOff * ca };
      };
      const col = s % 3 === 0 ? gold : cyan;
      pushVertexQuad(arr, pt(rInner, a0, -1.6), pt(rOuter, a0, -1.6), pt(rOuter, a1, -1.6), pt(rInner, a1, -1.6), col, mat, { x: sa, y: 0, z: ca });
      pushVertexQuad(arr, pt(rOuter, a0, -1.6), pt(rOuter, a0, 1.6), pt(rOuter, a1, 1.6), pt(rOuter, a1, -1.6), col, mat, { x: Math.cos(a0) * ca, y: Math.sin(a0), z: -Math.cos(a0) * sa });
    }
  }

  // Wingtip contrail ribbons
  if (ac.contrails.length > 1) {
    for (const tipKey of ['left', 'right']) {
      for (let i = 1; i < ac.contrails.length; i += 1) {
        const a = ac.contrails[i - 1][tipKey];
        const b = ac.contrails[i][tipKey];
        const alpha = clamp(ac.contrails[i].life * 0.55, 0.02, 0.55);
        pushVertexQuad(
          arr,
          { x: a.x - 0.18, y: a.y, z: a.z },
          { x: a.x + 0.18, y: a.y, z: a.z },
          { x: b.x + 0.18, y: b.y, z: b.z },
          { x: b.x - 0.18, y: b.y, z: b.z },
          [0.95, 0.98, 1.0, alpha],
          [0.3, 0, 0.5],
          { x: 0, y: 1, z: 0 },
        );
      }
    }
  }

  return new Float32Array(arr);
}

export function createRenderer(glCanvas, world) {
  const gl = glCanvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: true });
  if (!gl) {
    // Lightweight Canvas2D fallback if WebGL2 is unavailable
    const ctx2d = glCanvas.getContext('2d');
    return {
      isWebGL2: false,
      drawScene(wObj, ac, cam, ms) {
        ctx2d.fillStyle = '#1b4978';
        ctx2d.fillRect(0, 0, VIEWPORT.width, VIEWPORT.height);
        return { worldPointToScreen: () => null };
      },
    };
  }

  const skyProg = createShaderProgram(gl, SKY_VERT, SKY_FRAG);
  const oceanProg = createShaderProgram(gl, OCEAN_VERT, OCEAN_FRAG);
  const terrainProg = createShaderProgram(gl, TERRAIN_VERT, TERRAIN_FRAG);
  const meshProg = createShaderProgram(gl, MESH_VERT, MESH_FRAG);

  const skyQuad = createFullscreenQuadVao(gl);
  const oceanVao = createOceanPlaneVao(gl);
  const heightTex = createHeightMapTexture(gl, 512, WORLD_HALF_EXTENT, world.getHeight);

  const terrainBufs = buildStaticTerrainBuffers(world);
  const terrainVao = createTerrainMesh(gl, terrainBufs.verts, terrainBufs.indices);
  const staticPropsMesh = createColoredMesh(gl, buildStaticWorldPropsData(world), false);
  const staticAirframeMesh = createColoredMesh(gl, buildSculptedAirframeData(), false);
  const dynamicAirframeMesh = createColoredMesh(gl, new Float32Array(0), true);
  const dynamicWorldMesh = createColoredMesh(gl, new Float32Array(0), true);

  const identityMat = mat4Identity();

  return {
    isWebGL2: true,
    drawScene(worldObj, ac, cam, missionState, simTime) {
      const theme = THEMES[missionState.mission.timeOfDay] ?? THEMES.day;
      const storm = missionState.mission.storm ?? 0;

      const aspect = VIEWPORT.width / VIEWPORT.height;
      const fovRad = (cam.fovDeg * Math.PI) / 180;
      const projMat = mat4Perspective(fovRad, aspect, VIEWPORT.nearZ, VIEWPORT.farZ);
      const viewMat = mat4View(cam.pos, cam.basis);
      const viewProj = mat4Multiply(projMat, viewMat);

      gl.viewport(0, 0, VIEWPORT.width, VIEWPORT.height);
      gl.clearColor(theme.horizon[0], theme.horizon[1], theme.horizon[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // 1. Atmospheric Sky Dome
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.useProgram(skyProg.program);
      gl.uniform3f(skyProg.uniforms.uCamRight, cam.basis.right.x, cam.basis.right.y, cam.basis.right.z);
      gl.uniform3f(skyProg.uniforms.uCamUp, cam.basis.up.x, cam.basis.up.y, cam.basis.up.z);
      gl.uniform3f(skyProg.uniforms.uCamForward, cam.basis.forward.x, cam.basis.forward.y, cam.basis.forward.z);
      gl.uniform1f(skyProg.uniforms.uTanHalfFov, Math.tan(fovRad * 0.5));
      gl.uniform1f(skyProg.uniforms.uAspect, aspect);
      gl.uniform3f(skyProg.uniforms.uSunDir, theme.sunDir.x, theme.sunDir.y, theme.sunDir.z);
      gl.uniform3fv(skyProg.uniforms.uZenithColor, theme.zenith);
      gl.uniform3fv(skyProg.uniforms.uMidColor, theme.mid);
      gl.uniform3fv(skyProg.uniforms.uHorizonColor, theme.horizon);
      gl.uniform3fv(skyProg.uniforms.uSunColor, theme.sunColor);
      gl.uniform1f(skyProg.uniforms.uTime, simTime);
      gl.uniform1f(skyProg.uniforms.uStorm, storm);
      gl.bindVertexArray(skyQuad);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);

      // 2. Animated Ocean Shader
      gl.useProgram(oceanProg.program);
      gl.uniformMatrix4fv(oceanProg.uniforms.uViewProj, false, viewProj);
      gl.uniform3f(oceanProg.uniforms.uCamPos, cam.pos.x, cam.pos.y, cam.pos.z);
      gl.uniform1f(oceanProg.uniforms.uSpan, 5200);
      gl.uniform3f(oceanProg.uniforms.uSunDir, theme.sunDir.x, theme.sunDir.y, theme.sunDir.z);
      gl.uniform3fv(oceanProg.uniforms.uSunColor, theme.sunColor);
      gl.uniform3fv(oceanProg.uniforms.uHorizonColor, theme.horizon);
      gl.uniform3fv(oceanProg.uniforms.uZenithColor, theme.zenith);
      gl.uniform1f(oceanProg.uniforms.uTime, simTime);
      gl.uniform1f(oceanProg.uniforms.uWorldHalfExtent, WORLD_HALF_EXTENT);
      gl.uniform1f(oceanProg.uniforms.uStorm, storm);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, heightTex);
      gl.uniform1i(oceanProg.uniforms.uHeightMap, 0);
      gl.bindVertexArray(oceanVao.vao);
      gl.drawElements(gl.TRIANGLES, oceanVao.indexCount, gl.UNSIGNED_SHORT, 0);

      // 3. FBM Volcanic Island Terrain
      gl.useProgram(terrainProg.program);
      gl.uniformMatrix4fv(terrainProg.uniforms.uViewProj, false, viewProj);
      gl.uniform3f(terrainProg.uniforms.uCamPos, cam.pos.x, cam.pos.y, cam.pos.z);
      gl.uniform3f(terrainProg.uniforms.uSunDir, theme.sunDir.x, theme.sunDir.y, theme.sunDir.z);
      gl.uniform3fv(terrainProg.uniforms.uSunColor, theme.sunColor);
      gl.uniform3fv(terrainProg.uniforms.uHorizonColor, theme.horizon);
      gl.uniform1f(terrainProg.uniforms.uStorm, storm);
      gl.bindVertexArray(terrainVao.vao);
      gl.drawElements(gl.TRIANGLES, terrainVao.indexCount, gl.UNSIGNED_INT, 0);

      // 4. Static PBR Landmarks, Runways, Carrier, Harbor & Trees
      gl.useProgram(meshProg.program);
      gl.uniformMatrix4fv(meshProg.uniforms.uViewProj, false, viewProj);
      gl.uniformMatrix4fv(meshProg.uniforms.uModel, false, identityMat);
      gl.uniform3f(meshProg.uniforms.uCamPos, cam.pos.x, cam.pos.y, cam.pos.z);
      gl.uniform3f(meshProg.uniforms.uSunDir, theme.sunDir.x, theme.sunDir.y, theme.sunDir.z);
      gl.uniform3fv(meshProg.uniforms.uSunColor, theme.sunColor);
      gl.uniform3fv(meshProg.uniforms.uHorizonColor, theme.horizon);
      gl.uniform3fv(meshProg.uniforms.uZenithColor, theme.zenith);
      gl.uniform1f(meshProg.uniforms.uStorm, storm);
      gl.uniform1f(meshProg.uniforms.uNoFog, 0);
      gl.bindVertexArray(staticPropsMesh.vao);
      gl.drawArrays(gl.TRIANGLES, 0, staticPropsMesh.vertexCount);

      // 5. Sculpted SC-7 Solara Corsair Aircraft
      if (cam.mode !== 'cockpit') {
        const acBasis = buildBasis(ac.yaw, ac.pitch, ac.roll);
        const acModel = mat4FromBasisPos(acBasis, ac.pos);
        gl.uniformMatrix4fv(meshProg.uniforms.uModel, false, acModel);
        gl.uniform1f(meshProg.uniforms.uNoFog, 1);
        gl.bindVertexArray(staticAirframeMesh.vao);
        gl.drawArrays(gl.TRIANGLES, 0, staticAirframeMesh.vertexCount);

        dynamicAirframeMesh.update(buildAircraftDynamicData(ac));
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.bindVertexArray(dynamicAirframeMesh.vao);
        gl.drawArrays(gl.TRIANGLES, 0, dynamicAirframeMesh.vertexCount);
        gl.disable(gl.BLEND);
      }

      // 6. Volumetric Clouds, Turbines, Target Gates & Contrails
      dynamicWorldMesh.update(buildDynamicWorldData(worldObj, ac, missionState, simTime, storm));
      gl.uniformMatrix4fv(meshProg.uniforms.uModel, false, identityMat);
      gl.uniform1f(meshProg.uniforms.uNoFog, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.bindVertexArray(dynamicWorldMesh.vao);
      gl.drawArrays(gl.TRIANGLES, 0, dynamicWorldMesh.vertexCount);
      gl.depthMask(true);
      gl.disable(gl.BLEND);

      gl.bindVertexArray(null);

      // Return screen projection helper for HUD target diamond
      return {
        worldPointToScreen(wp) {
          const dx = wp.x - cam.pos.x;
          const dy = wp.y - cam.pos.y;
          const dz = wp.z - cam.pos.z;
          const vx = dx * cam.basis.right.x + dy * cam.basis.right.y + dz * cam.basis.right.z;
          const vy = dx * cam.basis.up.x + dy * cam.basis.up.y + dz * cam.basis.up.z;
          const vz = dx * cam.basis.forward.x + dy * cam.basis.forward.y + dz * cam.basis.forward.z;
          if (vz <= VIEWPORT.nearZ) return null;
          const focal = (VIEWPORT.height * 0.5) / Math.tan(fovRad * 0.5);
          return {
            x: VIEWPORT.width * 0.5 + (vx / vz) * focal,
            y: VIEWPORT.height * 0.5 - (vy / vz) * focal,
            z: vz,
          };
        },
      };
    },
  };
}
