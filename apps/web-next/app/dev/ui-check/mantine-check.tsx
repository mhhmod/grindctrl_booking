'use client';

import * as React from 'react';
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Chip,
  Group,
  Indicator,
  Loader,
  Pagination,
  Progress,
  Radio,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Switch,
  Tabs,
  TextInput,
  ThemeIcon,
  Timeline,
} from '@mantine/core';
import { Check, Plus } from 'lucide-react';

/* Dev-only sheet of the Mantine controls the SaaS surfaces lean on, so the
   theme bridge can be checked in light, dark, LTR and RTL in one place. */
export function MantineThemeCheck() {
  const [segment, setSegment] = React.useState('week');
  return (
    <Stack gap="lg" data-testid="mantine-check">
      <Group gap="sm">
        <Button>Filled</Button>
        <Button variant="light">Light</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="default">Default</Button>
        <Button variant="subtle">Subtle</Button>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
        <Button color="red">Delete</Button>
        <ActionIcon aria-label="Add"><Plus size={16} /></ActionIcon>
        <ThemeIcon><Check size={16} /></ThemeIcon>
        <Avatar variant="filled">SA</Avatar>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        <TextInput label="Store name" placeholder="GrindCTRL demo store" />
        <TextInput label="Domain" defaultValue="demo store" error="Use a domain like store.myshopify.com" />
        <Select label="Plan" data={['Free', 'Launch', 'Growth']} defaultValue="Launch" />
        <SegmentedControl value={segment} onChange={setSegment} data={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
      </SimpleGrid>
      <Group gap="lg">
        <Checkbox label="Show download" defaultChecked />
        <Checkbox label="Unchecked" />
        <Switch label="AI replies" defaultChecked />
        <Radio.Group defaultValue="steps" name="loading">
          <Group gap="sm">
            <Radio value="steps" label="Steps" />
            <Radio value="bar" label="Bar" />
          </Group>
        </Radio.Group>
      </Group>
      <Group gap="sm">
        <Badge>Live</Badge>
        <Badge variant="light">Setup</Badge>
        <Badge variant="outline">Planned</Badge>
        <Badge color="red">Failed</Badge>
        <Chip defaultChecked>Arabic</Chip>
        <Indicator label="3" size={16}><Avatar>OM</Avatar></Indicator>
        <Loader size="sm" />
      </Group>
      <Progress.Root size="xl" aria-label="Usage">
        <Progress.Section value={64}><Progress.Label>64 jobs</Progress.Label></Progress.Section>
      </Progress.Root>
      <Pagination total={5} defaultValue={2} />
      <Stepper active={1} size="sm">
        <Stepper.Step label="Install" />
        <Stepper.Step label="Configure" />
        <Stepper.Step label="Go live" />
      </Stepper>
      <Timeline active={1} bulletSize={20}>
        <Timeline.Item bullet={<Check size={12} />} title="Shopper asked" />
        <Timeline.Item bullet={<Check size={12} />} title="Omar replied" />
      </Timeline>
      <Alert title="Heads up">Conversations older than 30 days are archived.</Alert>
      <Tabs defaultValue="overview" variant="pills">
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="inbox">Inbox</Tabs.Tab>
          <Tabs.Tab value="reports">Reports</Tabs.Tab>
        </Tabs.List>
      </Tabs>
    </Stack>
  );
}
