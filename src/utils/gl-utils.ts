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
