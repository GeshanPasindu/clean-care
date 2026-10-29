import { createTheme } from "@mui/material/styles";
import { createContext, useMemo, useState } from "react";

const lightPalette = {
  background: "#f6f7fb",
  surface: "#ffffff",
  surfaceMuted: "#f8fafc",
  text: "#172033",
  textMuted: "#667085",
  border: "#e4e7ec",
  primary: "#4f46e5",
  primaryDark: "#4338ca",
  secondary: "#0ea5e9",
  success: "#12b76a",
  warning: "#f79009",
  error: "#f04438",
};

const darkPalette = {
  background: "#0b1120",
  surface: "#111827",
  surfaceMuted: "#172033",
  text: "#f8fafc",
  textMuted: "#98a2b3",
  border: "#273244",
  primary: "#818cf8",
  primaryDark: "#6366f1",
  secondary: "#38bdf8",
  success: "#32d583",
  warning: "#fdb022",
  error: "#f97066",
};

// Kept for compatibility with the existing pages while all colors now come
// from one modern, accessible palette.
export const tokens = (mode) => {
  const palette = mode === "dark" ? darkPalette : lightPalette;

  return {
    grey: {
      100: palette.text,
      200: palette.text,
      300: palette.textMuted,
      400: palette.textMuted,
      500: palette.textMuted,
      600: palette.border,
      700: palette.border,
      800: palette.surfaceMuted,
      900: palette.surface,
    },
    primary: {
      100: palette.text,
      200: palette.textMuted,
      300: palette.surfaceMuted,
      400: palette.surface,
      500: palette.background,
      600: palette.surfaceMuted,
      700: palette.border,
      800: palette.textMuted,
      900: palette.text,
    },
    greenAccent: {
      100: palette.success,
      200: palette.success,
      300: palette.success,
      400: palette.success,
      500: palette.success,
      600: palette.success,
      700: mode === "dark" ? "#183c32" : "#ecfdf3",
      800: palette.success,
      900: palette.success,
    },
    redAccent: {
      100: palette.error,
      200: palette.error,
      300: palette.error,
      400: palette.error,
      500: palette.error,
      600: palette.error,
      700: palette.error,
      800: palette.error,
      900: palette.error,
    },
    blueAccent: {
      100: palette.primary,
      200: palette.primary,
      300: palette.primary,
      400: palette.primary,
      500: palette.primary,
      600: palette.primaryDark,
      700: palette.primaryDark,
      800: palette.primaryDark,
      900: palette.primaryDark,
    },
  };
};

