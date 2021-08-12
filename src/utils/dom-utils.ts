import * as THREE from 'three';

export const createElem = (tag: string, obj: { [key: string]: any }) => {
  var obj = obj || {};
  var elem = document.createElement(tag);
  Object.keys(obj).forEach(function (attr) {
    //@ts-expect-error
    elem[attr] = obj[attr];
  });
  return elem;
};

export const getLODCanvas = function (size: number) {
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

export const getTexture = function (canvas: HTMLCanvasElement) {
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
