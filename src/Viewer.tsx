import React, { useState, FC, useEffect, createElement } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { buildGroups, buildPlotData } from './utils/plot-utils';

const Box: FC<any> = () => {
  const [plot, setPlot] = useState({});
  const scene = useThree((state) => state.scene);

  const initFrame = async () => {
    const imagePlot = await buildPlotData();
    const group = buildGroups(imagePlot);
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
      <Box />
    </Canvas>
  );
};
export default Viewer;
