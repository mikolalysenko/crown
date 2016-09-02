const regl = require('regl')({
  extensions: [
    'OES_element_index_uint',
    'OES_texture_float',
    'OES_texture_float_linear'
  ]
})
const camera = require('regl-camera')(regl, {
  center: [0, 1.25, 0]
})
const normals = require('angle-normals')
const mat4 = require('gl-mat4')

const NUM_SECTIONS = 6
const CROWN_RADIUS = 1.8
const CROWN_RADIUS_GROWTH = 0.05
const CROWN_HEIGHT = 1.5
const SPIKE_HEIGHT = 2.0
const CROWN_THICKNESS = 0.125
const RESOLUTION_U = 128
const RESOLUTION_V = 128

const ENVIORNMENT_FUNC = `
vec3 env (vec3 d) {
  vec3 dir = normalize(d);
  float dist = 100.0 / abs(dir.y);
  vec3 p = dir * dist;
  float intensity = pow(0.5 * (1.0 + max(sin(0.1 * p.x), sin(0.1 * p.z))), 100.0);
  return mix(
    vec3(0, pow(0.5 * (1.0 + cos(tick)), 3.0), 1),
    vec3(intensity, 0.0, intensity),
    min(15.0 * abs(dir.y), 1.0));
}
`

const crown = (function () {
  let s, r
  const crownPositions = []
  const crownUVWs = []
  const crownFaces = []
  const crownDU = []
  const crownDV = []
  const vertexTable = {}

  function emitVertex (ui, vi, w) {
    const ux = ((1 - 2 * r) * ui + RESOLUTION_U * (2 * s + 2 * r)) % (2 * NUM_SECTIONS * RESOLUTION_U)
    const label = [ux, vi, w].join()
    if (label in vertexTable) {
      return vertexTable[label]
    }
    const result = vertexTable[label] = crownPositions.length

    const u = ui / RESOLUTION_U
    const v = vi / RESOLUTION_V

    const theta = ux * Math.PI / (NUM_SECTIONS * RESOLUTION_U)

    const y = CROWN_HEIGHT * v + SPIKE_HEIGHT * v *
    Math.pow(0.5 * (1.0 + Math.cos(NUM_SECTIONS * theta)), 4.0)

    const radius = CROWN_RADIUS + w * CROWN_THICKNESS +
      y * y * CROWN_RADIUS_GROWTH
    const x = radius * Math.cos(theta)
    const z = radius * Math.sin(theta)

    crownPositions.push([x, y, z])
    crownUVWs.push(u, v, w)

    const dydu = SPIKE_HEIGHT * v *
      Math.pow(0.5 * (1.0 + Math.sin(NUM_SECTIONS * theta)), 3.0) *
      0.5 * Math.cos(NUM_SECTIONS * theta)
    crownDU.push(z, dydu, -x)

    const dydv = CROWN_HEIGHT + SPIKE_HEIGHT *
      Math.pow(0.5 * (1.0 + Math.cos(NUM_SECTIONS * theta)), 4.0)
    const drdy = y * CROWN_RADIUS_GROWTH
    const dxdr = Math.cos(theta)
    const dzdr = Math.sin(theta)
    crownDV.push(dxdr * drdy * dydv, dydv, dzdr * drdy * dydv)

    return result
  }

  for (s = 0; s < NUM_SECTIONS; ++s) {
    for (r = 0; r <= 1; ++r) {
      for (let ui = 0; ui < RESOLUTION_U; ++ui) {
        if (r) {
          crownFaces.push([
            emitVertex(ui, 0, 0),
            emitVertex(ui + 1, 0, 0),
            emitVertex(ui, 0, 1)
          ], [
            emitVertex(ui, 0, 1),
            emitVertex(ui + 1, 0, 0),
            emitVertex(ui + 1, 0, 1)
          ], [
            emitVertex(ui + 1, RESOLUTION_V, 0),
            emitVertex(ui, RESOLUTION_V, 0),
            emitVertex(ui, RESOLUTION_V, 1)
          ], [
            emitVertex(ui + 1, RESOLUTION_V, 0),
            emitVertex(ui, RESOLUTION_V, 1),
            emitVertex(ui + 1, RESOLUTION_V, 1)
          ])
        } else {
          crownFaces.push([
            emitVertex(ui + 1, 0, 0),
            emitVertex(ui, 0, 0),
            emitVertex(ui, 0, 1)
          ], [
            emitVertex(ui + 1, 0, 0),
            emitVertex(ui, 0, 1),
            emitVertex(ui + 1, 0, 1)
          ], [
            emitVertex(ui, RESOLUTION_V, 0),
            emitVertex(ui + 1, RESOLUTION_V, 0),
            emitVertex(ui, RESOLUTION_V, 1)
          ], [
            emitVertex(ui, RESOLUTION_V, 1),
            emitVertex(ui + 1, RESOLUTION_V, 0),
            emitVertex(ui + 1, RESOLUTION_V, 1)
          ])
        }

        for (let vi = 0; vi < RESOLUTION_V; ++vi) {
          if (r) {
            crownFaces.push([
              emitVertex(ui, vi, 1),
              emitVertex(ui + 1, vi, 1),
              emitVertex(ui, vi + 1, 1)
            ], [
              emitVertex(ui, vi + 1, 1),
              emitVertex(ui + 1, vi, 1),
              emitVertex(ui + 1, vi + 1, 1)
            ], [
              emitVertex(ui + 1, vi, 0),
              emitVertex(ui, vi, 0),
              emitVertex(ui, vi + 1, 0)
            ], [
              emitVertex(ui + 1, vi, 0),
              emitVertex(ui, vi + 1, 0),
              emitVertex(ui + 1, vi + 1, 0)
            ])
          } else {
            crownFaces.push([
              emitVertex(ui + 1, vi + 1, 1),
              emitVertex(ui + 1, vi, 1),
              emitVertex(ui, vi, 1)
            ], [
              emitVertex(ui + 1, vi + 1, 1),
              emitVertex(ui, vi, 1),
              emitVertex(ui, vi + 1, 1)
            ], [
              emitVertex(ui + 1, vi, 0),
              emitVertex(ui + 1, vi + 1, 0),
              emitVertex(ui, vi, 0)
            ], [
              emitVertex(ui, vi, 0),
              emitVertex(ui + 1, vi + 1, 0),
              emitVertex(ui, vi + 1, 0)
            ])
          }
        }
      }
    }
  }

  return {
    attributes: {
      position: crownPositions,
      uvw: crownUVWs,
      normal: normals(crownFaces, crownPositions),
      du: crownDU,
      dv: crownDV
    },
    elements: regl.elements(crownFaces)
  }
})()

