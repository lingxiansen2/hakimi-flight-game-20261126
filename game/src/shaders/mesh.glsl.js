// Metallic/roughness PBR mesh shader for aircraft, carrier, runways, landmarks, clouds, and gates.

export const MESH_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec4 aColor;     // rgba base color
layout(location = 3) in vec3 aMaterial;  // x=roughness, y=metallic, z=emissive

uniform mat4 uViewProj;
uniform mat4 uModel;

out vec3 vWorldPos;
out vec3 vNormal;
out vec4 vColor;
out vec3 vMaterial;

void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(uModel) * aNormal);
  vColor = aColor;
  vMaterial = aMaterial;
  gl_Position = uViewProj * wp;
}
`;

export const MESH_FRAG = `#version 300 es
precision highp float;

in vec3 vWorldPos;
in vec3 vNormal;
in vec4 vColor;
in vec3 vMaterial;

uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uHorizonColor;
uniform vec3 uZenithColor;
uniform float uStorm;
uniform float uNoFog;

out vec4 fragColor;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorldPos);
  if (dot(N, V) < 0.0) N = -N;

  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);

  float roughness = clamp(vMaterial.x, 0.06, 1.0);
  float metallic = clamp(vMaterial.y, 0.0, 1.0);
  float emissive = vMaterial.z;

  float nDotL = max(dot(N, L), 0.0);
  float nDotV = max(dot(N, V), 0.0);
  float hemi = 0.5 + 0.5 * N.y;

  // Blinn-Phong / microfacet-inspired specular lobe
  float shininess = mix(140.0, 6.0, roughness);
  float spec = pow(max(dot(N, H), 0.0), shininess) * mix(0.95, 0.12, roughness);
  float fresnel = pow(1.0 - nDotV, 4.0);

  vec3 base = vColor.rgb;
  vec3 skyAmbient = mix(vec3(0.28, 0.34, 0.44), uZenithColor * 0.85 + 0.36, hemi);
  float fillLight = max(dot(N, -L), 0.0) * (uNoFog > 0.5 ? 0.34 : 0.14);
  vec3 diffuse = base * (1.0 - metallic * 0.55) * (skyAmbient * 0.68 + uSunColor * (nDotL * (1.05 - uStorm * 0.45) + fillLight));
  vec3 specTint = mix(uSunColor, base * uSunColor, metallic);
  vec3 specular = specTint * spec * (0.45 + metallic * 0.85) * (1.0 - uStorm * 0.5);
  vec3 envReflect = mix(uHorizonColor, uZenithColor, 0.5) * fresnel * (0.20 + metallic * 0.50) * (1.0 - roughness * 0.72);

  vec3 color = diffuse + specular + envReflect + base * emissive;

  if (uNoFog < 0.5) {
    float dist = length(uCamPos - vWorldPos);
    float fog = smoothstep(500.0, 4200.0, dist);
    color = mix(color, uHorizonColor * (1.0 - uStorm * 0.22), fog);
  }

  fragColor = vec4(color, vColor.a);
}
`;
