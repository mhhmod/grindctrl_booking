import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="grid min-w-0 gap-4">
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Settings</CardTitle>
            <Badge variant="secondary" className="text-xs">Coming soon</Badge>
          </div>
          <CardDescription>
            Workspace configuration, team member management, API keys, and platform preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Settings panel will be available in the next platform release.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
