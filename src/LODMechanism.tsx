import { useFrame, useThree } from '@react-three/fiber';
import { FC, useEffect, useRef } from 'react';
import { Mesh } from 'three';
import { CellGrid, ImagePlot, LODState, PlotCell } from './internal_types';
import {
  getNested,
  inRadius,
  setBuffer,
  toGridCoords,
} from './utils/computation-utils';
import { getLODCanvas, getTexture } from './utils/dom-utils';

interface LODMechanismProps {
  plotData: ImagePlot;
  meshGroup: any;
}

const getAllTexCoords = function (lodTexture: number, lodCell: number) {
  var coords = [];
  for (var y = 0; y < lodTexture / lodCell; y++) {
    for (var x = 0; x < lodTexture / lodCell; x++) {
      coords.push({ x: x * lodCell, y: y * lodCell });
    }
  }
  return coords;
};

const getLoDBaseState = ({
  sizes: { lodTexture, lodCell },
  grid,
}: ImagePlot): LODState => ({
  tex: getLODCanvas(lodTexture), // lod high res texture
  cell: getLODCanvas(lodCell),
  cellIdxToImage: {}, // image cache mapping cell idx to loaded image data
  grid: grid as CellGrid, // set by indexCells()
  minZ: 0.8, // minimum zoom level to update textures
  initialRadius: 1, // starting radius for LOD
  state: {
    openCoords: getAllTexCoords(lodTexture, lodCell), // array of unused x,y lod tex offsets
    camPos: { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY }, // grid coords of current camera position
    neighborsRequested: 0,
    gridPosToCoords: {}, // map from a x.y grid position to cell indices and tex offsets at that grid position
    cellIdxToCoords: {}, // map from a cell idx to that cell's x, y offsets in lod texture
    cellsToActivate: [], // list of cells cached in cellIdxToImage and ready to be added to lod texture
    fetchQueue: [], // list of images that need to be fetched and cached
    radius: 1, // current radius for LOD
  },
});

