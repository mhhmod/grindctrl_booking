import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LEAD_PREVIEW_DATA, type LeadPreviewRecord } from '@/lib/dashboard/lead-preview-data';

const STATUS_VARIANT: Record<LeadPreviewRecord['status'], 'default' | 'secondary' | 'outline'> = {
  New: 'default',
  Qualified: 'secondary',
  'Needs follow-up': 'outline',
  'Implementation requested': 'outline',
  Closed: 'outline',
};

export function LeadsPreviewTable() {
  return (
    <Card>
      <CardHeader>
        <Badge variant="secondary" className="w-fit">CRM-ready preview</Badge>
        <CardTitle>Leads preview</CardTitle>
        <CardDescription>Connect HubSpot/Salesforce/Pipedrive/Sheets later.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Name / company</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detected need</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Next action</TableHead>
                <TableHead>Source channel</TableHead>
                <TableHead>Created time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LEAD_PREVIEW_DATA.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="text-sm text-muted-foreground">{lead.source}</TableCell>
                  <TableCell className="min-w-48 text-sm font-medium text-foreground">{lead.nameCompany}</TableCell>
                  <TableCell className="text-sm text-foreground">{lead.score}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[lead.status]}>{lead.status}</Badge>
                  </TableCell>
                  <TableCell className="min-w-52 text-sm text-foreground">{lead.detectedNeed}</TableCell>
                  <TableCell className="text-sm text-foreground">{lead.owner}</TableCell>
                  <TableCell className="min-w-56 text-sm text-muted-foreground">{lead.nextAction}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{lead.sourceChannel}</Badge>
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
