import '@testing-library/jest-dom/vitest';

// jsdom ships a scrollTo stub that throws; replace with a harmless mock.
window.scrollTo = vi.fn();
