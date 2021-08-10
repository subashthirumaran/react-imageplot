import React, { useState, FC, useEffect, createElement } from 'react';
import { Canvas, useThree, Vector3 } from '@react-three/fiber';
import * as THREE from 'three';
import { buildGroups, buildPlotData } from './utils/plot-utils';
import { TrackballControls, PerspectiveCamera } from '@react-three/drei';

const Box: FC<any> = () => {
  const { scene, size, camera, gl } = useThree((state) => state);
  const initFrame = async () => {
    const imagePlot = await buildPlotData();
    const group = buildGroups(imagePlot, size);
    console.log(group);
    scene.add(group);
  };

  useEffect(() => {
    scene.background = new THREE.Color(0xffffff);
    camera.position.set(0, 0, 2);
    camera.lookAt(0, 0, 2);
    initFrame();
  }, []);

  return null;
};

const Viewer = () => {
  return (
    <Canvas
      gl={{
        antialias: true,
        autoClear: false,
        toneMapping: THREE.ReinhardToneMapping,
      }}
    >
      <PerspectiveCamera fov={75} near={0.001} far={10}>
        <TrackballControls
          mouseButtons={{
            LEFT: THREE.MOUSE.PAN,
            //@ts-expect-error
            MIDDLE: THREE.MOUSE.ZOOM,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
        />
        <Box />
      </PerspectiveCamera>
    </Canvas>
  );
};
export default Viewer;
