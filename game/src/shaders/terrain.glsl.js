// High-detail FBM island terrain GLSL shader with slope/elevation biomes, rock strata, and fog.

export const TERRAIN_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;

uniform mat4 uViewProj;

out vec3 vWorldPos;
out vec3 vNormal;

void main() {
  vWorldPos = aPos;
  vNormal = normalize(aNormal);
  gl_Position = uViewProj * vec4(aPos, 1.0);
}
`;

export const TERRAIN_FRAG = `#version 300 es
precision highp float;

in vec3 vWorldPos;
in vec3 vNormal;

uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uHorizonColor;
uniform float uStorm;

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

void main() {
  if (vWorldPos.y < -0.6) discard;

  vec3 N = normalize(vNormal);
  vec2 wp = vWorldPos.xz;
  float micro = noise(wp * 0.055) * 0.6 + noise(wp * 0.17) * 0.4;
  float detailPerturb = (micro - 0.5) * 0.22;
  N = normalize(N + vec3(detailPerturb, 0.0, -detailPerturb));

  float h = vWorldPos.y;
  float slope = clamp(N.y, 0.0, 1.0);

  // Biome palette
  vec3 sandCol = vec3(0.84, 0.75, 0.57) * (0.92 + micro * 0.16);
  vec3 grassLow = vec3(0.20, 0.52, 0.24) * (0.85 + micro * 0.28);
  vec3 grassHigh = vec3(0.14, 0.36, 0.21) * (0.86 + micro * 0.25);
  vec3 cliffStrata = mix(vec3(0.26, 0.25, 0.27), vec3(0.42, 0.38, 0.35), sin(h * 0.22 + micro * 3.0) * 0.5 + 0.5);
  vec3 basaltPeak = vec3(0.18, 0.17, 0.20) * (0.85 + micro * 0.3);
  vec3 alpineCap = vec3(0.80, 0.84, 0.89);

  // Smooth elevation & slope blending
  vec3 ground = mix(sandCol, grassLow, smoothstep(2.5, 9.0, h));
  ground = mix(ground, grassHigh, smoothstep(50.0, 175.0, h));
  ground = mix(ground, basaltPeak, smoothstep(210.0, 340.0, h));
  ground = mix(ground, alpineCap, smoothstep(395.0, 470.0, h) * smoothstep(0.65, 0.9, slope));

  // Exposed stratified cliffs on steep slopes
  float cliffMask = 1.0 - smoothstep(0.58, 0.83, slope);
  vec3 albedo = mix(ground, cliffStrata, cliffMask);

  // Wet sand darken right at waterline
  albedo *= mix(0.68, 1.0, smoothstep(0.0, 2.2, h));

  vec3 L = normalize(uSunDir);
  vec3 V = normalize(uCamPos - vWorldPos);
  float nDotL = max(dot(N, L), 0.0);
  float hemi = 0.5 + 0.5 * N.y;

  vec3 ambient = mix(vec3(0.16, 0.22, 0.30), vec3(0.32, 0.42, 0.55), hemi);
  vec3 direct = uSunColor * nDotL * (1.15 - uStorm * 0.55);
  vec3 color = albedo * (ambient * 0.65 + direct);

  // Subtle rim scatter on sunlit ridges
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * nDotL * 0.14;
  color += uSunColor * rim;

  float dist = length(uCamPos - vWorldPos);
  float fog = smoothstep(450.0, 4200.0, dist);
  color = mix(color, uHorizonColor * (1.0 - uStorm * 0.22), fog);

  fragColor = vec4(color, 1.0);
}
`;
