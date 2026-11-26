// High-detail FBM island terrain GLSL shader with procedural detail texture, volcanic glow, and aerial fog.

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
uniform sampler2D uDetailTex;

out vec4 fragColor;

void main() {
  if (vWorldPos.y < -0.6) discard;

  vec3 N = normalize(vNormal);
  vec2 wp = vWorldPos.xz;

  // Dual-scale procedural detail texture sampling eliminates untextured flat slopes & zebra stripes
  vec3 texNear = texture(uDetailTex, wp * 0.0085).rgb;
  vec3 texFar = texture(uDetailTex, wp * 0.0019 + vec2(0.37, 0.61)).rgb;
  float grassVar = texNear.r * 0.65 + texFar.r * 0.35;
  float fissure = texNear.g * 0.60 + texFar.g * 0.40;
  float grain = texNear.b * 0.70 + texFar.b * 0.30;

  // Normal micro-perturbation for crisp rocky ridges
  N = normalize(N + vec3((fissure - 0.5) * 0.32, 0.0, (grain - 0.5) * 0.32));

  float h = vWorldPos.y;
  float slope = clamp(N.y, 0.0, 1.0);

  vec3 sandCol = vec3(0.84, 0.75, 0.56) * (0.84 + grain * 0.32);
  vec3 grassLow = mix(vec3(0.16, 0.46, 0.21), vec3(0.28, 0.56, 0.24), grassVar);
  vec3 grassHigh = mix(vec3(0.13, 0.33, 0.19), vec3(0.24, 0.39, 0.21), fissure);
  vec3 cliffRock = mix(vec3(0.22, 0.21, 0.23), vec3(0.42, 0.37, 0.33), fissure);
  vec3 basaltPeak = mix(vec3(0.16, 0.15, 0.18), vec3(0.30, 0.28, 0.31), grain);
  vec3 alpineAsh = vec3(0.76, 0.80, 0.85) * (0.90 + grain * 0.18);

  vec3 ground = mix(sandCol, grassLow, smoothstep(2.5, 9.5, h));
  ground = mix(ground, grassHigh, smoothstep(45.0, 165.0, h));
  ground = mix(ground, basaltPeak, smoothstep(200.0, 345.0, h));
  ground = mix(ground, alpineAsh, smoothstep(395.0, 480.0, h) * smoothstep(0.62, 0.9, slope));

  float cliffMask = 1.0 - smoothstep(0.56, 0.86, slope);
  vec3 albedo = mix(ground, cliffRock, cliffMask);
  albedo *= mix(0.70, 1.0, smoothstep(0.0, 2.2, h));

  vec3 L = normalize(uSunDir);
  vec3 V = normalize(uCamPos - vWorldPos);
  float nDotL = max(dot(N, L), 0.0);
  float fill = max(dot(N, -L), 0.0) * 0.28;
  float hemi = 0.5 + 0.5 * N.y;

  vec3 ambient = mix(vec3(0.22, 0.28, 0.38), vec3(0.38, 0.48, 0.60), hemi);
  vec3 direct = uSunColor * (nDotL * (1.15 - uStorm * 0.52) + fill);
  vec3 color = albedo * (ambient * 0.72 + direct);

  // Warm rim glow on sunlit ridges
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * nDotL * 0.16;
  color += uSunColor * rim;

  // Volcanic ember & lava fissures inside Caldera Saddle crater (965, 1620)
  float craterDist = length(wp - vec2(965.0, 1620.0));
  if (craterDist < 245.0 && h < 175.0) {
    float lavaMask = (1.0 - smoothstep(45.0, 245.0, craterDist)) * smoothstep(0.32, 0.88, fissure);
    color += vec3(1.0, 0.42, 0.08) * lavaMask * 1.45;
  }

  float dist = length(uCamPos - vWorldPos);
  float fog = smoothstep(500.0, 4400.0, dist);
  color = mix(color, uHorizonColor * (1.0 - uStorm * 0.22), fog);

  fragColor = vec4(color, 1.0);
}
`;
