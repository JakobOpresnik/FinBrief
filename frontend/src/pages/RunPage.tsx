import {
  Badge,
  Button,
  Code,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Timeline,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconCloud,
  IconCpu,
  IconDeviceFloppy,
  IconMail,
  IconPaperclip,
  IconPlayerPlay,
  IconPlayerStop,
  IconStopwatch,
  IconTerminal,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type PipelineStatus } from '../api';

const STEPS = [
  { label: 'Connecting to Gmail', icon: IconCloud },
  { label: 'Searching for emails', icon: IconMail },
  { label: 'Processing attachments', icon: IconPaperclip },
  { label: 'Analyzing with AI', icon: IconCpu },
  { label: 'Saving & notifying', icon: IconDeviceFloppy },
];

type PipelineState = 'idle' | 'running' | 'cancelled' | 'succeeded' | 'failed';

function inferProgress(logs: string): { processed: number; total: number } {
  const totalMatch = new RegExp(/Found (\d+) emails matching/).exec(logs);
  const total = totalMatch ? Number.parseInt(totalMatch[1], 10) : 0;
  const processed = (logs.match(/Saved PDF/g) || []).length;
  return { processed, total };
}

function inferStep(logs: string): number {
  if (logs.includes('Done') || logs.includes('No new salary')) return 5;
  if (logs.includes('Saved PDF') || logs.includes('notification sent'))
    return 4;
  if (
    logs.includes('Extracted salary') ||
    logs.includes('Loading model') ||
    logs.includes('AI analysis')
  )
    return 3;
  if (logs.includes('Processing') || logs.includes('Downloaded attachment'))
    return 2;
  if (logs.includes('Searching')) return 1;
  if (logs.includes('Connect')) return 0;
  return -1;
}

