import { PerspectiveCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import ImageMesh from './ClusterVisualizer';
import { ImagePlot } from './internal_types';
import { buildPlotData } from './utils/plot-utils';

const Viewer = () => {
  const [plotData, setPlotData] = useState<ImagePlot>();

  const loadPlot = async () => {
    const plot = await buildPlotData();
    setPlotData(plot);
  };

  useEffect(() => {
    loadPlot();
  }, []);

  return (
    <Canvas
      gl={{
        antialias: true,
        autoClear: false,
        toneMapping: THREE.ReinhardToneMapping,
      }}
    >
      <PerspectiveCamera fov={75} near={0.001} far={10}>
        {plotData && (
          <>
            <ImageMesh plotData={plotData} />
          </>
        )}
      </PerspectiveCamera>
    </Canvas>
  );
};
export default Viewer;