export const themeSettings = (mode) => {
  const palette = mode === "dark" ? darkPalette : lightPalette;

  return {
    palette: {
      mode,
      primary: {
        main: palette.primary,
        dark: palette.primaryDark,
        contrastText: "#ffffff",
      },
      secondary: {
        main: palette.secondary,
      },
      success: {
        main: palette.success,
      },
      warning: {
        main: palette.warning,
      },
      error: {
        main: palette.error,
      },
      neutral: {
        dark: palette.text,
        main: palette.textMuted,
        light: palette.border,
      },
      background: {
        default: palette.background,
        paper: palette.surface,
      },
      text: {
        primary: palette.text,
        secondary: palette.textMuted,
      },
      divider: palette.border,
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: ['"Inter"', '"Segoe UI"', "sans-serif"].join(","),
      fontSize: 14,
      h1: { fontSize: "2.25rem", fontWeight: 700, letterSpacing: "-0.04em" },
      h2: { fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.03em" },
      h3: { fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.02em" },
      h4: { fontSize: "1.125rem", fontWeight: 650 },
      h5: { fontSize: "0.9375rem", fontWeight: 600 },
      h6: { fontSize: "0.875rem", fontWeight: 600 },
      button: { fontWeight: 650 },
    },
    shadows: [
      "none",
      "0 1px 2px rgba(16, 24, 40, 0.04)",
      "0 2px 8px rgba(16, 24, 40, 0.06)",
      "0 4px 12px rgba(16, 24, 40, 0.08)",
      "0 8px 24px rgba(16, 24, 40, 0.08)",
      ...Array(20).fill("0 12px 32px rgba(16, 24, 40, 0.12)"),
    ],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: palette.background,
            color: palette.text,
          },
          "*": {
            boxSizing: "border-box",
          },
          "*::selection": {
            backgroundColor: mode === "dark" ? "#3730a3" : "#c7d2fe",
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            minHeight: 42,
            borderRadius: 10,
            padding: "9px 16px",
            textTransform: "none",
            fontSize: "0.875rem",
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.primaryDark} 100%)`,
            boxShadow: mode === "dark" ? "none" : "0 6px 14px rgba(79, 70, 229, 0.22)",
            "&:hover": {
              boxShadow: mode === "dark" ? "none" : "0 8px 18px rgba(79, 70, 229, 0.3)",
            },
          },
          outlined: {
            borderColor: palette.border,
            color: palette.text,
            "&:hover": {
              borderColor: palette.primary,
              backgroundColor: mode === "dark" ? "rgba(129, 140, 248, 0.08)" : "#f5f3ff",
            },
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: "outlined",
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            minHeight: 46,
            borderRadius: 10,
            backgroundColor: palette.surface,
            transition: "box-shadow 160ms ease, border-color 160ms ease",
            "& fieldset": {
              borderColor: palette.border,
            },
            "&:hover fieldset": {
              borderColor: palette.textMuted,
            },
            "&.Mui-focused": {
              boxShadow: `0 0 0 3px ${mode === "dark" ? "rgba(129, 140, 248, 0.18)" : "rgba(79, 70, 229, 0.12)"}`,
            },
            "&.Mui-focused fieldset": {
              borderColor: palette.primary,
              borderWidth: 1,
            },
          },
          input: {
            padding: "12px 14px",
          },
        },
      },
      MuiFilledInput: {
        styleOverrides: {
          root: {
            minHeight: 46,
            border: `1px solid ${palette.border}`,
            borderRadius: "10px !important",
            backgroundColor: `${palette.surface} !important`,
            overflow: "hidden",
            "&:before, &:after": {
              display: "none",
            },
            "&:hover": {
              borderColor: palette.textMuted,
            },
            "&.Mui-focused": {
              borderColor: palette.primary,
              boxShadow: `0 0 0 3px ${mode === "dark" ? "rgba(129, 140, 248, 0.18)" : "rgba(79, 70, 229, 0.12)"}`,
            },
          },
          input: {
            padding: "14px",
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: palette.textMuted,
            "&.Mui-focused": {
              color: palette.primary,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: `1px solid ${palette.border}`,
            borderRadius: 16,
            boxShadow: mode === "dark" ? "none" : "0 2px 10px rgba(16, 24, 40, 0.05)",
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            color: palette.textMuted,
            "&:hover": {
              color: palette.primary,
              backgroundColor: mode === "dark" ? "rgba(129, 140, 248, 0.1)" : "#eef2ff",
            },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            marginTop: 8,
            minWidth: 190,
            border: `1px solid ${palette.border}`,
            borderRadius: 12,
            boxShadow: "0 16px 32px rgba(16, 24, 40, 0.14)",
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            margin: "3px 6px",
            minHeight: 40,
            borderRadius: 8,
            "&.Mui-selected": {
              color: palette.primary,
              backgroundColor: mode === "dark" ? "rgba(129, 140, 248, 0.1)" : "#eef2ff",
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 650,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },
      MuiDataGrid: {
        styleOverrides: {
          root: {
            border: 0,
            color: palette.text,
          },
          columnHeaders: {
            backgroundColor: palette.surfaceMuted,
            borderBottom: `1px solid ${palette.border}`,
          },
          columnHeaderTitle: {
            fontWeight: 700,
          },
          cell: {
            borderBottom: `1px solid ${palette.border}`,
          },
          footerContainer: {
            borderTop: `1px solid ${palette.border}`,
            backgroundColor: palette.surface,
          },
        },
      },
    },
  };
};

export const ColorModeContext = createContext({
  toggleColorMode: () => {},
});

export const useMode = () => {
  const [mode, setMode] = useState(() => localStorage.getItem("colorMode") || "light");

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () =>
        setMode((previousMode) => {
          const nextMode = previousMode === "light" ? "dark" : "light";
          localStorage.setItem("colorMode", nextMode);
          return nextMode;
        }),
    }),
    []
  );

  const theme = useMemo(() => createTheme(themeSettings(mode)), [mode]);
  return [theme, colorMode];
};
