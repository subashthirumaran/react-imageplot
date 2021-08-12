import { flatten, omit, times } from 'lodash';
import { BufferAttribute } from 'three';
import { ImageList, PlotManifest } from '../external_types';
import {
  CellGrid,
  ImagePlot,
  PlotAtlas,
  PlotCell,
  PlotTexture,
  Vector2Dimensions,
} from '../internal_types';
import { loadFile } from './api-utils';
import {
  DEFAULT_BOUNDING_BOX,
  getAtlasOffset,
  getBoundingBox,
  getGroupAttributes,
  toGridCoords,
} from './computation-utils';
import { createElem } from './dom-utils';
import { getShaderMaterial, getWebglLimits } from './gl-utils';

export const loadBlobToImage = (imageElement: HTMLImageElement, blob: Blob) => {
  return new Promise((resolve, reject) => {
    imageElement.onload = () => resolve(imageElement);
    imageElement.onerror = reject;
    imageElement.src = window.URL.createObjectURL(blob);
  });
};

const loadAtlasImages = async (imagePlot: ImagePlot) => {
  const atlases: PlotAtlas[] = flatten(
    imagePlot.textures.map((tex: PlotTexture) => tex.atlases)
  );

  await Promise.all(
    atlases.map(async atlas => {
      const imageResponse = await loadFile(atlas.url, { responseType: 'blob' });
      await loadBlobToImage(atlas.image, imageResponse);
      imagePlot.textures[atlas.textureId].ctx.drawImage(
        atlas.image as CanvasImageSource,
        atlas.positionOffsetInTexture.x,
        atlas.positionOffsetInTexture.y,
        imagePlot.sizes.atlas,
        imagePlot.sizes.atlas
      );
    })
  );
};

