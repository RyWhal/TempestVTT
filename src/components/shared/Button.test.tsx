/// <reference types="vitest/globals" />

import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button } from './Button';

describe('Button', () => {
  it('renders label and handles clicks', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    const { getByRole } = render(<Button onClick={handleClick}>Roll</Button>);

    const button = getByRole('button', { name: 'Roll' });
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading state when isLoading is true', () => {
    const { getByText, getByRole } = render(<Button isLoading>Rolling...</Button>);

    expect(getByText('Loading...')).toBeInTheDocument();
    expect(getByRole('button')).toBeDisabled();
  });
});
