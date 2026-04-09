import {
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { AreaChart, BarChart, DonutChart } from '@mantine/charts';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconChartBar,
  IconCoin,
  IconMinus,
  IconReceipt,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { api, type SalaryRecord } from '../api';
import { EmptyState } from '../components/EmptyState';
import { usePrivacy } from '../context/PrivacyContext';
import { shortenLabel } from '../utils/labels';

function fmt(n: number): string {
  return n.toLocaleString('sl-SI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  diff,
}: {
  label: string;
  value: string;
  icon: typeof IconCoin;
  color: string;
  diff?: number;
}) {
  return (
    <Paper p='md' radius='md' withBorder>
      <Group justify='space-between' mb={4}>
        <Text
          size='xs'
          c='dimmed'
          tt='uppercase'
          fw={600}
          style={{ letterSpacing: 0.5 }}
        >
          {label}
        </Text>
        <ThemeIcon size={28} radius='md' variant='light' color={color}>
          <Icon size={16} />
        </ThemeIcon>
      </Group>
      <Text size='xl' fw={700}>
        {value}
      </Text>
      {diff !== undefined && (
        <Group gap={4} mt={4}>
          {diff > 0 ? (
            <IconArrowUpRight size={14} color='var(--mantine-color-teal-6)' />
          ) : diff < 0 ? (
            <IconArrowDownRight size={14} color='var(--mantine-color-red-6)' />
          ) : (
            <IconMinus size={14} color='var(--mantine-color-gray-5)' />
          )}
          <Text
            size='xs'
            c={diff > 0 ? '#12b886' : diff < 0 ? '#fa5252' : 'dimmed'}
            fw={500}
          >
            {diff > 0 ? '+' : ''}
            {fmt(diff)} € vs previous
          </Text>
        </Group>
      )}
    </Paper>
  );
}

export function StatsPage() {
  const { mask, hidden } = usePrivacy();
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getSalaryHistory()
      .then(setRecords)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;
  if (records.length === 0) {
    return (
      <Stack>
        <Title order={2} mb='xs'>
          Statistics
        </Title>
        <EmptyState
          icon={IconChartBar}
          message='No data yet. Process some payslips first.'
        />
      </Stack>
    );
  }

  const chronological = [...records].reverse();
  const latest = records[0];
  const previous = records.length > 1 ? records[1] : null;

  const avgTakeHome =
    records.reduce((s, r) => s + r.take_home, 0) / records.length;
  const avgNet = records.reduce((s, r) => s + r.net_pay, 0) / records.length;
  const avgGross =
    records.reduce((s, r) => s + r.gross_pay, 0) / records.length;
  const avgBonuses =
    records.reduce((s, r) => s + r.total_bonuses, 0) / records.length;
  const avgDeductions =
    records.reduce((s, r) => s + r.total_deductions, 0) / records.length;
  const totalEarned = records.reduce((s, r) => s + r.take_home, 0);

  const takeHomeDiff = previous
    ? latest.take_home - previous.take_home
    : undefined;
  const netDiff = previous ? latest.net_pay - previous.net_pay : undefined;
  const grossDiff = previous
    ? latest.gross_pay - previous.gross_pay
    : undefined;

  // Salary trend (area)
  const trendData = chronological.map((r) => ({
    period: `${r.month_name_slovenian.charAt(0).toUpperCase() + r.month_name_slovenian.slice(1, 3)} ${String(r.year).slice(2)}`,
    'Take-home': Number(r.take_home.toFixed(2)),
    Neto: Number(r.net_pay.toFixed(2)),
    Bruto: Number(r.gross_pay.toFixed(2)),
  }));

  // Monthly pay composition (stacked bar) — net + deductions + bonuses
  const barData = chronological.map((r) => ({
    period: `${r.month_name_slovenian.charAt(0).toUpperCase() + r.month_name_slovenian.slice(1, 3)} ${String(r.year).slice(2)}`,
    Neto: Number(r.net_pay.toFixed(2)),
    Odbitki: Number(r.total_deductions.toFixed(2)),
    Dodatki: Number(r.total_bonuses.toFixed(2)),
  }));

  // Deduction breakdown
  const deductionTotals: Record<string, number> = {};
  for (const r of records) {
    for (const [key, val] of Object.entries(r.deductions)) {
      deductionTotals[key] = (deductionTotals[key] || 0) + val;
    }
  }
  const deductionColors = [
    'red.6',
    'orange.5',
    'yellow.6',
    'pink.5',
    'grape.5',
    'violet.5',
    'indigo.5',
    'cyan.5',
  ];
  const deductionChart = Object.entries(deductionTotals)
    .map(([name, total], i) => ({
      name: shortenLabel(name),
      fullName: name,
      value: Number((total / records.length).toFixed(2)),
      color: deductionColors[i % deductionColors.length],
    }))
    .sort((a, b) => b.value - a.value);

  // Bonus breakdown
  const bonusTotals: Record<string, number> = {};
  for (const r of records) {
    for (const [key, val] of Object.entries(r.bonuses)) {
      bonusTotals[key] = (bonusTotals[key] || 0) + val;
    }
  }
  const bonusColors = ['teal.6', 'green.5', 'lime.5', 'cyan.5'];
  const bonusChart = Object.entries(bonusTotals)
    .map(([name, total], i) => ({
      name: shortenLabel(name),
      fullName: name,
      value: Number((total / records.length).toFixed(2)),
      color: bonusColors[i % bonusColors.length],
    }))
    .sort((a, b) => b.value - a.value);

  // Pay composition donut
  const compositionChart = [
    { name: 'Neto plača', value: Number(avgNet.toFixed(2)), color: 'teal.6' },
    { name: 'Dodatki', value: Number(avgBonuses.toFixed(2)), color: 'green.5' },
    {
      name: 'Odbitki',
      value: Number(avgDeductions.toFixed(2)),
      color: 'red.5',
    },
  ];

  // Net-to-gross ratio over time
  const ratioData = chronological.map((r) => ({
    period: `${r.month_name_slovenian.charAt(0).toUpperCase() + r.month_name_slovenian.slice(1, 3)} ${String(r.year).slice(2)}`,
    'Net/Gross %': Number(((r.net_pay / r.gross_pay) * 100).toFixed(1)),
  }));

  return (
    <Stack>
      <Title order={2}>Statistics</Title>

      {/* KPI cards */}
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <StatCard
          label='Latest take-home'
          value={mask(`${fmt(latest.take_home)} €`)}
          icon={IconCoin}
          color='#12b886'
          diff={hidden ? undefined : takeHomeDiff}
        />
        <StatCard
          label='Latest net'
          value={mask(`${fmt(latest.net_pay)} €`)}
          icon={IconReceipt}
          color='#228be6'
          diff={hidden ? undefined : netDiff}
        />
        <StatCard
          label='Average take-home'
          value={mask(`${fmt(avgTakeHome)} €`)}
          icon={IconTrendingUp}
          color='#7950f2'
        />
        <StatCard
          label='Total earned'
          value={mask(`${fmt(totalEarned)} €`)}
          icon={IconChartBar}
          color='#fd7e14'
        />
      </SimpleGrid>

      {/* Salary trend area chart */}
      <Paper p='lg' radius='md' withBorder>
        <Group justify='space-between' mb='md'>
          <Title order={4}>Salary Trend</Title>
          <Group gap='lg'>
            {[
              { name: 'Bruto', color: 'gray.5' },
              { name: 'Neto', color: 'blue.5' },
              { name: 'Take-home', color: 'teal.6' },
            ].map((s) => (
              <Group key={s.name} gap={5}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: `var(--mantine-color-${s.color.replace('.', '-')})`,
                    flexShrink: 0,
                  }}
                />
                <Text size='xs' c='dimmed'>
                  {s.name}
                </Text>
              </Group>
            ))}
          </Group>
        </Group>
        <AreaChart
          h={260}
          data={trendData}
          dataKey='period'
          series={[
            { name: 'Bruto', color: 'gray.5' },
            { name: 'Neto', color: 'blue.5' },
            { name: 'Take-home', color: 'teal.6' },
          ]}
          curveType='monotone'
          gridAxis='xy'
          withTooltip={false}
          yAxisProps={{ domain: [0, 'auto'], tickFormatter: hidden ? () => '••••' : undefined }}
          style={{ pointerEvents: 'none' }}
        />
      </Paper>

      {/* Monthly pay composition stacked bar */}
      <Paper p='lg' radius='md' withBorder>
        <Group justify='space-between' mb='md'>
          <Title order={4}>Pay Composition</Title>
          <Group gap='lg'>
            {[
              { name: 'Neto', color: 'teal.6' },
              { name: 'Odbitki', color: 'red.4' },
              { name: 'Dodatki', color: 'green.5' },
            ].map((s) => (
              <Group key={s.name} gap={5}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: `var(--mantine-color-${s.color.replace('.', '-')})`,
                    flexShrink: 0,
                  }}
                />
                <Text size='xs' c='dimmed'>
                  {s.name}
                </Text>
              </Group>
            ))}
          </Group>
        </Group>
        <BarChart
          h={260}
          data={barData}
          dataKey='period'
          type='stacked'
          series={[
            { name: 'Neto', color: 'teal.6' },
            { name: 'Odbitki', color: 'red.4' },
            { name: 'Dodatki', color: 'green.5' },
          ]}
          gridAxis='xy'
          withTooltip={false}
          yAxisProps={{ tickFormatter: hidden ? () => '••••' : undefined }}
          style={{ pointerEvents: 'none' }}
        />
      </Paper>

      {/* Net-to-Gross ratio */}
      <Paper p='lg' radius='md' withBorder>
        <Group justify='space-between' mb='md'>
          <Title order={4}>Net-to-Gross Ratio</Title>
          <Group gap={5}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--mantine-color-violet-5)',
                flexShrink: 0,
              }}
            />
            <Text size='xs' c='dimmed'>Net/Gross %</Text>
          </Group>
        </Group>
        <AreaChart
          h={200}
          data={ratioData}
          dataKey='period'
          series={[{ name: 'Net/Gross %', color: 'violet.5' }]}
          curveType='monotone'
          gridAxis='xy'
          withTooltip={false}
          yAxisProps={{ domain: [0, 100], tickFormatter: hidden ? () => '••' : undefined }}
          style={{ pointerEvents: 'none' }}
        />
      </Paper>

      {/* Donut charts */}
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Paper p='lg' radius='md' withBorder>
          <Title order={4} mb='xs'>
            Average Split
          </Title>
          <Text size='xs' c='dimmed' mb='md'>
            Net vs deductions vs bonuses
          </Text>
          <Group wrap='nowrap' align='flex-start' gap='xl'>
            <DonutChart
              h={200}
              w={200}
              data={compositionChart}
              withTooltip={false}
              style={{ pointerEvents: 'none' }}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                columnGap: 20,
                rowGap: 6,
                alignItems: 'center',
              }}
            >
              {compositionChart.map((d) => (
                <>
                  <div
                    key={`dot-${d.name}`}
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: `var(--mantine-color-${d.color.replace('.', '-')})`,
                    }}
                  />
                  <Text key={`lbl-${d.name}`} size='xs' c='dimmed'>
                    {d.name}
                  </Text>
                  <Text key={`val-${d.name}`} size='xs' ta='right' fw={700}>
                    {mask(`${fmt(d.value)} €`)}
                  </Text>
                </>
              ))}
            </div>
          </Group>
        </Paper>

        {deductionChart.length > 0 && (
          <Paper p='lg' radius='md' withBorder>
            <Title order={4} mb='xs'>
              Average Deductions
            </Title>
            <Text size='xs' c='dimmed' mb='md'>
              Average monthly deductions
            </Text>
            <Group wrap='nowrap' align='flex-start' gap='xl'>
              <DonutChart
                h={200}
                w={200}
                data={deductionChart}
                withTooltip={false}
                style={{ pointerEvents: 'none' }}
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  columnGap: 20,
                  rowGap: 6,
                  alignItems: 'center',
                }}
              >
                {deductionChart.map((d) => (
                  <>
                    <div
                      key={`dot-${d.name}`}
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: `var(--mantine-color-${d.color.replace('.', '-')})`,
                      }}
                    />
                    <Text key={`lbl-${d.name}`} size='xs' c='dimmed'>
                      {d.name}
                    </Text>
                    <Text key={`val-${d.name}`} size='xs' ta='right' fw={700}>
                      {mask(`${fmt(d.value)} €`)}
                    </Text>
                  </>
                ))}
              </div>
            </Group>
          </Paper>
        )}

        {bonusChart.length > 0 && (
          <Paper p='lg' radius='md' withBorder>
            <Title order={4} mb='xs'>
              Average Bonuses
            </Title>
            <Text size='xs' c='dimmed' mb='md'>
              Average monthly bonuses
            </Text>
            <Group wrap='nowrap' align='flex-start' gap='xl'>
              <DonutChart
                h={200}
                w={200}
                data={bonusChart}
                withTooltip={false}
                style={{ pointerEvents: 'none' }}
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  columnGap: 20,
                  rowGap: 6,
                  alignItems: 'center',
                }}
              >
                {bonusChart.map((d) => (
                  <>
                    <div
                      key={`dot-${d.name}`}
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: `var(--mantine-color-${d.color.replace('.', '-')})`,
                      }}
                    />
                    <Text key={`lbl-${d.name}`} size='xs' c='dimmed'>
                      {d.name}
                    </Text>
                    <Text key={`val-${d.name}`} size='xs' ta='right' fw={700}>
                      {mask(`${fmt(d.value)} €`)}
                    </Text>
                  </>
                ))}
              </div>
            </Group>
          </Paper>
        )}
      </SimpleGrid>
    </Stack>
  );
}