const INIT_FIELD = Array(RESOLUTION_U).fill().map((_, i) =>
  Array(RESOLUTION_V).fill().map((_, j) => {
    if (Math.abs(i - RESOLUTION_U / 2) < RESOLUTION_U / 4 &&
        Math.abs(j - RESOLUTION_V / 2) < RESOLUTION_V / 4) {
      return [0.48 + 0.02 * Math.random(), 0.24 + 0.02 * Math.random(), 0, 0]
    }
    return [1, 0, 0, 0]
  }))

const crownFBO = Array(2).fill().map(() =>
  regl.framebuffer({
    color: regl.texture({
      shape: [RESOLUTION_U, RESOLUTION_V],
      type: 'float',
      min: 'linear',
      mag: 'linear',
      wrap: 'mirror',
      data: INIT_FIELD
    }),
    depthStencil: false
  }))

const drawCrown = regl({
  vert: `
  precision highp float;

  #define DX (1.0/${RESOLUTION_U}.0)
  #define DY (1.0/${RESOLUTION_V}.0)

  attribute vec3 position, normal, uvw, du, dv;
  uniform mat4 projection, view;
  uniform sampler2D offsetTex;
  uniform vec3 eye;
  varying vec3 fragNormal, fragEye;

  float height (float x, float y) {
    return pow(2.0 * (0.5 - abs(uvw.y - 0.5)), 0.25) * abs(texture2D(offsetTex, uvw.xy + vec2(x * DX, y * DY)).g);
  }

  void main () {
    float dfdu = (height(1.0, 0.0) - height(-1.0, 0.0));
    float dfdv = (height(0.0, 1.0) - height(0.0, -1.0));
    vec3 tnormal = cross(
      normalize(normalize(du) + dfdu * normal),
      normalize(normalize(dv) + dfdv * normal));
    vec3 vnormal = mix(normal, tnormal, uvw.z);
    fragNormal = vnormal;

    float offset = height(0.0, 0.0) * uvw.z;
    vec3 offsetPosition = position + offset * normal;
    fragEye = eye - offsetPosition;
    gl_Position = projection * view * vec4(offsetPosition, 1);
  }
  `,

  frag: `
  precision highp float;

  uniform vec3 lightDir[4];
  uniform float tick;

  varying vec3 fragNormal, fragEye;

  ${ENVIORNMENT_FUNC}

  void main () {
    vec3 N = normalize(fragNormal);
    vec3 V = normalize(fragEye);
    vec3 R = reflect(V, N);

    vec3 light = 0.5 * vec3(0.27, 0.15, 0.0);

    for (int i = 0; i < 4; ++i) {
      vec3 L = normalize(lightDir[i]);
      vec3 H = normalize(V + L);
      vec3 diffuse = 2.0 * vec3(0.27, 0.15, 0.0) * max(dot(L, N), 0.0);
      vec3 specular = 0.5 * vec3(1.0, 0.94, 0.84) * pow(max(dot(H, N), 0.0), 5.0);

      light += diffuse + specular;
    }

    light += 0.25 * vec3(1.0, 0.8, 0.24) * env(R);

    gl_FragColor = vec4(light, 1);
  }
  `,

  attributes: crown.attributes,

  uniforms: {
    offsetTex: crownFBO[0],
    'lightDir[0]': [0, 3.0, -1],
    'lightDir[1]': [0, -0.25, 1],
    'lightDir[2]': [1, 2.5, 0],
    'lightDir[3]': [-1, 0, 0],
    tick: ({tick}) => tick / 60.0
  },

  elements: crown.elements
})

