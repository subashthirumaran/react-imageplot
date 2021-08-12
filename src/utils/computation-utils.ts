import * as THREE from 'three';
import {
  BoundingBox,
  Coordinates2D,
  ImagePlot,
  PlotCell,
  Vector2Dimensions,
} from '../internal_types';
import { getTexture } from './dom-utils';

export const DEFAULT_BOUNDING_BOX = (): BoundingBox => ({
  x: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
  y: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
});

export const getAtlasOffset = (
  idx: number,
  atlasSize: number,
  textureSize: number
): { x: number; y: number } => ({
  x: (idx * atlasSize) % textureSize,
  y: (Math.floor((idx * atlasSize) / textureSize) * atlasSize) % textureSize,
});

export const getBoundingBox = (bb: BoundingBox, coordinates: Coordinates2D) => {
  bb.x.max = Math.max(bb.x.max, coordinates.x);
  bb.x.min = Math.min(bb.x.min, coordinates.x);
  bb.y.max = Math.max(bb.y.max, coordinates.y);
  bb.y.min = Math.min(bb.y.min, coordinates.y);
  return bb;
};

export const getGroupAttributes = function (
  cells: PlotCell[],
  imagePlot: ImagePlot,
  canvasSize: Vector2Dimensions
) {
  const hexColor = new THREE.Color();
  var it = getCellIterators(cells.length);

  for (var i = 0; i < cells.length; i++) {
    var cell = cells[i];
    var rgb = hexColor.setHex(cells[i].id + 1); // use 1-based ids for colors
    it.texIndex[it.texIndexIterator++] = cell.textureIndex; // index of texture among all textures -1 means LOD texture
    it.translation[it.translationIterator++] = cell.positionIn3d.x; // current position.x
    it.translation[it.translationIterator++] = cell.positionIn3d.y; // current position.y
    it.translation[it.translationIterator++] = cell.positionIn3d.z; // current position.z
    it.targetTranslation[it.targetTranslationIterator++] = cell.positionIn3d.x; // target position.x
    it.targetTranslation[it.targetTranslationIterator++] = cell.positionIn3d.y; // target position.y
    it.targetTranslation[it.targetTranslationIterator++] = cell.positionIn3d.z; // target position.z
    it.color[it.colorIterator++] = rgb.r; // could be single float
    it.color[it.colorIterator++] = rgb.g; // unique color for GPU picking
    it.color[it.colorIterator++] = rgb.b; // unique color for GPU picking
    it.opacity[it.opacityIterator++] = 1.0; // cell opacity value
    it.selected[it.selectedIterator++] = 0.0; // 1.0 if cell is selected, else 0.0
    it.clusterSelected[it.clusterSelectedIterator++] = 0.0; // 1.0 if cell's cluster is selected, else 0.0
    it.width[it.widthIterator++] = cell.width; // px width of cell in lod atlas
    it.height[it.heightIterator++] = cell.height; // px height of cell in lod atlas
    it.offset[it.offsetIterator++] = cell.texturePosition.x; // px offset of cell from left of tex
    it.offset[it.offsetIterator++] = cell.texturePosition.y; // px offset of cell from top of tex
  }

  var positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);

  var uvs = new Float32Array([0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0]);

  // format the arrays into THREE attributes
  var position = new THREE.BufferAttribute(positions, 3, true),
    uv = new THREE.BufferAttribute(uvs, 2, true),
    translation = new THREE.InstancedBufferAttribute(
      it.translation,
      3,
      true,
      1
    ),
    targetTranslation = new THREE.InstancedBufferAttribute(
      it.targetTranslation,
      3,
      true,
      1
    ),
    color = new THREE.InstancedBufferAttribute(it.color, 3, true, 1),
    opacity = new THREE.InstancedBufferAttribute(it.opacity, 1, true, 1),
    selected = new THREE.InstancedBufferAttribute(it.selected, 1, false, 1),
    clusterSelected = new THREE.InstancedBufferAttribute(
      it.clusterSelected,
      1,
      false,
      1
    ),
    texIndex = new THREE.InstancedBufferAttribute(it.texIndex, 1, false, 1),
    width = new THREE.InstancedBufferAttribute(it.width, 1, false, 1),
    height = new THREE.InstancedBufferAttribute(it.height, 1, false, 1),
    offset = new THREE.InstancedBufferAttribute(it.offset, 2, false, 1);
  texIndex.usage = THREE.DynamicDrawUsage;
  translation.usage = THREE.DynamicDrawUsage;
  targetTranslation.usage = THREE.DynamicDrawUsage;
  opacity.usage = THREE.DynamicDrawUsage;
  selected.usage = THREE.DynamicDrawUsage;
  clusterSelected.usage = THREE.DynamicDrawUsage;
  offset.usage = THREE.DynamicDrawUsage;
  var texIndices = getTexIndices(cells);
  return {
    position: position,
    uv: uv,
    translation: translation,
    targetTranslation: targetTranslation,
    color: color,
    width: width,
    height: height,
    offset: offset,
    opacity: opacity,
    selected: selected,
    clusterSelected: clusterSelected,
    textureIndex: texIndex,
    textures: getTextures({
      startIdx: texIndices.first,
      endIdx: texIndices.last,
      textures: imagePlot.textures,
      canvasSize,
    }),
    texStartIdx: texIndices.first,
    texEndIdx: texIndices.last,
  };
};

