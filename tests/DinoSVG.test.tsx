import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { DinoSVG } from '@/components/dashboard/DinoSVG';

describe('DinoSVG', () => {
  beforeEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  describe('Rendering', () => {
    it('renders flaco state', () => {
      const { container } = render(<DinoSVG state="flaco" />);
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.src).toContain('rex-state-one.png');
    });

    it('renders normal state', () => {
      const { container } = render(<DinoSVG state="normal" />);
      const img = container.querySelector('img');
      expect(img?.src).toContain('rex-state-two.png');
    });

    it('renders jacked state', () => {
      const { container } = render(<DinoSVG state="jacked" />);
      const img = container.querySelector('img');
      expect(img?.src).toContain('rex-state-final.png');
    });

    it('applies custom pixelSize', () => {
      const { container } = render(<DinoSVG state="flaco" pixelSize={12} />);
      const div = container.querySelector('div');
      expect(div?.style.width).toBe('192px'); // 12 * 16
      expect(div?.style.height).toBe('192px');
    });

    it('uses default pixelSize of 6', () => {
      const { container } = render(<DinoSVG state="flaco" />);
      const div = container.querySelector('div');
      expect(div?.style.width).toBe('96px'); // 6 * 16
      expect(div?.style.height).toBe('96px');
    });
  });

  describe('Animation on first render', () => {
    it('applies animation class on first render with flaco', () => {
      const { container } = render(<DinoSVG state="flaco" />);
      const animDiv = container.querySelector('.rex-sad');
      expect(animDiv).toBeTruthy();
    });

    it('applies animation class on first render with normal', () => {
      const { container } = render(<DinoSVG state="normal" />);
      const animDiv = container.querySelector('.rex-fight');
      expect(animDiv).toBeTruthy();
    });

    it('applies animation class on first render with jacked', () => {
      const { container } = render(<DinoSVG state="jacked" />);
      const animDiv = container.querySelector('.rex-celebrate');
      expect(animDiv).toBeTruthy();
    });

    it('saves state to localStorage after first render', () => {
      render(<DinoSVG state="flaco" />);
      expect(localStorage.getItem('dino_anim_done')).toBe('flaco');
    });
  });

  describe('Animation on re-render with same state', () => {
    it('skips animation class on second render with same state', () => {
      const { container, rerender } = render(<DinoSVG state="flaco" />);

      let animDiv = container.querySelector('.rex-sad');
      expect(animDiv).toBeTruthy();

      rerender(<DinoSVG state="flaco" />);

      animDiv = container.querySelector('.rex-sad');
      expect(animDiv).toBeFalsy();
    });

    it('no animation class on re-render when already played', () => {
      localStorage.setItem('dino_anim_done', 'normal');
      const { container } = render(<DinoSVG state="normal" />);
      const animDiv = container.querySelector('.rex-fight');
      expect(animDiv).toBeFalsy();
    });
  });

  describe('Animation on state change', () => {
    it('applies new animation class when state changes', () => {
      const { container, rerender } = render(<DinoSVG state="flaco" />);

      let animDiv = container.querySelector('.rex-sad');
      expect(animDiv).toBeTruthy();

      rerender(<DinoSVG state="normal" />);

      animDiv = container.querySelector('.rex-fight');
      expect(animDiv).toBeTruthy();
    });

    it('updates localStorage when state changes', () => {
      const { rerender } = render(<DinoSVG state="flaco" />);
      expect(localStorage.getItem('dino_anim_done')).toBe('flaco');

      rerender(<DinoSVG state="jacked" />);
      expect(localStorage.getItem('dino_anim_done')).toBe('jacked');
    });
  });

  describe('SSR safety (no localStorage)', () => {
    it('does not crash when localStorage is undefined', () => {
      const originalLocalStorage = global.localStorage;

      try {
        // @ts-expect-error - Testing SSR safety by deleting localStorage
        delete global.localStorage;

        expect(() => {
          render(<DinoSVG state="flaco" />);
        }).not.toThrow();
      } finally {
        global.localStorage = originalLocalStorage;
      }
    });

    it('applies animation when localStorage is unavailable (best effort)', () => {
      const originalLocalStorage = global.localStorage;

      try {
        // @ts-expect-error - Testing SSR safety by deleting localStorage
        delete global.localStorage;

        const { container } = render(<DinoSVG state="flaco" />);
        const animDiv = container.querySelector('.rex-sad');
        expect(animDiv).toBeTruthy();
      } finally {
        global.localStorage = originalLocalStorage;
      }
    });
  });

  describe('CSS injection', () => {
    it('injects DINO_CSS style tag', () => {
      const { container } = render(<DinoSVG state="flaco" />);
      const styleTag = container.querySelector('style');
      expect(styleTag).toBeTruthy();
      expect(styleTag?.textContent).toContain('@keyframes rex-sad');
      expect(styleTag?.textContent).toContain('@keyframes rex-fight');
      expect(styleTag?.textContent).toContain('@keyframes rex-celebrate');
    });
  });
});
