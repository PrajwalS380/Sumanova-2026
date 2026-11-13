import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { OtpField } from './OtpField';

function Harness({ onComplete }: { onComplete: (v: string) => void }) {
  const [v, setV] = useState('');
  return <OtpField value={v} onChange={setV} onComplete={onComplete} />;
}

describe('OtpField', () => {
  it('accepts only digits, caps at 6 and fires onComplete once full', async () => {
    const done = vi.fn();
    render(<Harness onComplete={done} />);
    const input = screen.getByLabelText('Verification code');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    await userEvent.type(input, '12a34 5678');
    expect(input).toHaveValue('123456');
    expect(done).toHaveBeenCalledWith('123456');
  });
});