const getTexIndices = function (cells: PlotCell[]) {
  // find the first non -1 tex index
  var f = 0;
  while (cells[f].textureIndex == -1) f++;
  // find the last non -1 tex index
  var l = cells.length - 1;
  while (cells[l].textureIndex == -1) l--;
  // return the first and last non -1 tex indices
  return {
    first: cells[f].textureIndex,
    last: cells[l].textureIndex,
  };
};

export const getCellIterators = function (n: number) {
  return {
    translation: new Float32Array(n * 3),
    targetTranslation: new Float32Array(n * 3),
    color: new Float32Array(n * 3),
    width: new Uint8Array(n),
    height: new Uint8Array(n),
    offset: new Uint16Array(n * 2),
    opacity: new Float32Array(n),
    selected: new Uint8Array(n),
    clusterSelected: new Uint8Array(n),
    texIndex: new Int8Array(n),
    translationIterator: 0,
    targetTranslationIterator: 0,
    colorIterator: 0,
    widthIterator: 0,
    heightIterator: 0,
    offsetIterator: 0,
    opacityIterator: 0,
    selectedIterator: 0,
    clusterSelectedIterator: 0,
    texIndexIterator: 0,
  };
};

const getTextures = function (obj: any) {
  var textures = [];
  for (var i = obj.startIdx; i <= obj.endIdx; i++) {
    var tex = getTexture(obj.textures[i].canvas);
    textures.push(tex);
  }
  return textures;
};

export const toGridCoords = (
  pos: Coordinates2D,
  domain: BoundingBox,
  cellsCount: number
): Coordinates2D => {
  // determine point's position as percent of each axis size 0:1
  var percent = {
    x: (pos.x - domain.x.min) / (domain.x.max - domain.x.min),
    y: (pos.y - domain.y.min) / (domain.y.max - domain.y.min),
  };
  // cut each axis into n buckets per axis and determine point's bucket indices
  var bucketSize = {
    x: 1 / Math.max(100, Math.ceil(cellsCount / 100)),
    y: 1 / Math.max(100, Math.ceil(cellsCount / 100)),
  };
  return {
    x: Math.floor(percent.x / bucketSize.x),
    y: Math.floor(percent.y / bucketSize.y),
  };
};

export const getNested = (obj: any, keyArr: any[], ifEmpty: any) => {
  var result = keyArr.reduce(function (o, key) {
    return o[key] ? o[key] : {};
  }, obj);
  return result.length ? result : ifEmpty;
};

export const inRadius = (
  radius: number,
  obj: Coordinates2D,
  camPos: Coordinates2D
) => {
  var xDelta = Math.floor(Math.abs(obj.x - camPos.x)),
    yDelta = Math.ceil(Math.abs(obj.y - camPos.y));
  return xDelta <= radius * 1.5 && yDelta < radius;
};

// update this cell's buffer values for bound attribute `attr`
export const setBuffer = function (
  attr: string,
  meshes: any,
  indexOfDrawCall: number,
  indexInDrawCall: number,
  updateObj: { [key: string]: number }
) {
  // find the buffer attributes that describe this cell to the GPU
  var attrs = meshes.children[indexOfDrawCall].geometry.attributes;

  switch (attr) {
    case 'textureIndex':
      // set the texIdx to -1 to read from the uniforms.lodTexture
      attrs.textureIndex.array[indexInDrawCall] = updateObj.textureIndex;
      return;

    case 'offset':
      // set the x then y texture offsets for updateObj cell
      attrs.offset.array[indexInDrawCall * 2] = updateObj.dx;
      attrs.offset.array[indexInDrawCall * 2 + 1] = updateObj.dy;
      return;

    case 'translation':
      // set the cell's translation
      attrs.translation.array[indexInDrawCall * 3] = updateObj.x;
      attrs.translation.array[indexInDrawCall * 3 + 1] = updateObj.y;
      attrs.translation.array[indexInDrawCall * 3 + 2] = updateObj.z;
      return;

    case 'targetTranslation':
      // set the cell's translation
      attrs.targetTranslation.array[indexInDrawCall * 3] = updateObj.tx;
      attrs.targetTranslation.array[indexInDrawCall * 3 + 1] = updateObj.ty;
      attrs.targetTranslation.array[indexInDrawCall * 3 + 2] = updateObj.tz;
      return;
  }
};
