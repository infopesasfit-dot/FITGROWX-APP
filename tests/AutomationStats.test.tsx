import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AutomationStats } from '@/components/dashboard/AutomationStats';

// Mock useIsDesktop hook
vi.mock('@/hooks/useIsDesktop', () => ({
  useIsDesktop: vi.fn(),
}));

import { useIsDesktop } from '@/hooks/useIsDesktop';

const mockUseIsDesktop = useIsDesktop as ReturnType<typeof vi.fn>;

describe('AutomationStats', () => {
  const defaultProps = {
    mensajesAutoEnviados: 47,
    renovacionesCount: 31,
    recuperadosCount: 7,
    recuperadosRevenue: 126_000,
    selectedMonth: new Date(2026, 4, 21), // May 2026
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Mobile Version', () => {
    beforeEach(() => {
      mockUseIsDesktop.mockReturnValue(false);
    });

    it('renders mobile layout when useIsDesktop is false', () => {
      const { container } = render(<AutomationStats {...defaultProps} />);
      expect(container.querySelector('.dashboard-card')).toBeTruthy();
    });

    it('displays header with month label', () => {
      render(<AutomationStats {...defaultProps} />);
      expect(screen.getByText(/AUTOMATIZACIONES · MAYO/)).toBeTruthy();
    });

    it('displays all 4 stat labels in mobile version', () => {
      render(<AutomationStats {...defaultProps} />);
      expect(screen.queryByText('MENSAJES')).toBeTruthy();
      expect(screen.queryByText('RENOVAC.')).toBeTruthy();
      expect(screen.queryByText('RECUP.')).toBeTruthy();
      expect(screen.queryByText('AHORRADAS')).toBeTruthy();
    });

    it('displays correct stat values in mobile version', () => {
      render(<AutomationStats {...defaultProps} />);
      expect(screen.queryByText('47')).toBeTruthy(); // mensajesAutoEnviados
      expect(screen.queryByText('31')).toBeTruthy(); // renovacionesCount
      expect(screen.queryByText('7')).toBeTruthy();  // recuperadosCount (appears twice)
      // "7 hs" text rendered as "7 hs" in value field
      const tiempoText = screen.queryAllByText(/hs/);
      expect(tiempoText.length > 0).toBeTruthy();
    });

    it('displays recuperadosRevenue in green sub-text when > 0', () => {
      render(<AutomationStats {...defaultProps} />);
      // In mobile, sub-text is just the formatted amount
      const recoveryAmount = screen.queryByText(/\$126k/);
      expect(recoveryAmount).toBeTruthy();
    });

    it('does not show sub-text when recuperadosRevenue = 0 (mobile)', () => {
      render(
        <AutomationStats
          {...defaultProps}
          recuperadosRevenue={0}
        />
      );
      // In mobile with 0 revenue, no sub-text is shown
      const recoveryAmount = screen.queryByText(/\$/);
      // Should not find recovery amount
      expect(recoveryAmount).toBeFalsy();
    });
  });

  describe('Desktop Version', () => {
    beforeEach(() => {
      mockUseIsDesktop.mockReturnValue(true);
    });

    it('renders desktop layout when useIsDesktop is true', () => {
      const { container } = render(<AutomationStats {...defaultProps} />);
      expect(container.querySelector('.dashboard-card')).toBeTruthy();
    });

    it('displays header with month label (desktop)', () => {
      render(<AutomationStats {...defaultProps} />);
      expect(screen.getByText(/AUTOMATIZACIONES · MAYO/)).toBeTruthy();
    });

    it('displays all 4 card titles in desktop version', () => {
      render(<AutomationStats {...defaultProps} />);
      expect(screen.queryByText('MENSAJES ENVIADOS')).toBeTruthy();
      expect(screen.queryByText('RENOVACIONES')).toBeTruthy();
      expect(screen.queryByText('SOCIOS RECUPERADOS')).toBeTruthy();
      expect(screen.queryByText('TIEMPO AHORRADO')).toBeTruthy();
    });

    it('displays correct stat values in desktop version', () => {
      render(<AutomationStats {...defaultProps} />);
      expect(screen.queryByText('47')).toBeTruthy(); // mensajesAutoEnviados
      expect(screen.queryByText('31')).toBeTruthy(); // renovacionesCount
      expect(screen.queryByText('7')).toBeTruthy();  // recuperadosCount
    });

    it('displays recuperadosRevenue with "recuperados" label when > 0', () => {
      render(<AutomationStats {...defaultProps} />);
      // In desktop, text includes "recuperados"
      expect(screen.queryByText(/recuperados/)).toBeTruthy();
    });

    it('shows "sin recuperados aún" when recuperadosRevenue = 0 (desktop)', () => {
      render(
        <AutomationStats
          {...defaultProps}
          recuperadosRevenue={0}
        />
      );
      const noRecovery = screen.queryByText('sin recuperados aún');
      expect(noRecovery).toBeTruthy();
    });
  });

  describe('Month Label', () => {
    it('displays correct month name - January', () => {
      mockUseIsDesktop.mockReturnValue(false);
      render(<AutomationStats {...defaultProps} selectedMonth={new Date(2026, 0, 1)} />);
      expect(screen.queryByText(/ENERO/)).toBeTruthy();
    });

    it('displays correct month name - December', () => {
      mockUseIsDesktop.mockReturnValue(false);
      render(<AutomationStats {...defaultProps} selectedMonth={new Date(2026, 11, 1)} />);
      expect(screen.queryByText(/DICIEMBRE/)).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles zero horas ahorradas correctly', () => {
      mockUseIsDesktop.mockReturnValue(false);
      render(
        <AutomationStats
          {...defaultProps}
          mensajesAutoEnviados={0}
        />
      );
      expect(screen.queryByText('0 hs')).toBeTruthy();
    });

    it('handles large numbers in recuperadosRevenue', () => {
      mockUseIsDesktop.mockReturnValue(false);
      render(
        <AutomationStats
          {...defaultProps}
          recuperadosRevenue={1_200_000}
        />
      );
      // fmt() formats 1.2M as "$1.2M"
      expect(screen.queryByText(/\$1/)).toBeTruthy();
    });

    it('renders without crashing with all zero values', () => {
      mockUseIsDesktop.mockReturnValue(false);
      const { container } = render(
        <AutomationStats
          mensajesAutoEnviados={0}
          renovacionesCount={0}
          recuperadosCount={0}
          recuperadosRevenue={0}
          selectedMonth={new Date(2026, 4, 21)}
        />
      );
      expect(container).toBeTruthy();
    });
  });
});
