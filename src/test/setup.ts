import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// Date logic is local-day based; pin the zone so assertions don't depend on the machine.
// Individual tests may switch zones and rely on this reset.
beforeEach(() => {
  process.env.TZ = 'UTC';
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
