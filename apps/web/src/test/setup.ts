import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Under full-suite load the 1s default for waitFor/findBy is too tight.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => cleanup());
