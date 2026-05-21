import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { OnboardingProgress } from '@/app/dashboard/components/OnboardingProgress';

describe('OnboardingProgress', () => {
  const mockOnEnterDemo = vi.fn();
  const incompleteSetup = { alumnos: true, planes: false, landing: false, whatsapp: false, pagos: false };
  const completeSetup = { alumnos: true, planes: true, landing: true, whatsapp: true, pagos: true };

  it('renders with incomplete setup', () => {
    const { container } = render(
      <OnboardingProgress demoMode={false} setup={incompleteSetup} onEnterDemo={mockOnEnterDemo} />
    );
    expect(container.querySelector('.dashboard-card')).toBeTruthy();
    expect(container.textContent).toContain('Creá un plan');
  });

  it('returns null with complete setup', () => {
    const { container } = render(
      <OnboardingProgress demoMode={false} setup={completeSetup} onEnterDemo={mockOnEnterDemo} />
    );
    expect(container.querySelector('.dashboard-card')).toBeFalsy();
  });

  it('returns null with demoMode=true', () => {
    const { container } = render(
      <OnboardingProgress demoMode={true} setup={incompleteSetup} onEnterDemo={mockOnEnterDemo} />
    );
    expect(container.querySelector('.dashboard-card')).toBeFalsy();
  });

  it('shows Continuar button with correct href when nextTask exists', () => {
    const { container } = render(
      <OnboardingProgress demoMode={false} setup={incompleteSetup} onEnterDemo={mockOnEnterDemo} />
    );
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/dashboard/membresias');
    expect(link?.textContent).toContain('Continuar');
  });
});
