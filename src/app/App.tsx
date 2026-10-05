import { lazy, Suspense } from 'react';
import { Spinner } from '../components/ui';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './AuthProvider';
import { Login, ProtectedRoute } from './AuthScreens';
import { I18nProvider } from '../i18n/Provider';
import { Layout } from './Layout';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from './theme';
import { Landing } from './Landing';

const Tasks = lazy(() =>
  import('../features/tasks/Tasks').then((m) => ({ default: m.Tasks })),
);
const AddTask = lazy(() =>
  import('../features/tasks/TaskForm').then((m) => ({ default: m.AddTask })),
);
const Settings = lazy(() =>
  import('../features/settings/Settings').then((module) => ({
    default: module.Settings,
  })),
);
const Today = lazy(() =>
  import('../features/today/Today').then((module) => ({
    default: module.Today,
  })),
);
const Medications = lazy(() =>
  import('../features/medications/Medications').then((module) => ({
    default: module.Medications,
  })),
);
const AddMedication = lazy(() =>
  import('../features/medications/MedicationForm').then((module) => ({
    default: module.AddMedication,
  })),
);
const QuickAdd = lazy(() =>
  import('./QuickAdd').then((module) => ({ default: module.QuickAdd })),
);
const Calendar = lazy(() =>
  import('../features/calendar/Calendar').then((module) => ({
    default: module.Calendar,
  })),
);
const Events = lazy(() =>
  import('../features/events/Events').then((module) => ({
    default: module.Events,
  })),
);
const AddEvent = lazy(() =>
  import('../features/events/EventForm').then((module) => ({
    default: module.AddEvent,
  })),
);
const Money = lazy(() =>
  import('../features/budgets/Money').then((module) => ({
    default: module.Money,
  })),
);
const AddExpense = lazy(() =>
  import('../features/expenses/ExpenseForm').then((module) => ({
    default: module.AddExpense,
  })),
);
const History = lazy(() =>
  import('../features/medications/History').then((module) => ({
    default: module.History,
  })),
);

const EventDetails = lazy(() =>
  import('../features/events/EventDetails').then((m) => ({
    default: m.EventDetails,
  })),
);
const FamilyView = lazy(() =>
  import('../features/family/Family').then((m) => ({ default: m.FamilyView })),
);
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});
export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <AuthProvider>
            <BrowserRouter>
              <Suspense fallback={<Spinner />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/auth/callback" element={<Login />} />
                  <Route path="/welcome" element={<Landing />} />
                  <Route element={<ProtectedRoute />}>
                    <Route element={<Layout />}>
                      <Route index element={<Today />} />
                      <Route path="medications" element={<Medications />} />
                      <Route path="medications/history" element={<History />} />
                      <Route path="calendar" element={<Calendar />} />
                      <Route path="tasks" element={<Tasks />} />
                      <Route path="add/task" element={<AddTask />} />
                      <Route
                        path="appointments"
                        element={<Events type="appointment" />}
                      />
                      <Route path="bills" element={<Events type="bill" />} />
                      <Route path="money" element={<Money />} />
                      <Route path="add" element={<QuickAdd />} />
                      <Route
                        path="add/medication"
                        element={<AddMedication />}
                      />
                      <Route
                        path="add/appointment"
                        element={<AddEvent type="appointment" />}
                      />
                      <Route
                        path="add/bill"
                        element={<AddEvent type="bill" />}
                      />
                      <Route path="add/expense" element={<AddExpense />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="items/:id" element={<EventDetails />} />
                      <Route path="family" element={<FamilyView />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </AuthProvider>
        </I18nProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
