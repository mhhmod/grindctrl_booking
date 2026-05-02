import { TrialPreviewHandoffCard } from '@/components/dashboard/trial-preview-handoff-card';
import { TrialWorkspaceActionsCard } from '@/components/dashboard/trial-workspace-actions-card';
import { TrialWorkspaceReadinessCard } from '@/components/dashboard/trial-workspace-readiness-card';

export default function DashboardOverviewPage() {
  return (
    <div className="grid min-w-0 gap-4">
      <TrialWorkspaceReadinessCard />
      <TrialPreviewHandoffCard />
      <TrialWorkspaceActionsCard />
    </div>
  );
}