const LODMechanism: FC<LODMechanismProps> = ({ plotData, meshGroup }) => {
  const lodMeta = useRef(getLoDBaseState(plotData));
  const { camera, gl } = useThree();

  const updateGeometryAttributes = (attrs: string[]) => {
    meshGroup.current.children.forEach((mesh: Mesh) => {
      attrs.forEach(attr => {
        mesh.geometry.attributes[attr].needsUpdate = true;
      });
    });
  };

  const clear = function () {
    const { state } = lodMeta.current;
    Object.keys(state.gridPosToCoords).forEach(unloadGridPos);
    state.camPos = {
      x: Number.POSITIVE_INFINITY,
      y: Number.POSITIVE_INFINITY,
    };
    updateGeometryAttributes(['offset', 'textureIndex']);
    state.radius = lodMeta.current.initialRadius;
  };

  const activateCell = function (cell: PlotCell) {
    ['textureIndex', 'offset'].forEach(key => {
      setBuffer(
        key,
        meshGroup.current,
        cell.indexOfDrawCall,
        cell.indexInDrawCall,
        {
          textureIndex: -1,
          dx: lodMeta.current.state.cellIdxToCoords[cell.id].x,
          dy: lodMeta.current.state.cellIdxToCoords[cell.id].y,
        }
      );
    });
  };

  const deactivateCell = (cell: PlotCell) => {
    ['textureIndex', 'offset'].forEach(key => {
      setBuffer(key, meshGroup, cell.indexOfDrawCall, cell.indexInDrawCall, {
        textureIndex: cell.textureIndex,
        dx: cell.texturePosition.x,
        dy: cell.texturePosition.y,
      });
    });
  };

  const unloadGridPos = (gridPos: string) => {
    const { state } = lodMeta.current;

    // cache the texture coords for the grid key to be deleted
    var toUnload = state.gridPosToCoords[gridPos];

    // delete unloaded cell keys in the cellIdxToCoords map
    toUnload.forEach((coords: any) => {
      try {
        // deactivate the cell to update buffers and free this cell's spot
        deactivateCell(plotData.cells[coords.cellIdx]);
        delete state.cellIdxToCoords[coords.cellIdx];
      } catch (err) {}
    });

    // remove the old grid position from the list of active grid positions
    delete state.gridPosToCoords[gridPos];

    // free all cells previously assigned to the deleted grid position
    state.openCoords = state.openCoords.concat(toUnload);
  };

  const unload = () => {
    const {
      state: { gridPosToCoords, radius, camPos },
    } = lodMeta.current;
    Object.keys(gridPosToCoords).forEach(gridPos => {
      var split = gridPos.split('.');
      if (
        !inRadius(
          radius,
          { x: parseInt(split[0]), y: parseInt(split[1]) },
          camPos
        )
      ) {
        unloadGridPos(gridPos);
      }
    });
  };

  const addCellsToLodTexture = () => {
    var textureNeedsUpdate = false;
    // find and store the coords where each img will be stored in lod texture
    for (var i = 0; i < lodMeta.current.state.cellsToActivate.length; i++) {
      var cellIdx = lodMeta.current.state.cellsToActivate[0],
        cell = plotData.cells[cellIdx];
      lodMeta.current.state.cellsToActivate =
        lodMeta.current.state.cellsToActivate.slice(1);
      // if cell is already loaded or is too far from camera quit
      if (
        lodMeta.current.state.cellIdxToCoords[cellIdx] ||
        !inRadius(
          lodMeta.current.state.radius,
          cell.gridPosition,
          lodMeta.current.state.camPos
        )
      )
        continue;
      // return if there are no open coordinates in the LOD texture

      var coords = lodMeta.current.state.openCoords[0];
      lodMeta.current.state.openCoords =
        lodMeta.current.state.openCoords.slice(1);

      // if (!coords), the LOD texture is full
      if (coords) {
        textureNeedsUpdate = true;
        // gridKey is a combination of the cell's x and y positions in the grid
        var gridKey = cell.gridPosition.x + '.' + cell.gridPosition.y;
        // initialize lodMeta.current grid key in the grid position to coords map
        if (!lodMeta.current.state.gridPosToCoords[gridKey])
          lodMeta.current.state.gridPosToCoords[gridKey] = [];
        // add the cell data to the data stores
        lodMeta.current.state.gridPosToCoords[gridKey].push(
          Object.assign({}, coords, { cellIdx: cell.id })
        );

        lodMeta.current.state.cellIdxToCoords[cell.id] = coords;
        // draw the cell's image in a new canvas
        lodMeta.current.cell.ctx?.clearRect(
          0,
          0,
          plotData.sizes.lodCell,
          plotData.sizes.lodCell
        );
        lodMeta.current.cell.ctx?.drawImage(
          lodMeta.current.cellIdxToImage[cell.id],
          0,
          0
        );
        var tex = getTexture(lodMeta.current.cell.canvas);
        gl.copyTextureToTexture(
          coords as any,
          tex,
          lodMeta.current.tex.texture
        );
        // activate the cell to update tex index and offsets
        activateCell(cell);
      }
    }
    // only update the texture and attributes if the lod tex changed
    if (textureNeedsUpdate) {
      updateGeometryAttributes(['textureIndex', 'offset']);
    }
  };

  const fetchNextImage = function () {
    //TODO: improve
    // if the selection modal is displayed don't fetch additional images
    // if (lasso.displayed) return;
    // identfiy the next image to be loaded
    const { state } = lodMeta.current;
    const cellIdx = state.fetchQueue[0];
    state.fetchQueue = state.fetchQueue.slice(1);
    // if there was a cell index in the load queue, load that next image
    if (Number.isInteger(cellIdx)) {
      // if this image is in the cache
      if (lodMeta.current.cellIdxToImage[cellIdx]) {
        // if this image isn't already activated, add it to the list to activate
        if (!state.cellIdxToCoords[cellIdx]) {
          state.cellsToActivate = state.cellsToActivate.concat(cellIdx);
        }
        // this image isn't in the cache, so load and cache it
      } else {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          lodMeta.current.cellIdxToImage[cellIdx] = image;
          if (!state.cellIdxToCoords[cellIdx]) {
            state.cellsToActivate = state.cellsToActivate.concat(cellIdx);
          }
        };
        image.src =
          'http://localhost:8080/' + plotData.cells[cellIdx].thumbnailUrl;
      }
      // there was no image to fetch, so add neighbors to fetch queue if possible
    } else if (state.neighborsRequested < state.radius) {
      state.neighborsRequested = state.radius;
      for (
        var x = Math.floor(-state.radius * 1.5);
        x <= Math.ceil(state.radius * 1.5);
        x++
      ) {
        for (var y = -state.radius; y <= state.radius; y++) {
          var coords = [state.camPos.x + x, state.camPos.y + y],
            cellIndices = getNested(lodMeta.current.grid, coords, []).filter(
              (cellIdx: number) => {
                return !state.cellIdxToCoords[cellIdx];
              }
            );
          state.fetchQueue = state.fetchQueue.concat(cellIndices);
        }
      }
      if (state.openCoords && state.radius < 30) {
        state.radius++;
      }
    }
  };

  const updateGridPosition = () => {
    const { boundingBox, cells } = plotData;
    const lod = lodMeta.current;
    const camPos = toGridCoords(camera.position, boundingBox, cells.length);
    if (
      !lod.state.camPos ||
      lod.state.camPos.x !== camPos.x ||
      lod.state.camPos.y !== camPos.y
    ) {
      if (lod.state.radius > 1) {
        lod.state.radius = Math.ceil(lod.state.radius * 0.6);
      }
      lod.state.camPos = camPos;
      lod.state.neighborsRequested = 0;
      unload();
      if (camera.position.z < lod.minZ) {
        lod.state.fetchQueue = getNested(lod.grid, [camPos.x, camPos.y], []);
      }
    }
  };

  useFrame(() => {
    updateGridPosition();
    fetchNextImage();
    camera.position.z < lodMeta.current.minZ ? addCellsToLodTexture() : clear();
  });

  useEffect(() => {
    if (meshGroup.current?.children)
      meshGroup.current.children.forEach((mesh: Mesh) => {
        //@ts-expect-error
        mesh.material.uniforms.lodTexture = {
          type: 't',
          value: lodMeta.current.tex.texture,
        };
      });
  });

  return null;
};

export default LODMechanism;
