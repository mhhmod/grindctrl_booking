import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ConversationsPage() {
  return (
    <div className="grid min-w-0 gap-4">
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Conversations</CardTitle>
            <Badge variant="secondary" className="text-xs">Coming soon</Badge>
          </div>
          <CardDescription>
            Browse and search widget conversation logs, review AI interaction history, and audit response quality across your deployed widgets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-dashed bg-muted/30 p-5 text-center">
              <div className="text-2xl font-semibold text-muted-foreground/50">—</div>
              <div className="mt-1 text-xs text-muted-foreground">Total conversations</div>
            </div>
            <div className="rounded-xl border border-dashed bg-muted/30 p-5 text-center">
              <div className="text-2xl font-semibold text-muted-foreground/50">—</div>
              <div className="mt-1 text-xs text-muted-foreground">Messages today</div>
            </div>
            <div className="rounded-xl border border-dashed bg-muted/30 p-5 text-center">
              <div className="text-2xl font-semibold text-muted-foreground/50">—</div>
              <div className="mt-1 text-xs text-muted-foreground">Avg. resolution time</div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-dashed bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Conversation logs will populate here once your widget is live and handling interactions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
