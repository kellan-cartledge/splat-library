import { Routes, Route } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import Layout from './components/Layout/Layout';
import HomePage from './pages/HomePage';
import GalleryPage from './pages/GalleryPage';
import ScenePage from './pages/ScenePage';
import UploadPage from './pages/UploadPage';

export default function App() {
  return (
    <Authenticator.Provider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/scene/:id" element={<ScenePage />} />
          <Route path="/upload" element={<UploadPage />} />
        </Routes>
      </Layout>
    </Authenticator.Provider>
  );
}
