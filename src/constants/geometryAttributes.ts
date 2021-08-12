export const bufferGeometryAttributes = [
  {
    key: 'position',
    itemSize: 3,
    normalized: true,
    instanced: false,
  },
  {
    key: 'uv',
    itemSize: 2,
    normalized: true,
    instanced: false,
  },
  {
    key: 'translation',
    itemSize: 3,
    normalized: true,
    instanced: true,
  },
  {
    key: 'targetTranslation',
    itemSize: 3,
    normalized: true,
    instanced: true,
  },
  {
    key: 'color',
    itemSize: 3,
    normalized: true,
    instanced: true,
  },
  {
    key: 'opacity',
    itemSize: 1,
    normalized: true,
    instanced: true,
  },
  {
    key: 'selected',
    itemSize: 1,
    normalized: false,
    instanced: true,
  },
  {
    key: 'clusterSelected',
    itemSize: 1,
    normalized: false,
    instanced: true,
  },
  {
    key: 'textureIndex',
    itemSize: 1,
    normalized: false,
    instanced: true,
  },
  {
    key: 'width',
    itemSize: 1,
    normalized: false,
    instanced: true,
  },
  {
    key: 'height',
    itemSize: 1,
    normalized: false,
    instanced: true,
  },
  {
    key: 'offset',
    itemSize: 2,
    normalized: false,
    instanced: true,
  },
];
