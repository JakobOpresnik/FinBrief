import {
  Divider,
  Group,
  List,
  Modal,
  NavLink,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useMantineColorScheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconChartLine,
  IconDashboard,
  IconPlayerPlay,
  IconCalendarEvent,
  IconSettings,
  IconPower,
  IconEye,
  IconEyeOff,
  IconSun,
  IconMoon,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePrivacy } from '../context/PrivacyContext';

const links = [
  { label: 'Dashboard', path: '/', icon: IconDashboard },
  { label: 'Statistics', path: '/stats', icon: IconChartLine },
  { label: 'Run Pipeline', path: '/run', icon: IconPlayerPlay },
  { label: 'Schedule', path: '/schedule', icon: IconCalendarEvent },
  { label: 'Settings', path: '/settings', icon: IconSettings },
];

const sections = [
  {
    title: '📊 Dashboard',
    description:
      'Lists all processed payslips. Click column headers to sort. Hover the Deductions or Bonuses cell to see a full breakdown. Click the PDF icon to open the original payslip.',
  },
  {
    title: '📈 Statistics',
    description:
      'Charts your salary history — trend over time, monthly pay composition, net-to-gross ratio, and average breakdowns of deductions and bonuses.',
  },
  {
    title: '▶ Run Pipeline',
    description:
      'Manually triggers the pipeline: connects to Gmail, finds new payslip emails, downloads and decrypts the PDF, extracts data with the local AI model, and saves the result.',
  },
  {
    title: '🗓 Schedule',
    description:
      'Configures automatic pipeline runs. Set the day of the month, hour, and minute — the app will run the pipeline in the background on that schedule.',
  },
  {
    title: '⚙️ Settings',
    description:
      'All configuration in one place: Gmail credentials, PDF password, file storage path, LLM model path, and push notification topic.',
  },
];

export function NavBar({ onExit }: { onExit: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { hidden, toggle } = usePrivacy();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [infoOpened, { open: openInfo, close: closeInfo }] = useDisclosure(false);

  // Ctrl+Shift+H → toggle number visibility
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  return (
    <>
      <Modal
        opened={infoOpened}
        onClose={closeInfo}
        title={<Text fw={700} size='lg'>About FinBrief</Text>}
        size='md'
      >
        <Stack gap='md'>
          <Text size='sm' c='dimmed'>
            FinBrief automates salary payslip processing. It monitors your Gmail for
            payslip emails, downloads and decrypts the PDF, extracts structured salary
            data using a local AI model running entirely on your machine, and tracks
            your full pay history with analytics — no cloud APIs involved.
          </Text>

          <Divider />

          <Title order={5}>Sections</Title>
          <List spacing='sm' size='sm'>
            {sections.map((s) => (
              <List.Item key={s.title}>
                <Text size='sm' fw={600} span>{s.title}</Text>
                <Text size='sm' c='dimmed'> — {s.description}</Text>
              </List.Item>
            ))}
          </List>

          <Divider />

          <Title order={5}>Keyboard shortcuts</Title>
          <Stack gap={4}>
            {[
              { keys: 'Ctrl+Shift+H', action: 'Toggle number visibility' },
              { keys: 'Ctrl+Q', action: 'Exit the app' },
            ].map(({ keys, action }) => (
              <Group key={keys} gap='xs'>
                <Text size='xs' ff='monospace'
                  style={{
                    background: 'var(--mantine-color-default)',
                    border: '1px solid var(--mantine-color-default-border)',
                    borderRadius: 4,
                    padding: '1px 6px',
                  }}
                >
                  {keys}
                </Text>
                <Text size='sm' c='dimmed'>{action}</Text>
              </Group>
            ))}
          </Stack>
        </Stack>
      </Modal>

      <Stack
        gap={0}
        mt='md'
        style={{ height: '100%', justifyContent: 'space-between' }}
      >
        <Stack gap={0}>
          {links.map((link) => (
            <NavLink
              key={link.path}
              label={link.label}
              leftSection={<link.icon size={20} />}
              active={location.pathname === link.path}
              onClick={() => navigate(link.path)}
            />
          ))}
        </Stack>
        <Stack gap={0}>
          <Group pl='sm' py={16} gap='lg'>
            <Tooltip label={colorScheme === 'dark' ? 'Light mode' : 'Dark mode'} position='right' withArrow>
              <UnstyledButton
                onClick={toggleColorScheme}
                style={{ display: 'flex', alignItems: 'center', color: 'var(--mantine-color-dimmed)' }}
              >
                {colorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
              </UnstyledButton>
            </Tooltip>
            <Tooltip label={hidden ? 'Show numbers (Ctrl+Shift+H)' : 'Hide numbers (Ctrl+Shift+H)'} position='right' withArrow>
              <UnstyledButton
                onClick={toggle}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: hidden ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-dimmed)',
                }}
              >
                {hidden ? <IconEye size={20} /> : <IconEyeOff size={20} />}
              </UnstyledButton>
            </Tooltip>
            <Tooltip label='About & help' position='right' withArrow>
              <UnstyledButton
                onClick={openInfo}
                style={{ display: 'flex', alignItems: 'center', color: 'var(--mantine-color-dimmed)' }}
              >
                <IconInfoCircle size={20} />
              </UnstyledButton>
            </Tooltip>
          </Group>
          <Divider mb={6} />
          <Tooltip label='Exit (Ctrl+Q)' position='right' withArrow>
            <NavLink
              label='Exit'
              leftSection={<IconPower size={20} />}
              c='#fa5252'
              onClick={onExit}
            />
          </Tooltip>
        </Stack>
      </Stack>
    </>
  );
}
