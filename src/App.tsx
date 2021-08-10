import './App.css';
import Viewer from './Viewer';
import { Stats } from '@react-three/drei';
function App() {
  return (
    <div className='canvas-holder'>
      <Stats showPanel={0} className='stats' />
      <Viewer />
    </div>
  );
}

export default App;
