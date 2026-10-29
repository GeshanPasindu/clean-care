import { CssBaseline, ThemeProvider } from "@mui/material";
import { useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import Sidebar from "./scenes/global/Sidebar";
import Topbar from "./scenes/global/Topbar";
import Login from "./scenes/login";

import Jobs from "./scenes/jobs"
import AddJob from "./scenes/jobs/AddJob.jsx";
import ViewJob from "./scenes/jobs/ViewJob.jsx"
import EditJob from "./scenes/jobs/EditJob.jsx";
import CompletedJobs from "./scenes/jobs/completedJobs";
import PaymentSummery from "./scenes/jobs/paymentSummery";

import Staff from "./scenes/staff";
import ViewStaff from "./scenes/staff/ViewStaff.jsx";
import AddStaff from "./scenes/staff/AddStaff.jsx";
import EditStaff from "./scenes/staff/EditStaff.jsx";

import Clients from "./scenes/clients";
import AddClient from "./scenes/clients/AddClient.jsx";
import ViewClient from "./scenes/clients/ViewClient.jsx";
import EditClient from "./scenes/clients/EditClient.jsx";
import StaffJobs from "./scenes/staff/StaffJobs.jsx";

import ChangePw from "./scenes/profile/ChangePw";
import EditProfile from "./scenes/profile/EditProfile";
import { ColorModeContext, useMode } from "./theme";
import ClientJobs from "./scenes/clients/ClientJobs .jsx";
import Dashboard from "./scenes/dashboard/dashboard.jsx";
import PrivateRoute from "./PrivateRoutes.js";
import Admin from "./scenes/admins/index.jsx";
import CreateAdmin from "./scenes/admins/CreateAdmin.jsx";
import ViewAdmin from "./scenes/admins/ViewAdmin.jsx";
import EditAdmin from "./scenes/admins/EditAdmin.jsx";

import Invoices from "./scenes/invoices/index.jsx";
import AddInvoice from "./scenes/invoices/AddInvoices.jsx";
import EditInvoice from "./scenes/invoices/EditInvoices.jsx";
import ViewInvoice from "./scenes/invoices/ViewInvoice.jsx";

function App() {
  const [theme, colorMode] = useMode();
  const [isSidebar, setIsSidebar] = useState(false);
  const location = useLocation();

  // Check if the current route is the login page
  const isLoginPage = location.pathname === "/";

return (
  <ColorModeContext.Provider value={colorMode}>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="app">
        {!isLoginPage && (
          <Sidebar
            isSidebar={isSidebar}
            setIsSidebar={setIsSidebar}
          />
        )}
        <main className="content">
          {!isLoginPage && <Topbar setIsSidebar={setIsSidebar} />}
          <div className="page-content">
          <Routes>
            <Route path="/" element={<Login />} />
            
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <Dashboard />
                  </PrivateRoute>
                }
              />

              <Route
                path="/jobs"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin', 'staff']}>
                    <Jobs />
                  </PrivateRoute>
                }
              />
              <Route
                path="/jobs/newjob"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <AddJob />
                  </PrivateRoute>
                }
              />
              <Route
                path="/jobs/viewjob/:id"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin', 'staff']}>
                    <ViewJob />
                  </PrivateRoute>
                }
              />
              <Route
                path="/jobs/editjob/:id"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <EditJob />
                  </PrivateRoute>
                }
              />
              <Route
                path="/completedjobs"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin',]}>
                    <CompletedJobs />
                  </PrivateRoute>
                }
              />
               <Route
                path="/paymentsummery"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin',]}>
                    <PaymentSummery />
                  </PrivateRoute>
                }
              />

              <Route
                path="/clients"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <Clients />
                  </PrivateRoute>
                }
              />
              <Route
                path="/clients/newclient"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <AddClient />
                  </PrivateRoute>
                }
              />
              <Route
                path="/clients/viewclient/:id"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <ViewClient />
                  </PrivateRoute>
                }
              />
              <Route
                path="/clients/editclient/:id"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <EditClient />
                  </PrivateRoute>
                }
              />
              <Route
                path="/clients/viewclient/:id/jobs"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <ClientJobs />
                  </PrivateRoute>
                }
              />

              <Route
                path="/staff"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <Staff />
                  </PrivateRoute>
                }
              />
              <Route
                path="/staff/newstaff"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <AddStaff />
                  </PrivateRoute>
                }
              />
              <Route
                path="/staff/viewstaff/:id"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <ViewStaff />
                  </PrivateRoute>
                }
              />
              <Route
                path="/staff/editstaff/:id"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <EditStaff />
                  </PrivateRoute>
                }
              />
              <Route
                path="/staff/viewstaff/:id/jobs"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <StaffJobs />
                  </PrivateRoute>
                }
              />


              <Route
                path="/invoices"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <Invoices />
                  </PrivateRoute>
                }
              />
              <Route
                path="/invoices/newInvoice"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <AddInvoice />
                  </PrivateRoute>
                }
              />

              <Route
                path="/invoices/editInvoice/:id"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <EditInvoice />
                  </PrivateRoute>
                }
              />

              <Route
                path="/invoices/viewInvoice/:id"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin']}>
                    <ViewInvoice />
                  </PrivateRoute>
                }
              />
              <Route
                path="/profile/changepassword"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin','staff']}>
                    <ChangePw />
                  </PrivateRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <PrivateRoute allowedRoles={['superAdmin', 'admin','staff']}>
                    <EditProfile />
                  </PrivateRoute>
                }
              />

<Route
                path="/admin"
                element={
                  <PrivateRoute allowedRoles={['superAdmin']}>
                    <Admin />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/createadmin"
                element={
                  <PrivateRoute allowedRoles={['superAdmin']}>
                    <CreateAdmin />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/viewadmin/:id"
                element={
                  <PrivateRoute allowedRoles={['superAdmin']}>
                    <ViewAdmin />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/editadmin/:id"
                element={
                  <PrivateRoute allowedRoles={['superAdmin']}>
                    <EditAdmin />
                  </PrivateRoute>
                }
              />
                
            </Routes>
          </div>
          </main>
        </div>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
