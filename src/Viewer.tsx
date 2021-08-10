import React, { useRef, useState, FC, useEffect, createElement } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { loadFile } from './utils/api-utils';
import { ImageList, PlotManifest } from './external_types';
import { ImagePlot, PlotAtlas, PlotCell, PlotTexture } from './internal_types';
import { getShaderMaterial, getWebglLimits } from './utils/gl-utils';
import { flatten, times } from 'lodash';
import {
  DEFAULT_BOUNDING_BOX,
  getAtlasOffset,
  getBoundingBox,
  createElem,
  getGroupAttributes,
} from './utils/computation-utils';

//implement memoizing for utils

const buildCluster = async () => {
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
  times(imagePlot.textureCount, (textureIndex) => {
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
    times(texture.maxAtlasCount, (atlasIndex) => {
      const atlas: PlotAtlas = {
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
  times(imagePlot.atlasCount, (atlasIndex) => {
    times(imageList.cell_sizes[atlasIndex].length, (cellAtlasIndex) => {
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
          z: layout[globalCellIndex][2] || null,
        };

      const cell: PlotCell = {
        id: globalCellIndex,
        globalAtlasIndex: atlasIndex,
        indexWithinAtlas: cellAtlasIndex,
        textureIndex: Math.floor(atlasIndex / imagePlot.atlasesPerTex),
        indexOfDrawCall: Math.floor(globalCellIndex / glLimits.indexedElements),
        indexInDrawCall: globalCellIndex % glLimits.indexedElements,
        width: size[0],
        height: size[1],
        positionIn3d,
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
  imagePlot.center = {
    x: (imagePlot.boundingBox.x.min + imagePlot.boundingBox.x.max) / 2,
    y: (imagePlot.boundingBox.y.min + imagePlot.boundingBox.y.max) / 2,
  };
  await loadAtlasImages(imagePlot);
  return imagePlot;
};

const loadAtlasImages = async (imagePlot: ImagePlot) => {
  const atlases: PlotAtlas[] = flatten(
    imagePlot.textures.map((tex: PlotTexture) => tex.atlases)
  );

  var progress = 0,
    completed = 0;
  await Promise.all(
    atlases.map(async (atlas) => {
      console.log('start');
      console.time(atlas.url);
      const imageResponse = await loadFile(atlas.url);
      atlas.image = new Image();
      atlas.image.src = window.URL.createObjectURL(
        new Blob(imageResponse.data)
      );
      progress = (++completed / atlases.length) * 100;
      console.log(progress);
      console.timeEnd(atlas.url);
      imagePlot.textures[atlas.textureId].ctx.drawImage(
        atlas.image,
        atlas.positionOffsetInTexture.x,
        atlas.positionOffsetInTexture.y,
        imagePlot.sizes.atlas,
        imagePlot.sizes.atlas
      );
    })
  );
};

const Box: FC<any> = () => {
  const [plot, setPlot] = useState({});
  const scene = useThree((state) => state.scene);
  const constructPlotPoints = (imagePlot: ImagePlot) => {
    const drawCalls: PlotCell[][] = [];
    const group = new THREE.Group();
    imagePlot.cells.forEach((cell) => {
      if (!drawCalls[cell.indexOfDrawCall]) {
        drawCalls[cell.indexOfDrawCall] = [];
      }
      drawCalls[cell.indexOfDrawCall].push(cell);
    });
    for (const meshCells of drawCalls) {
      const attrs = getGroupAttributes(meshCells, imagePlot),
        geometry = new THREE.InstancedBufferGeometry();
      geometry.setIndex([0, 1, 2, 2, 3, 0]);
      geometry.setAttribute('position', attrs.position);
      geometry.setAttribute('uv', attrs.uv);
      geometry.setAttribute('translation', attrs.translation);
      geometry.setAttribute('targetTranslation', attrs.targetTranslation);
      geometry.setAttribute('color', attrs.color);
      geometry.setAttribute('width', attrs.width);
      geometry.setAttribute('height', attrs.height);
      geometry.setAttribute('offset', attrs.offset);
      geometry.setAttribute('opacity', attrs.opacity);
      geometry.setAttribute('selected', attrs.selected);
      geometry.setAttribute('clusterSelected', attrs.clusterSelected);
      geometry.setAttribute('textureIndex', attrs.textureIndex);
      geometry.setDrawRange(0, meshCells.length); // points not rendered unless draw range is specified
      var material = getShaderMaterial({
        firstTex: attrs.texStartIdx,
        textures: attrs.textures,
        useColor: false,
        sizes: imagePlot.sizes,
      });
      material.transparent = true;
      var mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    scene.add(group);
  };

  const initFrame = async () => {
    const imagePlot = await buildCluster();
    console.log(imagePlot);
    constructPlotPoints(imagePlot);
    setPlot(imagePlot);
  };

  useEffect(() => {
    initFrame();
  }, []);

  return null;
};

const Viewer = () => {
  return (
    <Canvas>
      <Box />
    </Canvas>
  );
};
export default Viewer;
