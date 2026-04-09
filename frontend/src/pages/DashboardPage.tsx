import {
  ActionIcon,
  Button,
  Checkbox,
  Chip,
  Code,
  CopyButton,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconBraces,
  IconCheck,
  IconCopy,
  IconFileTypePdf,
  IconFolderOpen,
  IconPencil,
  IconSelector,
  IconSortAscending,
  IconSortDescending,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { EmptyState } from '../components/EmptyState';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type SalaryRecord } from '../api';
import { usePrivacy } from '../context/PrivacyContext';
import { shortenLabel } from '../utils/labels';

function fmt(n: number): string {
  return n.toLocaleString('sl-SI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function colorizeJson(json: string): React.ReactNode[] {
  return json.split('\n').map((line, i) => {
    const colored = line
      .replace(/"([^"]+)":/g, '<span style="color:#82aaff">"$1"</span>:')
      .replace(/: "([^"]*)"/g, ': <span style="color:#c3e88d">"$1"</span>')
      .replace(/: (-?\d+\.?\d*)/g, ': <span style="color:#f78c6c">$1</span>')
      .replace(/: (true|false)/g, ': <span style="color:#ffcb6b">$1</span>')
      .replace(/: (null)/g, ': <span style="color:#676e95">$1</span>');
    return <div key={i} dangerouslySetInnerHTML={{ __html: colored }} />;
  });
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Paper p='md' radius='md' withBorder style={{ flex: 1 }}>
      <Text size='sm' c='dimmed'>
        {label}
      </Text>
      <Text size='xl' fw={700} c={color}>
        {value}
      </Text>
    </Paper>
  );
}

type SortField =
  | 'period'
  | 'gross_pay'
  | 'net_pay'
  | 'take_home'
  | 'total_bonuses'
  | 'total_deductions';
type SortDir = 'asc' | 'desc';

