import {
  ActionIcon,
  Button,
  Group,
  Loader,
  NumberInput,
  Paper,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconBell,
  IconCpu,
  IconDeviceFloppy,
  IconEye,
  IconEyeOff,
  IconFolder,
  IconLock,
  IconMail,
} from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useEffect, useState } from "react";
import { api } from "../api";

interface FieldDef {
  key: string;
  label: string;
  sensitive?: boolean;
  type?: "number";
  description?: string;
}

const SECTIONS: { title: string; icon: Icon; fields: FieldDef[] }[] = [
  {
    title: "Gmail (IMAP)",
    icon: IconMail,
    fields: [
      { key: "GMAIL_ADDRESS", label: "Email address" },
      { key: "GMAIL_APP_PASSWORD", label: "App password", sensitive: true },
      { key: "GMAIL_SENDER_FILTER", label: "Sender filter" },
      { key: "GMAIL_SUBJECT_KEYWORD", label: "Subject keyword" },
    ],
  },
  {
    title: "PDF",
    icon: IconLock,
    fields: [{ key: "PDF_PASSWORD", label: "PDF password", sensitive: true }],
  },
  {
    title: "Storage",
    icon: IconFolder,
    fields: [
      { key: "SAVE_BASE_PATH", label: "Save path" },
      { key: "EMPLOYEE_NAME", label: "Employee name" },
      { key: "EMPLOYEE_SURNAME", label: "Employee surname" },
      { key: "FILENAME_PATTERN", label: "Filename pattern", description: "Placeholders: {name}, {surname}, {month}, {year}, {month_num}" },
    ],
  },
  {
    title: "LLM (llama.cpp)",
    icon: IconCpu,
    fields: [
      { key: "LLM_MODEL_PATH", label: "Model path" },
      { key: "LLM_GPU_LAYERS", label: "GPU layers", type: "number" },
    ],
  },
  {
    title: "Notifications",
    icon: IconBell,
    fields: [{ key: "NTFY_TOPIC", label: "ntfy.sh topic" }],
  },
];

function SensitiveInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <TextInput
      label={label}
      type={visible ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      labelProps={{ style: { marginBottom: 6 } }}
      rightSection={
        <ActionIcon variant="subtle" onClick={() => setVisible((v) => !v)}>
          {visible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
        </ActionIcon>
      }
    />
  );
}

export function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const hasChanges = JSON.stringify(values) !== JSON.stringify(originalValues);

  useEffect(() => {
    api.getSettings()
      .then((res) => {
        setValues(res.values);
        setOriginalValues(res.values);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings(values);
      setOriginalValues(values);
      notifications.show({ title: "Settings saved", message: "Configuration updated", color: "#40c057" });
    } catch {
      notifications.show({ title: "Error", message: "Failed to save settings", color: "#fa5252" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <Stack>
      <Title order={2} mb="xs">Settings</Title>

      {SECTIONS.map((section) => (
        <Paper key={section.title} p="lg" radius="md" withBorder>
          <Group gap="xs" mb="md">
            <section.icon size={18} />
            <Title order={4}>{section.title}</Title>
          </Group>
          <Stack>
            {section.fields.map((field) =>
              field.sensitive ? (
                <SensitiveInput
                  key={field.key}
                  label={field.label}
                  value={values[field.key] ?? ""}
                  onChange={(val) => setValues({ ...values, [field.key]: val })}
                />
              ) : field.type === "number" ? (
                <NumberInput
                  key={field.key}
                  label={field.label}
                  value={Number(values[field.key]) || 0}
                  onChange={(v) => setValues({ ...values, [field.key]: String(v) })}
                  labelProps={{ style: { marginBottom: 6 } }}
                />
              ) : (
                <TextInput
                  key={field.key}
                  label={field.label}
                  description={field.description}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [field.key]: e.currentTarget.value })}
                  labelProps={{ style: { marginBottom: 6 } }}
                />
              )
            )}
          </Stack>
        </Paper>
      ))}

      <div style={{ position: "sticky", bottom: 0, paddingBlock: 12, background: "var(--mantine-color-body)", zIndex: 10 }}>
        <Group>
          <Button onClick={handleSave} loading={saving} disabled={!hasChanges} leftSection={<IconDeviceFloppy size={16} />}>
            Save Settings
          </Button>
          <Button variant="subtle" color="gray" disabled={!hasChanges} onClick={() => setValues(originalValues)}>
            Restore
          </Button>
        </Group>
      </div>
    </Stack>
  );
}
