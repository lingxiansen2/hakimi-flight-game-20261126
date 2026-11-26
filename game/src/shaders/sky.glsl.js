// Atmospheric Rayleigh + Mie sun-halo scattering sky dome GLSL shader.

export const SKY_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;

uniform mat4 uInvViewProj;
out vec3 vRayClip;

void main() {
  gl_Position = vec4(aPos, 0.9999, 1.0);
  vRayClip = vec3(aPos, 1.0);
}
`;

export const SKY_FRAG = `#version 300 es
precision highp float;

in vec3 vRayClip;

uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamForward;
uniform float uTanHalfFov;
uniform float uAspect;
uniform vec3 uSunDir;
uniform vec3 uZenithColor;
uniform vec3 uMidColor;
uniform vec3 uHorizonColor;
uniform vec3 uSunColor;
uniform float uTime;
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
  vec3 dir = normalize(
    uCamForward
    + uCamRight * (vRayClip.x * uAspect * uTanHalfFov)
    + uCamUp * (vRayClip.y * uTanHalfFov)
  );

  float h = clamp(dir.y, -0.3, 1.0);
  float horizonBand = pow(1.0 - clamp(abs(h), 0.0, 1.0), 4.2);

  vec3 sky = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.28, max(h, 0.0)));
  sky = mix(sky, uZenithColor, smoothstep(0.22, 0.88, max(h, 0.0)));

  // Mie forward sun scattering glow & crisp solar disc
  float sunCos = max(dot(dir, normalize(uSunDir)), 0.0);
  float mieGlow = pow(sunCos, 6.0) * 0.38 + pow(sunCos, 48.0) * 0.55;
  float sunDisc = smoothstep(0.9985, 0.9994, sunCos);
  sky += uSunColor * mieGlow * (1.0 - uStorm * 0.55);
  sky = mix(sky, vec3(1.0, 0.99, 0.93), sunDisc * (1.0 - uStorm * 0.75));

  // Subtle high-altitude cirrus cloud wisps
  if (dir.y > 0.04) {
    vec2 uv = dir.xz / (dir.y + 0.18) * 1.4 + vec2(uTime * 0.008, uTime * 0.003);
    float c = noise(uv * 2.2) * 0.6 + noise(uv * 5.1) * 0.4;
    float cirrus = smoothstep(0.54 - uStorm * 0.18, 0.86, c) * smoothstep(0.04, 0.28, dir.y);
    vec3 cirrusCol = mix(uHorizonColor * 1.08, vec3(0.45, 0.52, 0.62), uStorm);
    sky = mix(sky, cirrusCol, cirrus * 0.42);
  }

  // Horizon atmospheric veil
  sky = mix(sky, uHorizonColor * (1.0 - uStorm * 0.25), horizonBand * 0.55);

  fragColor = vec4(sky, 1.0);
}
`;
