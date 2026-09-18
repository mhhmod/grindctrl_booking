import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConnectedJourneyRail } from '@/components/landing/connected-journey-rail';

describe('ConnectedJourneyRail', () => {
  it.each([
    ['Illustrative connected journey', ['Live try-on', 'Intent can be captured', 'Approved follow-up can run', 'Connected outcomes can be reported']],
    ['رحلة مترابطة توضيحية', ['تجربة افتراضية مباشرة', 'يمكن تسجيل الاهتمام', 'يمكن تشغيل متابعة معتمدة', 'يمكن إظهار النتائج عند الربط']],
  ])('labels the example and preserves every stage for %s', (label, stages) => {
    render(<ConnectedJourneyRail label={label} stages={stages} />);

    const journey = screen.getByRole('list', { name: label });
    expect(within(journey).getAllByRole('listitem')).toHaveLength(4);
    for (const stage of stages) expect(within(journey).getByText(stage)).toBeInTheDocument();
  });
});
