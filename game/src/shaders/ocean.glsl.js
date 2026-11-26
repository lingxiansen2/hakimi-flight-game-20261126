// Animated ocean GLSL shader with multi-octave ripples, depth tint, shoreline foam, Fresnel, and sun glitter.

export const OCEAN_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aGridPos;

uniform mat4 uViewProj;
uniform vec3 uCamPos;
uniform float uSpan;

out vec3 vWorldPos;

void main() {
  // Snap ocean mesh around camera in coarse steps so horizon always stays full
  float snap = 80.0;
  vec2 base = floor(uCamPos.xz / snap) * snap;
  vec2 xz = base + aGridPos * uSpan;
  vWorldPos = vec3(xz.x, 0.0, xz.y);
  gl_Position = uViewProj * vec4(vWorldPos, 1.0);
}
`;

export const OCEAN_FRAG = `#version 300 es
precision highp float;

in vec3 vWorldPos;

uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uHorizonColor;
uniform vec3 uZenithColor;
uniform float uTime;
uniform float uWorldHalfExtent;
uniform float uStorm;
uniform sampler2D uHeightMap;

out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float waveHeight(vec2 p, float t) {
  float w = 0.0;
  w += sin(p.x * 0.045 + t * 1.45 + p.y * 0.02) * 0.45;
  w += cos(p.y * 0.062 - t * 1.2 + p.x * 0.03) * 0.35;
  w += (noise(p * 0.09 + vec2(t * 0.35, -t * 0.25)) - 0.5) * 0.7;
  w += (noise(p * 0.24 - vec2(t * 0.55, t * 0.4)) - 0.5) * 0.3;
  return w;
}

void main() {
  vec2 uv = (vWorldPos.xz / (uWorldHalfExtent * 2.0)) + 0.5;
  float elevation = -14.0;
  if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
    vec4 hm = texture(uHeightMap, uv);
    elevation = hm.r * 620.0 - 40.0;
  }

  // Multi-octave wave normal perturbation
  float eps = 1.6;
  float h0 = waveHeight(vWorldPos.xz, uTime);
  float hx = waveHeight(vWorldPos.xz + vec2(eps, 0.0), uTime);
  float hz = waveHeight(vWorldPos.xz + vec2(0.0, eps), uTime);
  float chop = 0.16 + uStorm * 0.14;
  vec3 N = normalize(vec3((h0 - hx) * chop, 1.0, (h0 - hz) * chop));

  vec3 V = normalize(uCamPos - vWorldPos);
  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);

  // Coastal turquoise shallows -> deep oceanic navy
  float shallow = smoothstep(-24.0, 0.5, elevation);
  vec3 deepCol = mix(vec3(0.025, 0.14, 0.28), vec3(0.04, 0.10, 0.17), uStorm);
  vec3 shallowCol = mix(vec3(0.06, 0.46, 0.56), vec3(0.08, 0.26, 0.34), uStorm);
  vec3 waterBase = mix(deepCol, shallowCol, shallow);

  // Fresnel sky reflection
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  vec3 skyReflect = mix(uHorizonColor, uZenithColor, 0.45);
  vec3 color = mix(waterBase, skyReflect, clamp(fresnel * 0.78 + 0.08, 0.0, 0.88));

  // Sun specular glitter trail on wave crests
  float specTight = pow(max(dot(N, H), 0.0), 180.0);
  float specBroad = pow(max(dot(N, H), 0.0), 22.0);
  color += uSunColor * (specTight * 2.1 + specBroad * 0.18) * (1.0 - uStorm * 0.65);

  // Animated white shoreline surf & whitecaps
  float surfWave = sin(elevation * 1.4 - uTime * 3.1 + h0 * 2.2);
  float shoreFoam = smoothstep(-5.5, 0.2, elevation) * smoothstep(0.15, 0.85, surfWave);
  float chopFoam = smoothstep(0.65, 0.98, h0) * (0.14 + uStorm * 0.35);
  color = mix(color, vec3(0.92, 0.96, 0.99), clamp(shoreFoam * 0.85 + chopFoam, 0.0, 0.9));

  // Atmospheric distance fog
  float dist = length(uCamPos - vWorldPos);
  float fog = smoothstep(450.0, 4200.0, dist);
  color = mix(color, uHorizonColor * (1.0 - uStorm * 0.22), fog);

  fragColor = vec4(color, 1.0);
}
`;
