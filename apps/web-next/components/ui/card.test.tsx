import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

describe('Card', () => {
  it('uses the Shadboard flat card grammar globally', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Metric title</CardTitle>
          <CardDescription>Metric description</CardDescription>
        </CardHeader>
        <CardContent>Metric content</CardContent>
      </Card>,
    );

    const card = screen.getByText('Metric title').closest('[data-slot="card"]');
    expect(card).toHaveClass('rounded-lg', 'border', 'bg-card', 'text-card-foreground');
    expect(card).not.toHaveClass('rounded-2xl', 'ring-1', 'shadow-sm');
    expect(screen.getByText('Metric description')).toHaveClass('text-sm', 'text-muted-foreground');
    expect(screen.getByText('Metric content')).toHaveClass('p-6', 'pt-0');
  });
});
