import { Texture } from 'three';

export interface ImagePlot {
  sizes: {
    cell: number;
    lodCell: number;
    atlas: number;
    texture: number;
    lodTexture: number;
  };
  center: Coordinates2D;
  atlasCount: number;
  textureCount: number;
  atlasesPerTex: number;
  textures: PlotTexture[];
  cells: PlotCell[];
  boundingBox: BoundingBox;
  glLimits: {
    textureSize: number;
    indexedElements: number;
    textureCount: number;
    vShaderTextures: number;
  };
  grid?: CellGrid;
}

export interface PlotAtlas {
  textureId: number;
  image: HTMLImageElement;
  url: string;
  progress: number;
  id: number;
  positionOffsetInTexture: Coordinates2D;
}

export interface PlotTexture {
  atlases: PlotAtlas[];
  atlasProgress: number;
  id: number;
  maxAtlasCount: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export interface PlotCell {
  id: number;
  width: number;
  height: number;
  positionIn3d: Coordinates3D;
  texturePosition: Coordinates2D;
  globalAtlasIndex: number;
  indexWithinAtlas: number;
  textureIndex: number;
  indexOfDrawCall: number;
  indexInDrawCall: number;
  gridPosition: Coordinates2D;
  atlasOffset: Coordinates2D;
  atlasPosition: [number, number];
  thumbnailUrl: string;
}

export interface Coordinates2D {
  x: number;
  y: number;
}

export interface Vector2Dimensions {
  width: number;
  height: number;
}

export type Coordinates3D = Coordinates2D & { z: number };

export interface BoundingBox {
  x: { max: number; min: number };
  y: { max: number; min: number };
}

export type CellGrid = {
  [xAxisPosition: string]: { [yAxisPosition: string]: number[] };
};

interface LoDCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  texture: Texture;
}

export interface LODState {
  tex: LoDCanvas;
  cell: LoDCanvas;
  cellIdxToImage: { [cellIndex: string]: HTMLImageElement };
  grid: CellGrid;
  minZ: number;
  initialRadius: number;
  state: {
    camPos: Coordinates2D;
    openCoords: Coordinates2D[];
    neighborsRequested: number;
    gridPosToCoords: {
      [gridKey: string]: (Coordinates2D & { cellIdx: number })[];
    }; // map from a x.y grid position to cell indices and tex offsets at that grid position
    cellIdxToCoords: { [cellIndex: string]: Coordinates2D }; // map from a cell idx to that cell's x, y offsets in lod texture
    cellsToActivate: number[]; // list of cells cached in cellIdxToImage and ready to be added to lod texture
    fetchQueue: number[]; // list of images that need to be fetched and cached
    radius: number; // current radius for LOD
  };
}
