import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const INTEGRATION_CATEGORIES = [
  {
    title: 'CRM Systems',
    description: 'Sync leads, contacts, and deals with your CRM.',
    examples: 'HubSpot, Salesforce, Pipedrive',
  },
  {
    title: 'Google Workspace',
    description: 'Connect Gmail, Calendar, Drive, and Sheets.',
    examples: 'Gmail, Google Calendar, Google Sheets',
  },
  {
    title: 'Cloud Platforms',
    description: 'Push data and trigger workflows in your cloud stack.',
    examples: 'AWS, Azure, GCP',
  },
  {
    title: 'Communication',
    description: 'Route notifications and messages to your team channels.',
    examples: 'Slack, Teams, Email',
  },
  {
    title: 'Databases & Storage',
    description: 'Connect external databases and file storage providers.',
    examples: 'PostgreSQL, Airtable, S3',
  },
  {
    title: 'Webhooks & APIs',
    description: 'Custom integrations via webhooks and REST API endpoints.',
    examples: 'Custom webhooks, REST APIs',
  },
] as const;

export default function IntegrationsPage() {
  return (
    <div className="grid min-w-0 gap-4">
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Integrations</CardTitle>
            <Badge variant="secondary" className="text-xs">Coming soon</Badge>
          </div>
          <CardDescription>
            Connect your existing tools, CRMs, Google Workspace, cloud systems, and third-party services to GrindCTRL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRATION_CATEGORIES.map((cat) => (
              <div key={cat.title} className="rounded-xl border border-dashed bg-muted/30 p-4">
                <div className="text-sm font-medium">{cat.title}</div>
                <p className="mt-1 text-xs text-muted-foreground">{cat.description}</p>
                <div className="mt-2 text-[11px] text-muted-foreground/60">{cat.examples}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
