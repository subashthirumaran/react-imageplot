//ts-ignore-file
import * as THREE from 'three';
import { FRAGMENT_SHADER, VERTEX_SHADER } from '../constants/shaders';
import { createElem } from './computation-utils';

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
    console.log(fragShader, textures);
    return fragShader;
  }
};

const getPointScale = (
  canvasSize: { width: number; height: number },
  scalar: number
) => {
  return scalar * window.devicePixelRatio * canvasSize.height;
};

const getCanvas = function (size: number) {
  var canvas = createElem('canvas', {
    width: size,
    height: size,
    id: 'lod-canvas',
  }) as HTMLCanvasElement;
  return {
    canvas: canvas,
    ctx: canvas.getContext('2d'),
    texture: getTexture(canvas),
  };
};

const getTexture = function (canvas: HTMLCanvasElement) {
  var tex = new THREE.Texture(canvas);
  tex.needsUpdate = true;
  tex.flipY = false;
  tex.generateMipmaps = false;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
};

export const getShaderMaterial = function (obj: any) {
  const fragment = getFragmentShader(obj);
  console.log(obj);
  // set the uniforms and the shaders to use
  return new THREE.RawShaderMaterial({
    uniforms: {
      textures: {
        //@ts-expect-error
        type: 'tv',
        value: obj.textures,
      },
      lodTexture: {
        //@ts-expect-error
        type: 't',
        value: getCanvas(obj.sizes.lodTexture).texture,
      },
      transitionPercent: {
        //@ts-expect-error
        type: 'f',
        value: 0,
      },
      scale: {
        //@ts-expect-error
        type: 'f',
        value: getPointScale(obj.canvasSize, 0.00625),
      },
      targetScale: {
        //@ts-expect-error
        type: 'f',
        value: getPointScale(obj.canvasSize, 0.00625),
      },
      useColor: {
        //@ts-expect-error
        type: 'f',
        value: obj.useColor ? 1.0 : 0.0,
      },
      cellAtlasPxPerSide: {
        //@ts-expect-error
        type: 'f',
        value: obj.sizes.texture,
      },
      lodAtlasPxPerSide: {
        //@ts-expect-error
        type: 'f',
        value: obj.sizes.lodTexture,
      },
      cellPxHeight: {
        //@ts-expect-error
        type: 'f',
        value: obj.sizes.cell,
      },
      lodPxHeight: {
        //@ts-expect-error
        type: 'f',
        value: obj.sizes.lodCell,
      },
      borderWidth: {
        //@ts-expect-error
        type: 'f',
        value: 0.15,
      },
      selectedBorderColor: {
        //@ts-expect-error
        type: 'vec3',
        value: new Float32Array([234 / 255, 183 / 255, 85 / 255]),
      },
      clusterBorderColor: {
        //@ts-expect-error
        type: 'vec3',
        value: new Float32Array([255 / 255, 255 / 255, 255 / 255]),
      },
      display: {
        //@ts-expect-error
        type: 'f',
        value: 1.0,
      },
      time: {
        //@ts-expect-error
        type: 'f',
        value: 0.0,
      },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: fragment,
  });
};
