import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Cameras from './pages/Cameras';
import Streams from './pages/Streams';
import Settings from './pages/Settings';
import Debug from './pages/Debug';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/cameras" element={<Cameras />} />
        <Route path="/streams" element={<Streams />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/debug" element={<Debug />} />
        {/* Legacy route redirect */}
        <Route path="/logs" element={<Navigate to="/debug" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

export default App;
