import React, { useRef, useState, FC, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { loadFile } from './utils/api-utils';
import { ImageList, PlotManifest } from './external_types';
import { ImagePlot, PlotAtlas, PlotCell, PlotTexture } from './internal_types';
import { getWebglLimits } from './utils/gl-utils';
import { flatten, times } from 'lodash';
import {
  DEFAULT_BOUNDING_BOX,
  getAtlasOffset,
  getBoundingBox,
} from './utils/computation-utils';

//implement memoizing for utils

const buildCluster = async () => {
  const manifest: PlotManifest = await loadFile('output/data/manifest.json');
  const imageList: ImageList = await loadFile(manifest.imagelist);
  const glLimits = getWebglLimits();
  const atlasesPerTex =
    (glLimits.textureSize / manifest.config.sizes.atlas) ** 2;

  const imagePlot: ImagePlot = {
    atlasCount: imageList.atlas.count,
    atlasesPerTex,
    textureCount: Math.ceil(imageList.atlas.count / atlasesPerTex),
    textures: [],
    atlasSize: manifest.config.sizes.atlas,
    textureSize: glLimits.textureSize,
    cells: [],
    boundingBox: DEFAULT_BOUNDING_BOX(),
    glLimits,
    center: { x: 0, y: 0 },
  };

  // build textures
  times(imagePlot.textureCount, (textureIndex) => {
    const texture: PlotTexture = {
      atlases: [],
      atlasProgress: 0,
      id: textureIndex,
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
      };
      texture.atlases.push(atlas);
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
          imagePlot.atlasSize,
          imagePlot.textureSize
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
    })
  );
};

const Box: FC<any> = () => {
  const [plot, setPlot] = useState({});

  const initFrame = async () => {
    const imagePlot = await buildCluster();
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
