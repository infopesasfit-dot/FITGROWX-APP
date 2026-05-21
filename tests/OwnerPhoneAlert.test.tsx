import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { OwnerPhoneAlert } from '@/app/dashboard/components/OwnerPhoneAlert';

describe('OwnerPhoneAlert', () => {
  it('renders when ownerPhoneMissing=true and demoMode=false', () => {
    const { container } = render(<OwnerPhoneAlert ownerPhoneMissing={true} demoMode={false} />);
    expect(container.querySelector('a')).toBeTruthy();
    expect(container.textContent).toContain('Falta tu número de WhatsApp');
  });

  it('returns null when ownerPhoneMissing=false', () => {
    const { container } = render(<OwnerPhoneAlert ownerPhoneMissing={false} demoMode={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when demoMode=true', () => {
    const { container } = render(<OwnerPhoneAlert ownerPhoneMissing={true} demoMode={true} />);
    expect(container.firstChild).toBeNull();
  });
});
