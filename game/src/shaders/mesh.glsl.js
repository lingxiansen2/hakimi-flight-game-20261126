// Textured PBR mesh shader for sculpted aircraft, riveted carrier, tarmac runways, landmarks, and cloud sprites.

export const MESH_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec4 aColor;     // rgba base color
layout(location = 3) in vec3 aMaterial;  // x=roughness, y=metallic, z=emissive
layout(location = 4) in vec2 aUv;

uniform mat4 uViewProj;
uniform mat4 uModel;

out vec3 vWorldPos;
out vec3 vNormal;
out vec4 vColor;
out vec3 vMaterial;
out vec2 vUv;

void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(uModel) * aNormal);
  vColor = aColor;
  vMaterial = aMaterial;
  vUv = aUv;
  gl_Position = uViewProj * wp;
}
`;

export const MESH_FRAG = `#version 300 es
precision highp float;

in vec3 vWorldPos;
in vec3 vNormal;
in vec4 vColor;
in vec3 vMaterial;
in vec2 vUv;

uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uHorizonColor;
uniform vec3 uZenithColor;
uniform float uStorm;
uniform float uNoFog;
uniform int uTexMode;      // 0=none, 1=metalPanel, 2=tarmac, 3=cloudSprite
uniform sampler2D uTex;

out vec4 fragColor;

void main() {
  // Soft feathered Gaussian cumulus cloud sprite path
  if (uTexMode == 3) {
    vec4 spr = texture(uTex, vUv);
    float alpha = spr.a * vColor.a;
    if (alpha < 0.02) discard;
    vec3 litCloud = vColor.rgb * spr.rgb;
    float dist = length(uCamPos - vWorldPos);
    float fog = smoothstep(700.0, 4400.0, dist);
    litCloud = mix(litCloud, uHorizonColor * (1.0 - uStorm * 0.20), fog * 0.65);
    fragColor = vec4(litCloud, alpha);
    return;
  }

  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorldPos);
  if (dot(N, V) < 0.0) N = -N;

  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);

  float roughness = clamp(vMaterial.x, 0.06, 1.0);
  float metallic = clamp(vMaterial.y, 0.0, 1.0);
  float emissive = vMaterial.z;

  vec3 base = vColor.rgb;
  if (uTexMode == 1) {
    float panel = texture(uTex, vUv).r;
    base *= mix(0.86, 1.06, panel);
  } else if (uTexMode == 2) {
    vec3 tarmac = texture(uTex, vUv).rgb;
    base = mix(base, tarmac, 0.65);
  }

  float nDotL = max(dot(N, L), 0.0);
  float nDotV = max(dot(N, V), 0.0);
  float hemi = 0.5 + 0.5 * N.y;

  float shininess = mix(140.0, 6.0, roughness);
  float spec = pow(max(dot(N, H), 0.0), shininess) * mix(0.95, 0.14, roughness);
  float fresnel = pow(1.0 - nDotV, 4.0);

  vec3 skyAmbient = mix(vec3(0.30, 0.36, 0.46), uZenithColor * 0.85 + 0.38, hemi);
  float fillLight = max(dot(N, -L), 0.0) * (uNoFog > 0.5 ? 0.38 : 0.18);
  vec3 diffuse = base * (1.0 - metallic * 0.52) * (skyAmbient * 0.72 + uSunColor * (nDotL * (1.05 - uStorm * 0.42) + fillLight));
  vec3 specTint = mix(uSunColor, base * uSunColor, metallic);
  vec3 specular = specTint * spec * (0.48 + metallic * 0.85) * (1.0 - uStorm * 0.48);
  vec3 envReflect = mix(uHorizonColor, uZenithColor, 0.5) * fresnel * (0.22 + metallic * 0.50) * (1.0 - roughness * 0.70);

  vec3 color = diffuse + specular + envReflect + base * emissive;

  if (uNoFog < 0.5) {
    float dist = length(uCamPos - vWorldPos);
    float fog = smoothstep(550.0, 4400.0, dist);
    color = mix(color, uHorizonColor * (1.0 - uStorm * 0.22), fog);
  }

  fragColor = vec4(color, vColor.a);
}
`;
