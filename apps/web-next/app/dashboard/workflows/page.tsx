import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const WORKFLOW_MODULES = [
  {
    title: 'Text AI',
    description: 'Automate text routing, classification, and response generation.',
    status: 'planned' as const,
  },
  {
    title: 'Voice AI',
    description: 'Transcribe, analyze, and route voice interactions in real-time.',
    status: 'planned' as const,
  },
  {
    title: 'Image & Video',
    description: 'Process visual inputs for analysis, tagging, and content generation.',
    status: 'planned' as const,
  },
  {
    title: 'File Processing',
    description: 'Extract, transform, and route data from documents and uploads.',
    status: 'planned' as const,
  },
  {
    title: 'Decision Routing',
    description: 'Build conditional logic trees that route operations based on AI confidence.',
    status: 'planned' as const,
  },
  {
    title: 'Human-in-the-Loop',
    description: 'Escalation workflows that bring humans in for review or approval.',
    status: 'planned' as const,
  },
] as const;

export default function WorkflowsPage() {
  return (
    <div className="grid min-w-0 gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Workflows</CardTitle>
            <Badge variant="secondary" className="text-xs">Coming soon</Badge>
          </div>
          <CardDescription>
            Build and manage AI automation workflows that connect your tools, route decisions, and execute actions across your operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOW_MODULES.map((mod) => (
              <div key={mod.title} className="rounded-xl border border-dashed bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{mod.title}</span>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {mod.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{mod.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-dashed bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              The workflow builder will let you visually connect AI modules, define triggers, and deploy automation pipelines.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