export function RunPage() {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [logs, setLogs] = useState('');
  const [runLogs, setRunLogs] = useState('');
  const [polling, setPolling] = useState(false);
  const [elapsed, setElapsed] = useState(() => {
    const saved = sessionStorage.getItem('pipeline-elapsed');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [pipelineState, setPipelineState] = useState<PipelineState>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const logSnapshotRef = useRef(0);

  const fetchStatus = useCallback(async () => {
    const s = await api.getPipelineStatus();
    setStatus(s);
    return s;
  }, []);

  const fetchLogs = useCallback(async () => {
    const { logs: text } = await api.getLogs(80);
    setLogs(text);
    const lines = text.split('\n');
    const recentLines = lines.slice(logSnapshotRef.current);
    setRunLogs(recentLines.join('\n'));
  }, []);

  const startElapsedTimer = useCallback((startedAt: string | null) => {
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    if (!startedAt) return;
    const startTime = new Date(startedAt).getTime();
    const tick = () => {
      const v = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(v);
      sessionStorage.setItem('pipeline-elapsed', String(v));
    };
    tick();
    elapsedRef.current = setInterval(tick, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!sessionStorage.getItem('logs-cleared')) {
        await api.clearLogs();
        sessionStorage.setItem('logs-cleared', '1');
      }
      const s = await fetchStatus();
      if (s?.running) {
        setPipelineState('running');
        setPolling(true);
        startElapsedTimer(s.started_at);
      } else if (s?.last_result?.includes('cancelled')) {
        setPipelineState('cancelled');
      } else if (s?.last_result?.includes('failed')) {
        setPipelineState('failed');
      } else if (s?.last_result?.includes('success')) {
        setPipelineState('succeeded');
      } else {
        setPipelineState('idle');
      }
      fetchLogs();
    };
    init();
  }, [fetchStatus, fetchLogs, startElapsedTimer]);

  useEffect(() => {
    if (polling) {
      intervalRef.current = setInterval(async () => {
        const s = await fetchStatus();
        await fetchLogs();
        if (!s.running) {
          setPolling(false);
          if (elapsedRef.current) clearInterval(elapsedRef.current);
          const isFail =
            s.last_result?.includes('failed') ||
            s.last_result?.includes('cancelled');
          setPipelineState(isFail ? 'failed' : 'succeeded');
          notifications.show({
            title: 'Pipeline finished',
            message: s.last_result ?? 'Done',
            color: isFail ? '#fa5252' : '#40c057',
          });
        }
      }, 1500);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [polling, fetchStatus, fetchLogs]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [logs]);

  const isRunning = status?.running ?? false;
  const activeStep = useMemo(() => inferStep(runLogs), [runLogs]);
  const progress = useMemo(() => inferProgress(runLogs), [runLogs]);

  const handleRun = async () => {
    setElapsed(0);
    sessionStorage.removeItem('pipeline-elapsed');
    logSnapshotRef.current = logs.split('\n').length;
    setRunLogs('');
    setPipelineState('running');
    await api.runPipeline();
    setPolling(true);
    const s = await fetchStatus();
    startElapsedTimer(s.started_at);
  };

  const handleCancel = async () => {
    await api.cancelPipeline();
    setPolling(false);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    setPipelineState('cancelled');
    await fetchStatus();
    await fetchLogs();
    notifications.show({
      title: 'Pipeline cancelled',
      message: 'The pipeline was stopped',
      color: '#fa5252',
    });
  };

  const handleClearLogs = async () => {
    await api.clearLogs();
    setLogs('');
    setRunLogs('');
    logSnapshotRef.current = 0;
  };

  const formatTime = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const stateColor: Record<PipelineState, string> = {
    idle: '#868e96',
    running: '#12b886',
    succeeded: '#12b886',
    cancelled: '#fa5252',
    failed: '#fa5252',
  };

  const stateLabel: Record<PipelineState, string> = {
    idle: 'Idle',
    running: 'Running',
    succeeded: 'Completed',
    cancelled: 'Cancelled',
    failed: 'Failed',
  };

  const timelineColor = stateColor[pipelineState];

  return (
    <Stack>
      <Title order={2} mb="xs">Run Pipeline</Title>

      <Group>
        {!isRunning ? (
          <Button
            size='md'
            leftSection={<IconPlayerPlay size={20} />}
            onClick={handleRun}
          >
            {pipelineState === 'cancelled'
              ? 'Restart Pipeline'
              : 'Run Pipeline Now'}
          </Button>
        ) : (
          <>
            <Button size='md' loading loaderProps={{ color: 'white' }} disabled>
              Running...
            </Button>
            <Button
              size='md'
              color='#fa5252'
              variant='light'
              leftSection={<IconPlayerStop size={20} />}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </>
        )}
        {elapsed > 0 && (
          <Group gap={4}>
            <IconStopwatch size={16} color='var(--mantine-color-dimmed)' />
            <Text size='sm' c='dimmed'>{formatTime(elapsed)}</Text>
          </Group>
        )}
      </Group>

      <Group align='flex-start' grow>
        <Paper p='md' radius='md' withBorder maw={300}>
          <Group justify='space-between' mb='md'>
            <Badge color={timelineColor} variant='light' size='sm'>
              {stateLabel[pipelineState]}
            </Badge>
          </Group>
          <Timeline
            active={
              pipelineState === 'running'
                ? activeStep
                : pipelineState === 'succeeded'
                  ? 5
                  : -1
            }
            bulletSize={28}
            lineWidth={2}
            color={timelineColor}
          >
            {STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const allDone = pipelineState === 'succeeded';
              const completed =
                allDone || (pipelineState === 'running' && i < activeStep);
              const active = pipelineState === 'running' && i === activeStep;
              const isCancelled =
                pipelineState === 'cancelled' && i <= activeStep && i >= 0;
              const isCancelledActive =
                pipelineState === 'cancelled' && i === activeStep;

              let bullet;
              if (completed) {
                bullet = (
                  <ThemeIcon size={28} radius='xl' color='#12b886'>
                    <IconCheck size={14} />
                  </ThemeIcon>
                );
              } else if (isCancelledActive) {
                bullet = (
                  <ThemeIcon size={28} radius='xl' color='#fa5252'>
                    <IconX size={14} />
                  </ThemeIcon>
                );
              } else if (isCancelled && i < activeStep) {
                bullet = (
                  <ThemeIcon size={28} radius='xl' color='#12b886'>
                    <IconCheck size={14} />
                  </ThemeIcon>
                );
              } else if (active) {
                bullet = (
                  <ThemeIcon size={28} radius='xl' color='#12b886'>
                    <Loader size={16} color='#ffffff' />
                  </ThemeIcon>
                );
              } else {
                bullet = (
                  <ThemeIcon size={28} radius='xl' variant='default'>
                    <StepIcon size={14} />
                  </ThemeIcon>
                );
              }

              let textColor: string;
              if (completed) textColor = 'teal';
              else if (isCancelledActive) textColor = 'red';
              else if (isCancelled && i < activeStep) textColor = 'teal';
              else if (active) textColor = '';
              else textColor = 'dimmed';

              return (
                <Timeline.Item
                  key={step.label}
                  title={
                    <Group gap={6}>
                      <Text
                        size='sm'
                        fw={active ? 600 : 400}
                        c={textColor || undefined}
                      >
                        {step.label}
                        {isCancelledActive && ' — cancelled'}
                      </Text>
                      {i === 3 && isRunning && progress.total > 0 && (
                        <Text size='xs' c='dimmed'>
                          {progress.processed}/{progress.total}
                        </Text>
                      )}
                    </Group>
                  }
                  bullet={bullet}
                />
              );
            })}
          </Timeline>
        </Paper>

        <Stack style={{ flex: 1 }}>
          {status?.last_run && !isRunning && (
            <Group gap='xs'>
              <Text size='sm' c='dimmed'>
                Last run:{' '}
                {new Date(status.last_run).toLocaleString('sl-SI', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              <Badge
                color={
                  status.last_result?.includes('failed') ||
                  status.last_result?.includes('cancelled')
                    ? 'red'
                    : 'green'
                }
                variant='light'
                size='sm'
              >
                {status.last_result}
              </Badge>
            </Group>
          )}

          <Group justify='space-between'>
            <Group gap='xs'>
              <IconTerminal size={18} />
              <Title order={4}>Logs</Title>
            </Group>
            <Button
              size='xs'
              variant='subtle'
              color='#868e96'
              leftSection={<IconTrash size={14} />}
              onClick={handleClearLogs}
              disabled={isRunning || !logs}
            >
              Clear
            </Button>
          </Group>
          <ScrollArea h={500} viewportRef={scrollRef}>
            <Code block style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {logs || 'No logs yet.'}
            </Code>
          </ScrollArea>
        </Stack>
      </Group>
    </Stack>
  );
}
