import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LEAD_PREVIEW_DATA, type LeadPreviewRecord } from '@/lib/dashboard/lead-preview-data';
import { getLeadsPreviewCopy } from '@/lib/dashboard/dashboard-content-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

const STATUS_VARIANT: Record<LeadPreviewRecord['status'], 'default' | 'secondary' | 'outline'> = {
  New: 'default',
  Qualified: 'secondary',
  'Needs follow-up': 'outline',
  'Implementation requested': 'outline',
  Closed: 'outline',
};

export function LeadsPreviewTable({ locale = 'en' }: { locale?: SiteLocale }) {
  const c = getLeadsPreviewCopy(locale);

  return (
    <Card>
      <CardHeader>
        <Badge variant="secondary" className="w-fit">{c.badge}</Badge>
        <CardTitle>{c.title}</CardTitle>
        <CardDescription>{c.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                {c.columns.map((column) => <TableHead key={column}>{column}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {LEAD_PREVIEW_DATA.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="text-sm text-muted-foreground">{c.translate(lead.source)}</TableCell>
                  <TableCell className="min-w-48 text-sm font-medium text-foreground">{lead.nameCompany}</TableCell>
                  <TableCell className="text-sm text-foreground">{lead.score}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[lead.status]}>{c.translate(lead.status)}</Badge>
                  </TableCell>
                  <TableCell className="min-w-52 text-sm text-foreground">{lead.detectedNeed}</TableCell>
                  <TableCell className="text-sm text-foreground">{c.translate(lead.owner)}</TableCell>
                  <TableCell className="min-w-56 text-sm text-muted-foreground">{lead.nextAction}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.translate(lead.sourceChannel)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lead.createdTime}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
