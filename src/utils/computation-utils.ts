import { BoundingBox, Coordinates2D } from '../internal_types';
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

export const DEFAULT_BOUNDING_BOX = (): BoundingBox => ({
  x: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
  y: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
});
