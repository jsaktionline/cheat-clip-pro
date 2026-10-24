import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// React Testing Library cleanup between tests.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
