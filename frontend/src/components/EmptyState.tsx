import { Stack, Text, ThemeIcon } from "@mantine/core";
import { type Icon } from "@tabler/icons-react";

export function EmptyState({ icon: IconComponent, message }: { icon: Icon; message: string }) {
  return (
    <Stack align="center" justify="center" h="calc(100vh - 200px)" gap="md">
      <ThemeIcon size={64} radius="xl" variant="light" color="gray">
        <IconComponent size={32} />
      </ThemeIcon>
      <Text c="dimmed" size="lg">{message}</Text>
    </Stack>
  );
}