export const buildPlotData = async () => {
  const manifest: PlotManifest = await loadFile('output/data/manifest.json');
  const imageList: ImageList = await loadFile(manifest.imagelist);
  const glLimits = getWebglLimits();
  const atlasesPerTex =
    (glLimits.textureSize / manifest.config.sizes.atlas) ** 2;

  const imagePlot: ImagePlot = {
    sizes: {
      cell: 32,
      lodCell: 128,
      atlas: manifest.config.sizes.atlas,
      texture: glLimits.textureSize,
      lodTexture: Math.min(2 ** 13, glLimits.textureSize),
    },
    atlasCount: imageList.atlas.count,
    atlasesPerTex,
    textureCount: Math.ceil(imageList.atlas.count / atlasesPerTex),
    textures: [],
    cells: [],
    boundingBox: DEFAULT_BOUNDING_BOX(),
    glLimits,
    center: { x: 0, y: 0 },
  };

  // build textures
  var atlasCount = 0;
  times(imagePlot.textureCount, textureIndex => {
    const canvas = createElem('canvas', {
      width: imagePlot.sizes.texture,
      height: imagePlot.sizes.texture,
      id: 'texture-' + textureIndex,
    }) as HTMLCanvasElement;

    const texture: PlotTexture = {
      atlases: [],
      atlasProgress: 0,
      id: textureIndex,
      canvas,
      ctx: canvas.getContext('2d') as CanvasRenderingContext2D,
      maxAtlasCount:
        imagePlot.atlasCount / imagePlot.atlasesPerTex > textureIndex + 1
          ? imagePlot.atlasesPerTex
          : imagePlot.atlasCount % imagePlot.atlasesPerTex,
    };
    times(texture.maxAtlasCount, atlasIndex => {
      const atlas: PlotAtlas = {
        image: new Image(),
        textureId: textureIndex,
        url: manifest.atlas_dir + '/atlas-' + atlasIndex + '.jpg',
        progress: 0,
        id: atlasIndex,
        positionOffsetInTexture: getAtlasOffset(
          atlasCount,
          imagePlot.sizes.atlas,
          imagePlot.sizes.texture
        ),
      };
      texture.atlases.push(atlas);
      atlasCount++;
    });
    imagePlot.textures.push(texture);
  });

  // Fetching umapLayout only - Could fetch other layouts too if needed
  const layout = await loadFile(manifest.layouts['umap'].layout);

  // build cells
  var globalCellIndex = 0;
  times(imagePlot.atlasCount, atlasIndex => {
    times(imageList.cell_sizes[atlasIndex].length, cellAtlasIndex => {
      const size = imageList.cell_sizes[atlasIndex][cellAtlasIndex],
        atlasPosition = imageList.atlas.positions[atlasIndex][cellAtlasIndex],
        atlasOffset = getAtlasOffset(
          atlasIndex,
          imagePlot.sizes.atlas,
          imagePlot.sizes.texture
        ),
        positionIn3d = {
          x: layout[globalCellIndex][0],
          y: layout[globalCellIndex][1],
          z: layout[globalCellIndex][2] || 0,
        };

      const cell: PlotCell = {
        id: globalCellIndex,
        globalAtlasIndex: atlasIndex,
        indexWithinAtlas: cellAtlasIndex,
        textureIndex: Math.floor(atlasIndex / imagePlot.atlasesPerTex),
        indexOfDrawCall: Math.floor(globalCellIndex / glLimits.indexedElements),
        indexInDrawCall: globalCellIndex % glLimits.indexedElements,
        thumbnailUrl: 'output/data/thumbs/' + imageList.images[globalCellIndex],
        width: size[0],
        height: size[1],
        positionIn3d,
        gridPosition: { x: 0, y: 0 },
        atlasOffset,
        atlasPosition,
        texturePosition: {
          x: atlasOffset.x + atlasPosition[0],
          y: atlasOffset.y + atlasPosition[1],
        },
      };

      //updates global bounding box
      imagePlot.boundingBox = getBoundingBox(
        imagePlot.boundingBox,
        positionIn3d
      );

      imagePlot.cells.push(cell);
      globalCellIndex++;
    });
  });

  // Forming 2D grid
  const grid: CellGrid = {};
  imagePlot.cells.forEach((cell: PlotCell) => {
    cell.gridPosition = toGridCoords(
      cell.positionIn3d,
      imagePlot.boundingBox,
      imagePlot.cells.length
    );
    const { x, y } = cell.gridPosition;
    if (!grid[x]) grid[x] = {};
    if (!grid[x][y]) grid[x][y] = [];
    grid[x][y].push(cell.id);
  });
  imagePlot.grid = grid;

  imagePlot.center = {
    x: (imagePlot.boundingBox.x.min + imagePlot.boundingBox.x.max) / 2,
    y: (imagePlot.boundingBox.y.min + imagePlot.boundingBox.y.max) / 2,
  };

  await loadAtlasImages(imagePlot);
  return imagePlot;
};

export const buildGroups = (
  imagePlot: ImagePlot,
  canvasSize: Vector2Dimensions
) => {
  const drawCalls: PlotCell[][] = [];
  imagePlot.cells.forEach(cell => {
    if (!drawCalls[cell.indexOfDrawCall]) {
      drawCalls[cell.indexOfDrawCall] = [];
    }
    drawCalls[cell.indexOfDrawCall].push(cell);
  });
  const meshes = [];
  for (const meshCells of drawCalls) {
    const indexArray = new Uint8Array(6);
    [0, 1, 2, 2, 3, 0].forEach((n, i) => (indexArray[i] = n));

    const indx = new BufferAttribute(indexArray, 1, true);
    const attrs = getGroupAttributes(meshCells, imagePlot, canvasSize);
    const attributes = omit(attrs, ['texStartIdx', 'texEndIdx', 'textures']);
    for (const attr in attributes) {
      //@ts-expect-error
      attributes[attr].onUploadCallback = () => {};
    }
    indx.onUploadCallback = () => {};
    meshes.push({
      material: getShaderMaterial({
        firstTex: attrs.texStartIdx,
        textures: attrs.textures,
        useColor: false,
        sizes: imagePlot.sizes,
        canvasSize,
      }),
      geometry: {
        index: indx,
        drawRange: { start: 0, count: meshCells.length },
        attributes: omit(attrs, ['texStartIdx', 'texEndIdx', 'textures']),
      },
    });
  }
  return meshes;
};
