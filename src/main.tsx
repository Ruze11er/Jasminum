import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/quicksand/600.css';
import '@fontsource/quicksand/700.css';
import './design-system/tokens.css';
import { createAppRouter } from './app/router';
import { startDataServices } from './data/bootstrap';

const router = createAppRouter();
void startDataServices();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
