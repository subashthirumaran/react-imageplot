//ts-ignore-file
import {
  BufferAttribute,
  BufferGeometry,
  Line,
  RawShaderMaterial,
  Vector3,
} from 'three';
import {
  FRAGMENT_SHADER,
  LASSO_FRAGMENT_SHADER,
  LASSO_VERTEX_SHADER,
  VERTEX_SHADER,
} from '../constants/shaders';
import { getLODCanvas } from './dom-utils';

export const getWebglLimits = function () {
  const gl = document.createElement('canvas').getContext('webgl');

  // fetch all browser extensions as a map for O(1) lookups
  var extensions = (gl?.getSupportedExtensions() || []).reduce(function (
    obj: any,
    i
  ) {
    obj[i] = true;
    return obj;
  },
  {});

  // assess support for 32-bit indices in gl?.drawElements calls
  var maxIndex = 2 ** 16 - 1;

  ['', 'MOZ_', 'WEBKIT_'].forEach(function (ext) {
    if (extensions[ext + 'OES_element_index_uint']) maxIndex = 2 ** 32 - 1;
  });

  // for stats see e.g. https://webglstats.com/webgl/parameter/MAX_TEXTURE_SIZE
  return {
    // max h,w of textures in px
    textureSize: Math.min(gl?.getParameter(gl?.MAX_TEXTURE_SIZE), 2 ** 13),
    // max textures that can be used in fragment shader
    textureCount: gl?.getParameter(gl?.MAX_TEXTURE_IMAGE_UNITS),
    // max textures that can be used in vertex shader
    vShaderTextures: gl?.getParameter(gl?.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
    // max number of indexed elements
    indexedElements: maxIndex,
  };
};

const getFragLeaf = function (texIdx: number, tex: string) {
  return (
    'if (textureIndex == ' +
    texIdx +
    ') {\n          ' +
    'gl_FragColor = texture2D(' +
    tex +
    ', uv);\n        }'
  );
};

const getFragmentShader = function (obj: any) {
  var useColor = obj.useColor,
    firstTex = obj.firstTex,
    textures = obj.textures,
    fragShader = FRAGMENT_SHADER;
  // return shader for selecing clicked images (colorizes cells distinctly)
  if (useColor) {
    fragShader = fragShader.replace(
      'uniform sampler2D textures[N_TEXTURES];',
      ''
    );
    fragShader = fragShader.replace('TEXTURE_LOOKUP_TREE', '');
    return fragShader;
    // the calling agent requested the textured shader
  } else {
    // get the texture lookup tree
    var tree = getFragLeaf(-1, 'lodTexture');
    for (var i = firstTex; i < firstTex + textures.length; i++) {
      tree += ' else ' + getFragLeaf(i, 'textures[' + i + ']');
    }
    // replace the text in the fragment shader
    fragShader = fragShader.replace('#define SELECTING\n', '');
    fragShader = fragShader.replace('N_TEXTURES', textures.length);
    fragShader = fragShader.replace('TEXTURE_LOOKUP_TREE', tree);
    return fragShader;
  }
};

const getPointScale = (
  canvasSize: { width: number; height: number },
  scalar: number
) => {
  return scalar * window.devicePixelRatio * canvasSize.height;
};

export const getShaderMaterial = function (obj: any) {
  const fragment = getFragmentShader(obj);

  // set the uniforms and the shaders to use
  return {
    uniforms: {
      textures: {
        type: 'tv',
        value: obj.textures,
      },
      lodTexture: {
        type: 't',
        value: getLODCanvas(obj.sizes.lodTexture).texture,
      },
      transitionPercent: {
        type: 'f',
        value: 0,
      },
      scale: {
        type: 'f',
        value: getPointScale(obj.canvasSize, 0.05),
      },
      targetScale: {
        type: 'f',
        value: getPointScale(obj.canvasSize, 0.05),
      },
      useColor: {
        type: 'f',
        value: obj.useColor ? 1.0 : 0.0,
      },
      cellAtlasPxPerSide: {
        type: 'f',
        value: obj.sizes.texture,
      },
      lodAtlasPxPerSide: {
        type: 'f',
        value: obj.sizes.lodTexture,
      },
      cellPxHeight: {
        type: 'f',
        value: obj.sizes.cell,
      },
      lodPxHeight: {
        type: 'f',
        value: obj.sizes.lodCell,
      },
      borderWidth: {
        type: 'f',
        value: 0.15,
      },
      selectedBorderColor: {
        type: 'vec3',
        value: new Float32Array([234 / 255, 183 / 255, 85 / 255]),
      },
      clusterBorderColor: {
        type: 'vec3',
        value: new Float32Array([255 / 255, 255 / 255, 255 / 255]),
      },
      display: {
        type: 'f',
        value: 1.0,
      },
      time: {
        type: 'f',
        value: 0.0,
      },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: fragment,
  };
};

export const getLassoMesh = function (lp: any[]) {
  // create a list of 3d points to draw - the last point closes the loop
  var points = [];
  for (var i = 0; i < lp.length; i++) {
    var p = lp[i];
    points.push(new Vector3(p.x, p.y, 0));
  }
  points.push(points[0]);
  // transform those points to a polyline
  var lengths = getCumulativeLengths(points);
  var geometry = new BufferGeometry().setFromPoints(points);
  var lengthAttr = new BufferAttribute(new Float32Array(lengths), 1);
  geometry.setAttribute('length', lengthAttr);
  var material = new RawShaderMaterial({
    uniforms: {
      //@ts-expect-error
      time: { type: 'float', value: 0 },
      //@ts-expect-error
      render: { type: 'bool', value: true },
    },
    vertexShader: LASSO_VERTEX_SHADER,
    fragmentShader: LASSO_FRAGMENT_SHADER,
  });
  var mesh = new Line(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
};

function getCumulativeLengths(points: any[]) {
  var lengths = [];
  var sum = 0;
  for (var i = 0; i < points.length; i++) {
    if (i > 0) sum += points[i].distanceTo(points[i - 1]);
    lengths[i] = sum;
  }
  return lengths;
}
