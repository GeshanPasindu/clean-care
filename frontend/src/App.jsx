import { CssBaseline, ThemeProvider } from "@mui/material";
import { useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import PrivateRoute from "./PrivateRoutes.jsx";
import Sidebar from "./scenes/global/Sidebar";
import Topbar from "./scenes/global/Topbar";
import Login from "./scenes/login";
import Dashboard from "./scenes/dashboard/dashboard.jsx";
import Jobs from "./scenes/jobs";
import AddJob from "./scenes/jobs/AddJob.jsx";
import ViewJob from "./scenes/jobs/ViewJob.jsx";
import EditJob from "./scenes/jobs/EditJob.jsx";
import CompletedJobs from "./scenes/jobs/completedJobs";
import PaymentSummery from "./scenes/jobs/paymentSummery";
import Timesheets from "./scenes/timesheets";
import Clients from "./scenes/clients";
import AddClient from "./scenes/clients/AddClient.jsx";
import ViewClient from "./scenes/clients/ViewClient.jsx";
import EditClient from "./scenes/clients/EditClient.jsx";
import ClientJobs from "./scenes/clients/ClientJobs .jsx";
import StaffJobs from "./scenes/staff/StaffJobs.jsx";
import ChangePw from "./scenes/profile/ChangePw";
import EditProfile from "./scenes/profile/EditProfile";
import Invoices from "./scenes/invoices/index.jsx";
import AddInvoice from "./scenes/invoices/AddInvoices.jsx";
import EditInvoice from "./scenes/invoices/EditInvoices.jsx";
import ViewInvoice from "./scenes/invoices/ViewInvoice.jsx";
import Roles from "./scenes/roles/index.jsx";
import Users from "./scenes/users/index.jsx";
import UserForm from "./scenes/users/UserForm.jsx";
import ViewUser from "./scenes/users/ViewUser.jsx";
import { ColorModeContext, useMode } from "./theme";

function App() {
  const [theme, colorMode] = useMode();
  const [isSidebar, setIsSidebar] = useState(false);
  const location = useLocation();
  const isLoginPage = location.pathname === "/";

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className="app">
          {!isLoginPage && <Sidebar isSidebar={isSidebar} setIsSidebar={setIsSidebar} />}
          <main className="content">
            {!isLoginPage && <Topbar setIsSidebar={setIsSidebar} />}
            <div className="page-content">
              <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/dashboard" element={<PrivateRoute permission="dashboard.view"><Dashboard /></PrivateRoute>} />
                <Route path="/jobs" element={<PrivateRoute permission="jobs.read"><Jobs /></PrivateRoute>} />
                <Route path="/timesheets" element={<PrivateRoute permission="timesheets.read"><Timesheets /></PrivateRoute>} />
                <Route path="/jobs/newjob" element={<PrivateRoute permission="jobs.create"><AddJob /></PrivateRoute>} />
                <Route path="/jobs/viewjob/:id" element={<PrivateRoute permission="jobs.read"><ViewJob /></PrivateRoute>} />
                <Route path="/jobs/editjob/:id" element={<PrivateRoute permission="jobs.update"><EditJob /></PrivateRoute>} />
                <Route path="/completedjobs" element={<PrivateRoute permission="jobs.completed.read"><CompletedJobs /></PrivateRoute>} />
                <Route path="/paymentsummery" element={<PrivateRoute permission="jobs.financials.read"><PaymentSummery /></PrivateRoute>} />
                <Route path="/clients" element={<PrivateRoute permission="clients.read"><Clients /></PrivateRoute>} />
                <Route path="/clients/newclient" element={<PrivateRoute permission="clients.create"><AddClient /></PrivateRoute>} />
                <Route path="/clients/viewclient/:id" element={<PrivateRoute permission="clients.read"><ViewClient /></PrivateRoute>} />
                <Route path="/clients/editclient/:id" element={<PrivateRoute permission="clients.update"><EditClient /></PrivateRoute>} />
                <Route path="/clients/viewclient/:id/jobs" element={<PrivateRoute permission="jobs.read"><ClientJobs /></PrivateRoute>} />
                <Route path="/users" element={<PrivateRoute permission="users.read"><Users /></PrivateRoute>} />
                <Route path="/users/new" element={<PrivateRoute permission="users.create"><UserForm /></PrivateRoute>} />
                <Route path="/users/:id" element={<PrivateRoute permission="users.read"><ViewUser /></PrivateRoute>} />
                <Route path="/users/:id/edit" element={<PrivateRoute permission="users.update"><UserForm editing /></PrivateRoute>} />
                <Route path="/users/:id/jobs" element={<PrivateRoute permission="jobs.assigned.read"><StaffJobs /></PrivateRoute>} />
                <Route path="/my-payments" element={<PrivateRoute permission="payroll.self.read"><StaffJobs /></PrivateRoute>} />
                <Route path="/invoices" element={<PrivateRoute permission="invoices.read"><Invoices /></PrivateRoute>} />
                <Route path="/invoices/newInvoice" element={<PrivateRoute permission="invoices.create"><AddInvoice /></PrivateRoute>} />
                <Route path="/invoices/editInvoice/:id" element={<PrivateRoute permission="invoices.update"><EditInvoice /></PrivateRoute>} />
                <Route path="/invoices/viewInvoice/:id" element={<PrivateRoute permission="invoices.read"><ViewInvoice /></PrivateRoute>} />
                <Route path="/profile/changepassword" element={<PrivateRoute permission="auth.password.change"><ChangePw /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute permission="profile.read"><EditProfile /></PrivateRoute>} />
                <Route path="/roles" element={<PrivateRoute permission="roles.manage"><Roles /></PrivateRoute>} />
              </Routes>
            </div>
          </main>
        </div>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
