import React, { useState, FC, useEffect, createElement } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { buildGroups, buildPlotData } from './utils/plot-utils';
import { TrackballControls } from '@react-three/drei';

const Box: FC<any> = () => {
  const { scene, size } = useThree((state) => state);

  const initFrame = async () => {
    const imagePlot = await buildPlotData();
    const group = buildGroups(imagePlot, size);
    scene.add(group);
  };

  useEffect(() => {
    initFrame();
  }, []);

  return null;
};

const Viewer = () => {
  return (
    <Canvas>
      <TrackballControls
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          //@ts-expect-error
          MIDDLE: THREE.MOUSE.ZOOM,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
      />
      <Box />
    </Canvas>
  );
};
export default Viewer;