function sortRecords(
  records: SalaryRecord[],
  field: SortField,
  dir: SortDir,
): SalaryRecord[] {
  const sorted = [...records].sort((a, b) => {
    let cmp: number;
    if (field === 'period') {
      cmp = a.year !== b.year ? a.year - b.year : a.month - b.month;
    } else {
      cmp = a[field] - b[field];
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

export function DashboardPage() {
  const { mask } = usePrivacy();
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<SortField>('period');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [yearFilter, setYearFilter] = useState<string[]>([]);
  const [rawData, setRawData] = useState<string | null>(null);
  const [rawTitle, setRawTitle] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const navigate = useNavigate();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRecords = useCallback(async () => {
    const data = await api.getSalaryHistory();
    setRecords(data);
    if (data.length === 0) await api.clearLogs();
    return data;
  }, []);

  useEffect(() => {
    api
      .getSalaryHistory()
      .then(setRecords)
      .finally(() => setLoading(false));
  }, []);

  // Poll for updates while pipeline is running
  useEffect(() => {
    const checkAndPoll = async () => {
      const status = await api.getPipelineStatus();
      if (status.running && !pollRef.current) {
        pollRef.current = setInterval(fetchRecords, 3000);
      } else if (!status.running && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        fetchRecords();
      }
    };
    const statusInterval = setInterval(checkAndPoll, 2000);
    return () => {
      clearInterval(statusInterval);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchRecords]);

  const years = useMemo(() => {
    const y = [...new Set(records.map((r) => String(r.year)))].sort().reverse();
    return y;
  }, [records]);

  const filtered = useMemo(() => {
    let result = records;
    if (yearFilter.length > 0) {
      result = result.filter((r) => yearFilter.includes(String(r.year)));
    }
    return sortRecords(result, sortField, sortDir);
  }, [records, yearFilter, sortField, sortDir]);


  const allSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.index));

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.index)));
    }
  };

  const handleDelete = (index: number) => {
    modals.openConfirmModal({
      title: 'Delete report',
      children: (
        <Text size='sm'>
          Are you sure you want to delete this salary report? This will also
          remove the PDF file. This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: '#fa5252' },
      onConfirm: async () => {
        await api.deleteRecord(index);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
        fetchRecords();
        notifications.show({
          title: 'Deleted',
          message: 'Record removed',
          color: '#fa5252',
        });
      },
    });
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    modals.openConfirmModal({
      title: 'Delete multiple reports',
      children: (
        <Text size='sm'>
          Are you sure you want to delete {selected.size} salary {selected.size === 1 ? 'report' : 'reports'}? This
          will also remove the PDF files. This action cannot be undone.
        </Text>
      ),
      labels: {
        confirm: `Delete ${selected.size} ${selected.size === 1 ? 'report' : 'reports'}`,
        cancel: 'Cancel',
      },
      confirmProps: { color: '#fa5252' },
      onConfirm: async () => {
        await api.bulkDelete([...selected]);
        setSelected(new Set());
        fetchRecords();
        notifications.show({
          title: 'Deleted',
          message: `${selected.size} ${selected.size === 1 ? 'record' : 'records'} removed`,
          color: '#fa5252',
        });
      },
    });
  };

  const handleViewRaw = async (r: SalaryRecord) => {
    const data = await api.getSalaryRaw(r.index);
    setRawTitle(
      `${r.month_name_slovenian.charAt(0).toUpperCase() + r.month_name_slovenian.slice(1)} ${r.year}`,
    );
    setRawData(JSON.stringify(data, null, 2));
  };

  const handleSaveName = async (index: number) => {
    await api.renameSalary(index, editName);
    setEditingIndex(null);
    fetchRecords();
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = sortDir === 'asc' ? IconSortAscending : IconSortDescending;

  function SortableHeader({
    field,
    children,
    w,
  }: {
    field: SortField;
    children: React.ReactNode;
    w?: number;
  }) {
    const isActive = sortField === field;
    return (
      <Table.Th
        w={w}
        style={{
          textAlign: field === 'period' ? 'left' : 'right',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => toggleSort(field)}
      >
        <Group gap={4} justify={field === 'period' ? 'flex-start' : 'flex-end'}>
          {children}
          {isActive ? (
            <SortIcon size={14} />
          ) : (
            <IconSelector size={14} style={{ opacity: 0.3 }} />
          )}
        </Group>
      </Table.Th>
    );
  }

  if (loading) return <Loader />;

  const latest = filtered[0];

  return (
    <Stack>
      <Title order={2} mb="xs">Dashboard</Title>

      {records.length > 0 && latest && (
        <Group grow>
          <StatCard
            label='Latest Take-Home Pay'
            value={mask(`${fmt(latest.take_home)} €`)}
            color='#12b886'
          />
          <StatCard label='Latest Net Pay' value={mask(`${fmt(latest.net_pay)} €`)} />
          <StatCard
            label='Latest Gross Pay'
            value={mask(`${fmt(latest.gross_pay)} €`)}
          />
          <StatCard label='Records' value={String(records.length)} />
        </Group>
      )}

      {records.length === 0 ? (
        <EmptyState
          icon={IconFolderOpen}
          message='No salary records yet. Run the pipeline to process your first payslip.'
        />
      ) : (
        <>
          {/* Toolbar: filters + bulk actions */}
          <Group justify='space-between'>
            <Group>
              <Chip.Group multiple value={yearFilter} onChange={setYearFilter}>
                <Group gap={6}>
                  {years.map((year) => (
                    <Chip key={year} value={year} size='sm' variant='outline'>
                      {year}
                    </Chip>
                  ))}
                </Group>
              </Chip.Group>
            </Group>
            {selected.size > 0 && (
              <Group>
                <Text size='sm' c='dimmed'>
                  {selected.size} selected
                </Text>
                <Button
                  size='sm'
                  color='#fa5252'
                  variant='light'
                  leftSection={<IconTrash size={16} />}
                  onClick={handleBulkDelete}
                >
                  Delete selected
                </Button>
              </Group>
            )}
          </Group>
          <Table.ScrollContainer minWidth={700}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={32} p='xs'>
                    <Checkbox
                      checked={allSelected}
                      onChange={toggleAll}
                      size='xs'
                    />
                  </Table.Th>
                  <SortableHeader field='period' w={130}>
                    Period
                  </SortableHeader>
                  <SortableHeader field='gross_pay' w={100}>Gross</SortableHeader>
                  <SortableHeader field='net_pay' w={100}>Net</SortableHeader>
                  <SortableHeader field='total_deductions' w={110}>Deductions</SortableHeader>
                  <SortableHeader field='total_bonuses' w={100}>Bonuses</SortableHeader>
                  <SortableHeader field='take_home' w={110}>
                    <Text fw={700}>Take-Home</Text>
                  </SortableHeader>
                  <Table.Th w={70} p='xs' />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((r) => (
                      <Table.Tr key={`${r.year}-${r.month}`}>
                        <Table.Td
                          p='xs'
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={selected.has(r.index)}
                            onChange={() => toggleSelect(r.index)}
                            size='xs'
                          />
                        </Table.Td>
                        <Table.Td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          {editingIndex === r.index ? (
                            <Group gap={4} wrap='nowrap'>
                              <TextInput
                                size='xs'
                                value={editName}
                                onChange={(e) => setEditName(e.currentTarget.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveName(r.index);
                                  if (e.key === 'Escape') setEditingIndex(null);
                                }}
                                autoFocus
                                style={{ width: 140 }}
                              />
                              <ActionIcon size='xs' variant='subtle' color='#12b886' onClick={() => handleSaveName(r.index)}>
                                <IconCheck size={12} />
                              </ActionIcon>
                              <ActionIcon size='xs' variant='subtle' color='#868e96' onClick={() => setEditingIndex(null)}>
                                <IconX size={12} />
                              </ActionIcon>
                            </Group>
                          ) : (
                            <Group gap='xs' wrap='nowrap'>
                              {r.has_pdf && (
                                <IconFileTypePdf
                                  size={16}
                                  color='var(--mantine-color-red-6)'
                                  style={{ cursor: 'pointer', flexShrink: 0 }}
                                  onClick={() => navigate(`/pdf/${r.index}`)}
                                />
                              )}
                              <span
                                style={{ cursor: r.has_pdf ? 'pointer' : undefined }}
                                onClick={() => r.has_pdf && navigate(`/pdf/${r.index}`)}
                              >
                                {r.custom_name ||
                                  (r.month_name_slovenian.charAt(0).toUpperCase() +
                                    r.month_name_slovenian.slice(1) +
                                    ' ' +
                                    r.year)}
                              </span>
                              <ActionIcon
                                size='xs'
                                variant='subtle'
                                color='#868e96'
                                style={{ opacity: 0.35, flexShrink: 0 }}
                                onClick={() => {
                                  setEditingIndex(r.index);
                                  setEditName(
                                    r.custom_name ||
                                      r.month_name_slovenian.charAt(0).toUpperCase() +
                                        r.month_name_slovenian.slice(1) +
                                        ' ' +
                                        r.year,
                                  );
                                }}
                              >
                                <IconPencil size={11} />
                              </ActionIcon>
                            </Group>
                          )}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {mask(`${fmt(r.gross_pay)} €`)}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {mask(`${fmt(r.net_pay)} €`)}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {r.total_deductions > 0 ? (
                            <Tooltip
                              multiline
                              label={Object.entries(r.deductions).map(([k, v]) => (
                                <div key={k}>
                                  {shortenLabel(k)}: <b>{mask(`${fmt(v)} €`)}</b>
                                </div>
                              ))}
                            >
                              <span style={{ color: 'var(--mantine-color-red-6)' }}>{mask(`${fmt(r.total_deductions)} €`)}</span>
                            </Tooltip>
                          ) : (
                            '—'
                          )}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {r.total_bonuses > 0 ? (
                            <Tooltip
                              multiline
                              label={Object.entries(r.bonuses).map(([k, v]) => (
                                <div key={k}>
                                  {shortenLabel(k)}: <b>{mask(`${fmt(v)} €`)}</b>
                                </div>
                              ))}
                            >
                              <span>{mask(`${fmt(r.total_bonuses)} €`)}</span>
                            </Tooltip>
                          ) : (
                            '—'
                          )}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text fw={700} size='sm' c='#12b886'>
                            {mask(`${fmt(r.take_home)} €`)}
                          </Text>
                        </Table.Td>
                        <Table.Td
                          p='xs'
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                          <Group gap={8} wrap='nowrap' justify='flex-end'>
                            <ActionIcon
                              variant='subtle'
                              color='#868e96'
                              size='sm'
                              onClick={() => handleViewRaw(r)}
                            >
                              <IconBraces size={14} />
                            </ActionIcon>
                            <ActionIcon
                              variant='subtle'
                              color='#fa5252'
                              size='sm'
                              onClick={() => handleDelete(r.index)}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </>
      )}

      <Modal
        opened={rawData !== null}
        onClose={() => setRawData(null)}
        title={
          <Group justify='space-between' w='100%' pr='md'>
            <Text fw={600}>Raw data — {rawTitle}</Text>
            <CopyButton value={rawData ?? ''} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied!' : 'Copy JSON'} withArrow>
                  <ActionIcon variant='subtle' color={copied ? '#12b886' : '#868e96'} onClick={copy}>
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
        }
        size='xl'
      >
        <Code block style={{ whiteSpace: 'pre', fontSize: 12, maxHeight: '65vh', overflow: 'auto', display: 'block', userSelect: 'text' }}>
          {rawData && colorizeJson(rawData)}
        </Code>
      </Modal>
    </Stack>
  );
}
