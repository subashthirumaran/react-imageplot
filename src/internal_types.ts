export interface ImagePlot {
  center: Coordinates2D;
  atlasCount: number;
  textureCount: number;
  atlasesPerTex: number;
  textures: PlotTexture[];
  atlasSize: number;
  textureSize: number;
  cells: PlotCell[];
  boundingBox: BoundingBox;
  glLimits: {
    textureSize: number;
    indexedElements: number;
    textureCount: number;
    vShaderTextures: number;
  };
}

export interface PlotAtlas {
  textureId: number;
  image?: HTMLImageElement;
  url: string;
  progress: number;
  id: number;
}

export interface PlotTexture {
  atlases: PlotAtlas[];
  atlasProgress: number;
  id: number;
  maxAtlasCount: number;
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
}

export interface Coordinates2D {
  x: number;
  y: number;
}

export type Coordinates3D = Coordinates2D & { z: number };

export interface BoundingBox {
  x: { max: number; min: number };
  y: { max: number; min: number };
}
