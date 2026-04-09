import {
  Button,
  NumberInput,
  Paper,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useEffect, useState } from "react";
import { api, type ScheduleConfig } from "../api";

export function SchedulePage() {
  const [config, setConfig] = useState<ScheduleConfig>({
    enabled: false,
    day_of_month: 15,
    hour: 9,
    minute: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSchedule().then(setConfig);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSchedule(config);
      notifications.show({
        title: "Schedule saved",
        message: config.enabled
          ? `Pipeline will run on day ${config.day_of_month} at ${String(config.hour).padStart(2, "0")}:${String(config.minute).padStart(2, "0")}`
          : "Automatic pipeline runs disabled",
        color: "#40c057",
      });
    } catch {
      notifications.show({ title: "Error", message: "Failed to save schedule", color: "#fa5252" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack>
      <Title order={2} mb="xs">Schedule</Title>

      <Paper p="lg" radius="md" withBorder maw={400}>
        <Stack>
          <Switch
            label="Enable automatic pipeline runs"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.currentTarget.checked })}
            size="md"
          />

          <NumberInput
            label="Day of month"
            description="Run on this day every month"
            value={config.day_of_month}
            onChange={(v) => setConfig({ ...config, day_of_month: Number(v) || 15 })}
            min={1}
            max={28}
            disabled={!config.enabled}
          />

          <NumberInput
            label="Hour"
            value={config.hour}
            onChange={(v) => setConfig({ ...config, hour: Number(v) || 0 })}
            min={0}
            max={23}
            disabled={!config.enabled}
          />

          <NumberInput
            label="Minute"
            value={config.minute}
            onChange={(v) => setConfig({ ...config, minute: Number(v) || 0 })}
            min={0}
            max={59}
            disabled={!config.enabled}
          />

          <Button onClick={handleSave} loading={saving} leftSection={<IconDeviceFloppy size={16} />}>
            Save Schedule
          </Button>
        </Stack>
      </Paper>

      <Text size="sm" c="dimmed" maw={400}>
        The scheduler runs while the app is open. For background execution when the app is closed,
        use Windows Task Scheduler.
      </Text>
    </Stack>
  );
}
