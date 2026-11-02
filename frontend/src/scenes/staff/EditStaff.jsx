import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Grid,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import { useNavigate, useParams } from "react-router-dom";
import Header from "../../components/Header";
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as yup from 'yup';
import { formPageSx } from "../../styles/uiStyles";
import { useAuth } from "../../auth/AuthContext";
import { useServiceMutation, useServiceQuery } from "../../queries/queryHelpers";
import { adminService } from "../../services/adminService";
import { staffService } from "../../services/staffService";
import { userService } from "../../services/userService";

const phoneNumberRegex = /^(\+\d{1,3}[- ]?)?\d{10}$/;
const bankAcNoRegex = /^\d{8,20}$/;

const staffSchema = yup.object().shape({
  firstName: yup.string().required("First Name is required"),
  lastName: yup.string().required("Last Name is required"),
  address: yup.string().required("Address is required"),
  phoneNumber: yup.string().matches(phoneNumberRegex, "Invalid phone number format").required("Phone Number is required"),
  position: yup.string().required("Position is required"),
  dateOfBirth: yup.string().required("Date of Birth is required"),
  dateOfHire: yup.string().required("Date of Hire is required"),
  empContactName: yup.string(),
  empPhoneNumber: yup.string().matches(phoneNumberRegex, "Invalid phone number format"),
  bankAcNo: yup.string().matches(bankAcNoRegex, "Invalid bank account number format").nullable(true),
  bankName: yup.string(),
  bankAcBranch: yup.string(),
  notes: yup.string(),
  payFrequency: yup.string().oneOf(["Weekly", "Monthly"]).required("Choose a pay frequency"),
  supervisorId: yup.string(),
});

