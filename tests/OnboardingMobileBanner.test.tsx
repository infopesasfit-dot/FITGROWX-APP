import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { OnboardingMobileBanner } from '@/components/dashboard/OnboardingMobileBanner';

describe('OnboardingMobileBanner', () => {
  const mockOnOpenModal = vi.fn();
  const incompleteSetup = { alumnos: true, planes: false, landing: false, whatsapp: false, pagos: false };
  const completeSetup = { alumnos: true, planes: true, landing: true, whatsapp: true, pagos: true };

  it('renders with incomplete setup', () => {
    const { container } = render(
      <OnboardingMobileBanner demoMode={false} setup={incompleteSetup} onOpenModal={mockOnOpenModal} />
    );
    expect(container.querySelector('.dashboard-card')).toBeTruthy();
    expect(container.textContent).toContain('¡Casi listo!');
    expect(container.textContent).toContain('Te faltan 4 cosas');
  });

  it('returns null with complete setup', () => {
    const { container } = render(
      <OnboardingMobileBanner demoMode={false} setup={completeSetup} onOpenModal={mockOnOpenModal} />
    );
    expect(container.querySelector('.dashboard-card')).toBeFalsy();
  });

  it('returns null with demoMode=true', () => {
    const { container } = render(
      <OnboardingMobileBanner demoMode={true} setup={incompleteSetup} onOpenModal={mockOnOpenModal} />
    );
    expect(container.querySelector('.dashboard-card')).toBeFalsy();
  });

  it('calls onOpenModal when Continuar setup button clicked', () => {
    const { container } = render(
      <OnboardingMobileBanner demoMode={false} setup={incompleteSetup} onOpenModal={mockOnOpenModal} />
    );
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
    fireEvent.click(button!);
    expect(mockOnOpenModal).toHaveBeenCalledOnce();
  });
});
