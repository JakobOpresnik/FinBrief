import { AppShell, Group, Loader, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconReportMoney } from "@tabler/icons-react";
import { useState, useEffect } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { DashboardPage } from "./pages/DashboardPage";
import { RunPage } from "./pages/RunPage";
import { SchedulePage } from "./pages/SchedulePage";
import { PdfViewerPage } from "./pages/PdfViewerPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StatsPage } from "./pages/StatsPage";
import { api } from "./api";
import { PrivacyProvider } from "./context/PrivacyContext";

export function App() {
  const navigate = useNavigate();
  const [exiting, setExiting] = useState(false);

  const doExit = () => {
    setExiting(true);
    api.quit().catch(() => {});
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'q') {
        e.preventDefault();
        handleExit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleExit = async () => {
    const status = await api.getPipelineStatus().catch(() => null);
    if (status?.running) {
      modals.openConfirmModal({
        title: "Pipeline is running",
        children: (
          <Text size="sm">
            The pipeline is currently running. Exiting now will cancel it mid-way.
            Are you sure you want to exit?
          </Text>
        ),
        labels: { confirm: "Exit anyway", cancel: "Keep running" },
        confirmProps: { color: "#fa5252" },
        onConfirm: doExit,
      });
    } else {
      doExit();
    }
  };

  return (
    <PrivacyProvider>
      <AppShell navbar={{ width: 220, breakpoint: 0 }} padding="md">
        <AppShell.Navbar p="xs">
          <Group
            gap="xs"
            p="sm"
            mb="xs"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            <IconReportMoney size={24} color="var(--mantine-color-teal-5)" />
            <Text fw={700} size="lg">FinBrief</Text>
          </Group>
          <NavBar onExit={handleExit} />
        </AppShell.Navbar>
        <AppShell.Main>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/run" element={<RunPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/pdf/:index" element={<PdfViewerPage />} />
          </Routes>
        </AppShell.Main>
      </AppShell>

      {exiting && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          background: 'rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <Stack align="center" gap="md">
            <Loader size="lg" color="#fa5252" />
            <Text fw={600} size="lg" c="#fa5252">Exiting…</Text>
          </Stack>
        </div>
      )}
    </PrivacyProvider>
  );
}
