import { PerspectiveCamera, TrackballControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import React, { FC, useEffect, useState } from 'react';
import * as THREE from 'three';
import { buildGroups, buildPlotData } from './utils/plot-utils';

const Box: FC<any> = () => {
  const { scene, size, camera } = useThree(state => state);
  const [meshes, setMeshes] = useState([]);

  const initFrame = async () => {
    const imagePlot = await buildPlotData();
    const group = buildGroups(imagePlot, size);
    setMeshes(group as any);
  };

  useEffect(() => {
    scene.background = new THREE.Color(0x111111);
    camera.position.set(0, 0, 2);
    camera.lookAt(0, 0, 2);
    initFrame();
  }, []);

  return (
    <>
      {meshes.length && (
        <group>
          {meshes.map((meshData: any, id) => (
            <mesh key={id} frustumCulled={false}>
              <instancedBufferGeometry
                index={meshData.geometry.index}
                drawRange={meshData.geometry.drawRange}
                attributes={meshData.geometry.attributes}
              ></instancedBufferGeometry>
              <rawShaderMaterial
                transparent={true}
                args={[meshData.material]}
              />
            </mesh>
          ))}
        </group>
      )}
    </>
  );
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
