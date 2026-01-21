import { EditorCanvas } from './components/editor/EditorCanvas';
import {JSX} from "react";

function App(): JSX.Element {

  return (
    <div className="w-screen h-screen bg-gray-900 text-white overflow-hidden">
      <EditorCanvas/>
    </div>
  );
}

export default App;
