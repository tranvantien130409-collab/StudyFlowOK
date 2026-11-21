import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initLanguageAutoTranslator } from './services/languageService.ts';
import './index.css';
import 'katex/dist/katex.min.css';

initLanguageAutoTranslator();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
