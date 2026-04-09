import {
  ActionIcon,
  Button,
  Group,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconDownload } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

export function PdfViewerPage() {
  const { index } = useParams<{ index: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [correctPassword, setCorrectPassword] = useState("");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.getSettings().then((res) => {
      setCorrectPassword(res.values["PDF_PASSWORD"] ?? "");
    });
  }, []);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const isCorrect = password === correctPassword && password.length > 0;

  // Auto-open PDF when correct password is typed
  useEffect(() => {
    if (isCorrect && !blobUrl && !loading) {
      setLoading(true);
      api.fetchPdf(Number(index), password)
        .then(setBlobUrl)
        .finally(() => setLoading(false));
    }
  }, [isCorrect, blobUrl, loading, index, password]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);

    const loadingId = notifications.show({
      title: "Downloading...",
      message: "Choose where to save your PDF",
      loading: true,
      autoClose: false,
      withCloseButton: false,
    });

    try {
      const result = await api.saveAs(Number(index), password);

      if (result.status === "cancelled") {
        notifications.update({
          id: loadingId,
          title: "Cancelled",
          message: "Download cancelled",
          color: "gray",
          loading: false,
          autoClose: 2000,
          withCloseButton: true,
        });
        return;
      }

      const savedPath = result.path!;

      notifications.update({
        id: loadingId,
        title: "Download complete",
        message: (
          <Button
            size="xs"
            variant="light"
            onClick={() => api.openFile(savedPath)}
          >
            Open PDF
          </Button>
        ),
        color: "green",
        loading: false,
        autoClose: false,
        withCloseButton: true,
      });
    } catch {
      notifications.update({
        id: loadingId,
        title: "Download failed",
        message: "Could not save the PDF",
        color: "red",
        loading: false,
        autoClose: 4000,
        withCloseButton: true,
      });
    } finally {
      setDownloading(false);
    }
  }, [index, password]);

  return (
    <Stack h="calc(100vh - 40px)">
      <Group>
        <ActionIcon variant="subtle" onClick={() => navigate("/")}>
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Title order={3}>Salary Document</Title>
        {blobUrl && (
          <Button
            variant="light"
            size="sm"
            ml="auto"
            leftSection={<IconDownload size={16} />}
            loading={downloading}
            onClick={handleDownload}
          >
            Download PDF
          </Button>
        )}
      </Group>

      {!blobUrl ? (
        <Paper p="xl" radius="md" withBorder maw={400}>
          <Stack>
            <Text size="sm">This document is password-protected.</Text>
            <PasswordInput
              label={<Text size="sm" mb={4}>PDF Password</Text>}
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
            {loading && <Loader size="sm" color="#12b886" />}
          </Stack>
        </Paper>
      ) : (
        <object
          data={blobUrl}
          type="application/pdf"
          style={{ flex: 1, borderRadius: 8, minHeight: "calc(100vh - 120px)" }}
        >
          <Text>PDF preview not available.</Text>
        </object>
      )}
    </Stack>
  );
}
