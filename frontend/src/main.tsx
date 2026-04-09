import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";

import { createTheme, MantineProvider, type CSSVariablesResolver } from "@mantine/core";

const resolver: CSSVariablesResolver = () => ({
  variables: {},
  light: { '--mantine-color-body': '#f5f4f1' },
  dark: {},
});

const theme = createTheme({
  cssVariablesResolver: resolver,
  components: {
    Checkbox: {
      styles: {
        input: { cursor: 'pointer' },
        label: { cursor: 'pointer' },
      },
    },
    Chip: {
      styles: {
        label: { cursor: 'pointer' },
      },
    },
    Switch: {
      styles: {
        track: { cursor: 'pointer' },
        label: { cursor: 'pointer' },
      },
    },
  },
});
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <MantineProvider theme={theme} defaultColorScheme="dark">
    <ModalsProvider>
      <Notifications position="top-right" />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ModalsProvider>
  </MantineProvider>
);
