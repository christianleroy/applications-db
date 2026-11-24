import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';

const root = createRoot(document.getElementById('root')!);

async function start() {
  try {
    // Imported lazily so an invalid config throws here, where it can be shown.
    const { App } = await import('./App');
    root.render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    );
  } catch (e) {
    root.render(<pre>{e instanceof Error ? e.message : String(e)}</pre>);
  }
}

void start();
