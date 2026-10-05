import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: { main: '#176b5b', dark: '#104d42', light: '#e6f3ed' },
    secondary: { main: '#b75235' },
    background: { default: '#f7f8f5', paper: '#ffffff' },
    text: { primary: '#203b34', secondary: '#63736c' },
    error: { main: '#b13c36' },
    divider: '#e2e9e3',
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
    htmlFontSize: 18,
    fontSize: 16,
    button: { textTransform: 'none', fontWeight: 650, fontSize: '0.9rem' },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 48, padding: '10px 20px', borderRadius: 12 },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { backgroundColor: '#fff', borderRadius: 12 },
        notchedOutline: { borderColor: '#bdcbc3' },
      },
    },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 22 } } },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 14, alignItems: 'center' } },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
});