const updateCrown = regl({
  vert: `
  precision highp float;
  attribute vec2 position;
  varying vec2 uv;
  void main () {
    uv = 0.5 * (position + 1.0);
    gl_Position = vec4(position, 0, 1);
  }
  `,

  frag: `
  precision highp float;

  #define DX (1.0/${RESOLUTION_U}.0)
  #define DY (1.0/${RESOLUTION_V}.0)

  uniform sampler2D field;
  uniform vec2 diffuse;
  uniform float K, F, dt;

  varying vec2 uv;

  vec4 sample (float x, float y) {
    return texture2D(field, uv + vec2(x * DX, y * DY));
  }

  vec4 lap () {
    return
      sample(-1.0, 0.0) +
      sample(1.0, 0.0) +
      sample(0.0, 1.0) +
      sample(0.0, -1.0) -
      4.0 * sample(0.0, 0.0);
  }

  vec4 next () {
    vec4 L = lap();
    vec4 X = sample(0.0, 0.0);

    float u = X.x;
    float v = X.y;

    float uvv = u * v * v;
    float du = diffuse.x * L.x - uvv + F * (1.0 - u);
    float dv = diffuse.y * L.y + uvv - (F + K) * v;

    return X + dt * vec4(du, dv, 0, 0);
  }

  void main () {
    gl_FragColor = next();
  }
  `,

  uniforms: {
    field: (context, {frame}) => crownFBO[frame % 2],
    diffuse: [0.2097, 0.105],
    F: 0.034,
    K: 0.056,
    dt: 1.0
  },

  attributes: {
    position: [
      [-4, 0],
      [4, 4],
      [4, -4]
    ]
  },

  count: 3,

  framebuffer: (context, {frame}) => crownFBO[(frame + 1) % 2]
})

const drawBackground = regl({
  vert: `
  precision highp float;

  attribute vec2 position;
  varying vec2 screenPosition;

  void main () {
    screenPosition = position;
    gl_Position = vec4(position, 0, 1);
  }
  `,

  frag: `
  precision highp float;

  uniform mat4 inverseProjection, inverseView;
  uniform float tick;
  varying vec2 screenPosition;

  ${ENVIORNMENT_FUNC}

  void main () {
    vec3 ray_eye = normalize((
      inverseProjection * vec4(-screenPosition, 1, -1)).xyz);
    vec3 ray_world = normalize((inverseView * vec4(ray_eye, 0)).xyz);
    gl_FragColor = vec4(env(ray_world), 1);
  }
  `,

  attributes: {
    position: [
      [-4, 0],
      [4, 4],
      [4, -4]
    ]
  },

  uniforms: {
    inverseProjection: ({projection}) => {
      return mat4.invert(mat4.create(), projection)
    },
    inverseView: ({view}) => {
      return mat4.invert(mat4.create(), view)
    },
    tick: ({tick}) => tick / 60.0
  },

  depth: {
    enable: false,
    mask: false
  },

  count: 3
})

regl.frame(() => {
  for (var i = 0; i < 8; ++i) {
    updateCrown({
      frame: i
    })
  }

  regl.clear({
    depth: 1
  })

  camera(() => {
    drawBackground()
    drawCrown()
  })
})
