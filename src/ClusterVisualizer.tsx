import { TrackballControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import Lasso from './Lasso';
import LODMechanism from './LODMechanism';
import { buildGroups } from './utils/plot-utils';

const ImageMesh: any = ({ plotData, controls }: any) => {
  const { scene, size, camera } = useThree(state => state);
  const meshes = buildGroups(plotData, size);
  const groupRef = useRef();
  const controlsRef = useRef();

  useEffect(() => {
    scene.background = new THREE.Color(0x111111);
    camera.position.set(0, 0, 2);
    camera.lookAt(0, 0, 2);
  }, []);
  return (
    <>
      <TrackballControls
        //@ts-expect-error
        ref={controlsRef}
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.MIDDLE,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
      />
      <group ref={groupRef}>
        {meshes.map((meshData: any, id) => (
          <mesh key={id} frustumCulled={false}>
            <instancedBufferGeometry
              index={meshData.geometry.index}
              drawRange={meshData.geometry.drawRange}
              attributes={meshData.geometry.attributes}
            ></instancedBufferGeometry>
            <rawShaderMaterial transparent={true} args={[meshData.material]} />
          </mesh>
        ))}
      </group>
      <LODMechanism plotData={plotData} meshGroup={groupRef} />
      <Lasso
        meshGroup={groupRef}
        controls={controlsRef.current}
        enabled={true}
      />
    </>
  );
};

export default ImageMesh;