const EditStaff = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superAdmin";
  const adminsQuery = useServiceQuery(["admins", "list"], adminService.getAll, {
    enabled: isSuperAdmin,
  });
  const admins = adminsQuery.data?.admins || [];
  const adminLoadError = adminsQuery.isError ? "Could not load admin supervisors." : "";
  const staffQuery = useServiceQuery(["staff", "detail", id], () => staffService.getById(id), {
    enabled: Boolean(id),
  });

  const [staffDetails, setStaffDetails] = useState({
    firstName: "",
    lastName: "",
    email: "",
    address: "",
    phoneNumber: "",
    position: "",
    dateOfBirth: "",
    dateOfHire: "",
    empContactName: "",
    empPhoneNumber: "",
    bankAcNo: "",
    bankName: "",
    bankAcBranch: "",
    notes: "",
    payFrequency: "Weekly",
    workStatus: "",
    userName: "",
    supervisorId: "",
  });

  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [alertSeverity, setAlertSeverity] = useState('success');
  const [alertMessage, setAlertMessage] = useState('');
  const staffName = [staffDetails.firstName, staffDetails.lastName].filter(Boolean).join(" ");
  const updateStaffMutation = useServiceMutation(
    ({ staffId, updates }) => userService.updateStaff(staffId, updates),
    { invalidate: [["staff"], ["staff", "detail", id]] }
  );

  const fetchStaffDetails = async () => {
    const staff = staffQuery.data?.staff;
    if (!staff) return;
    const staffValues = { ...staff };
    staffValues.payFrequency = staffValues.payFrequency || "Weekly";
    staffValues.supervisorId = staffValues.supervisorId || (typeof staffValues.adminId === "object" ? staffValues.adminId?._id : staffValues.adminId) || "";
    staffValues.dateOfBirth = staffValues.dateOfBirth ? staffValues.dateOfBirth.split('T')[0] : new Date().toISOString().split('T')[0];
    staffValues.dateOfHire = staffValues.dateOfHire ? staffValues.dateOfHire.split('T')[0] : new Date().toISOString().split('T')[0];
    setStaffDetails(staffValues);
  };

  useEffect(() => {
    fetchStaffDetails();
  }, [staffQuery.data]);

  const handleUpdateStaff = async (values) => {
    setIsLoading(true);
    console.log("update")

    try {
      const updates = { ...values };
      if (!isSuperAdmin) delete updates.supervisorId;
      await updateStaffMutation.mutateAsync({ staffId: id, updates });
      {
        setAlertSeverity('success');
        setAlertMessage('Staff updated successfully');
        setTimeout(() => {
          navigate('/staff');
        }, 2000);
      }
    } catch (error) {
      setAlertSeverity('error');
      setAlertMessage(`Error updating staff: ${error.message}`);
    } finally {
      setIsLoading(false);
      setOpenSnackbar(true);
    }
  };

  return (
    <Box sx={formPageSx}>
      <Header title={staffName ? `Edit Staff: ${staffName}` : "Edit Staff"} subtitle="" />
      <Box>
        <Formik
          initialValues={{
            ...staffDetails,
            dateOfBirth: staffDetails.dateOfBirth || new Date().toISOString().split('T')[0],
            dateOfHire: staffDetails.dateOfHire || new Date().toISOString().split('T')[0],
            supervisorId: staffDetails.supervisorId || "",
          }}
          enableReinitialize
          validationSchema={isSuperAdmin ? staffSchema.shape({
            supervisorId: yup.string().required("Choose an admin supervisor").test(
              "active-supervisor",
              "Choose an active admin supervisor",
              (value) => admins.some((admin) => admin.status === "active" && String(admin.adminDetails?._id) === String(value))
            ),
          }) : staffSchema}
          onSubmit={handleUpdateStaff}
        >
          {({ handleChange, handleBlur, handleSubmit, values, errors, touched, setFieldValue }) => (
            <Form onSubmit={handleSubmit}>
              <Grid container spacing={2}>
                {isSuperAdmin && (
                  <Grid item xs={12}>
                    <Typography variant="h5" component="span" fontWeight="bold">Supervisor (Admin):</Typography>
                    <FormControl fullWidth variant="filled" error={!!touched.supervisorId && !!errors.supervisorId}>
                      <InputLabel id="edit-staff-supervisor-label">Supervisor (Admin)</InputLabel>
                      <Select
                        labelId="edit-staff-supervisor-label"
                        name="supervisorId"
                        value={values.supervisorId || ""}
                        onBlur={handleBlur}
                        onChange={(event) => setFieldValue("supervisorId", event.target.value)}
                      >
                        {admins.filter((admin) => admin.adminDetails?._id).map((admin) => {
                          const profile = admin.adminDetails;
                          const profileName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
                          return (
                            <MenuItem key={profile._id} value={profile._id} disabled={admin.status !== "active"}>
                              {profileName || admin.userName} ({admin.email}){admin.status !== "active" ? " (inactive)" : ""}
                            </MenuItem>
                          );
                        })}
                      </Select>
                      <FormHelperText>
                        {touched.supervisorId && errors.supervisorId
                          ? errors.supervisorId
                          : adminLoadError || "Changing this also changes which admin can access the staff record. Existing jobs stay with their original admin."}
                      </FormHelperText>
                    </FormControl>
                  </Grid>
                )}
                {Object.keys(staffDetails).map((field) => (
                  field !== 'createdAt' && field !== '__v' && field !== '_id' && field !== 'updatedAt' && field !== 'adminId' && field !== 'user' && field !== 'workStatus' && field !== 'supervisorId' && field !== 'supervisorName' && (
                    <Grid item xs={12} key={field}>
                      <Typography variant="h5" component="span" fontWeight="bold">
                        {`${field === "payFrequency" ? "Pay Frequency" : field.charAt(0).toUpperCase() + field.slice(1)}:`}
                      </Typography>
                      {field === "payFrequency" ? (
                        <FormControl fullWidth variant="filled" margin="normal" error={touched.payFrequency && Boolean(errors.payFrequency)}>
                          <InputLabel id="edit-staff-pay-frequency-label">Pay Frequency</InputLabel>
                          <Select
                            labelId="edit-staff-pay-frequency-label"
                            name="payFrequency"
                            value={values.payFrequency || "Weekly"}
                            onChange={(event) => setFieldValue("payFrequency", event.target.value)}
                            onBlur={handleBlur}
                          >
                            <MenuItem value="Weekly">Weekly (Monday–Sunday)</MenuItem>
                            <MenuItem value="Monthly">Monthly (calendar month)</MenuItem>
                          </Select>
                          <FormHelperText>{touched.payFrequency && errors.payFrequency}</FormHelperText>
                        </FormControl>
                      ) : <Field
                        as={TextField}
                        fullWidth
                        variant="filled"
                        margin="normal"
                        name={field}
                        type={field === 'dateOfBirth' || field === 'dateOfHire' ? 'date' : 'text'}
                        value={values[field]}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        multiline={field === 'notes'}
                        rows={field === 'notes' ? 3 : 1}
                        error={touched[field] && Boolean(errors[field])}
                        helperText={touched[field] && errors[field]}
                        InputLabelProps={{ shrink: true }}
                      />}
                    </Grid>
                  )
                ))}
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    color="primary"
                    type="submit"
                    disabled={isLoading}
                    sx={{
                      backgroundColor: '#6870fa',
                      color: 'white',
                      marginRight: 2,
                      fontSize: '16px',
                      '&:hover': {
                        backgroundColor: '#3e4396',
                      },
                    }}
                  >
                    {isLoading ? 'Updating...' : 'Update Staff'}
                  </Button>
                </Grid>
              </Grid>
            </Form>
          )}
        </Formik>
      </Box>
      <Snackbar
        open={openSnackbar}
        autoHideDuration={5000}
        onClose={() => setOpenSnackbar(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MuiAlert
          onClose={() => setOpenSnackbar(false)}
          severity={alertSeverity}
          elevation={6}
          variant="filled"
          sx={{ color: '#fff' }}
        >
          {alertSeverity === 'success' ? 'Success' : 'Error'}
          {': '}
          {alertMessage}
        </MuiAlert>
      </Snackbar>
    </Box>
  );
};

export default EditStaff;
