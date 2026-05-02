import type React from 'react';

interface AnimatedCapabilityCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  index?: number;
}

export function AnimatedCapabilityCard({
  icon: Icon,
  label,
  description,
  index = 0,
}: AnimatedCapabilityCardProps) {
  return (
    <div
      className="gc-fade-in-up group relative overflow-hidden rounded-xl gc-glass p-5"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      {/* Subtle top gradient accent on hover */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-muted/60 transition-colors duration-300 group-hover:bg-primary/10">
        <Icon className="size-5 text-muted-foreground transition-colors duration-300 group-hover:text-primary" />
      </div>

      <h3 className="text-base font-semibold">{label}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
