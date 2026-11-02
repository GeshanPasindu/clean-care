import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Grid,
  ListItemText,
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
import { useActiveClients } from "../clients/clientQueries";
import { useActiveStaff } from "../staff/staffQueries";
import { useServiceMutation, useServiceQuery } from "../../queries/queryHelpers";
import { jobService } from "./jobService";

const jobSchema = yup.object().shape({
  jobName: yup.string().required("Job Name is required"),
  description: yup.string().required("Description is required"),
  client: yup.string().required("Client is required"),
  assignedStaff: yup.array().of(yup.string().required()).min(1, "Select at least one staff member").required("Assigned Staff is required"),
  staffRates: yup.object(),
  orgNoOfhours: yup.number().required("Number of Hours is required").nullable(),
  orgHourRate: yup.number().required("Hourly Rate is required").nullable(),
  estNoOfhours: yup.number().required("Number of Hours is required").nullable(),
  staffHourRate: yup.number().required("Hourly Rate is required").nullable(),
  notes: yup.string(),
});

const EditJob = () => {
  const { id } = useParams();
  const clientsQuery = useActiveClients();
  const staffsQuery = useActiveStaff();
  const jobQuery = useServiceQuery(["jobs", "detail", id], () => jobService.getById(id), {
    enabled: Boolean(id),
  });
  const clients = clientsQuery.data?.clients || [];
  const staffs = staffsQuery.data?.staffs || [];

  const [jobDetails, setJobDetails] = useState({
    jobName: '',
    description: '',
    client: '',
    assignedStaff: [],
    staffRates: {},
    orgNoOfhours: 0,
    orgHourRate: 0,
    estNoOfhours: 0,
    staffHourRate: 0,
    notes: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [alertSeverity, setAlertSeverity] = useState('success');
  const [alertMessage, setAlertMessage] = useState('');
  const navigate = useNavigate();
  const updateJob = useServiceMutation(
    ({ jobId, values }) => jobService.update(jobId, values),
    { invalidate: [["jobs"]] }
  );

  useEffect(() => {
    const job = jobQuery.data?.job;
    if (!job) return;
    const assignedStaffIds = (Array.isArray(job.assignedStaff) ? job.assignedStaff : [job.assignedStaff])
      .map((staff) => typeof staff === "object" ? staff?._id : staff)
      .filter(Boolean);
    const staffRatesById = Object.fromEntries((job.staffAssignments || []).map((assignment) => {
      const staffId = typeof assignment.staff === "object" ? assignment.staff?._id : assignment.staff;
      return [String(staffId), assignment.hourRate];
    }));
    const clientId = typeof job.client === "object" ? job.client?._id : job.client;
    setJobDetails({
      jobName: job.jobName,
      description: job.description,
      client: clientId || "",
      assignedStaff: assignedStaffIds,
      staffRates: Object.fromEntries(assignedStaffIds.map((staffId) => [
        staffId,
        staffRatesById[staffId] ?? job.staffHourRate ?? "",
      ])),
      orgNoOfhours: job.orgNoOfhours,
      orgHourRate: job.orgHourRate,
      estNoOfhours: job.estNoOfhours,
      staffHourRate: job.staffHourRate,
      notes: job.notes,
    });
  }, [jobQuery.data]);

  const handleUpdateJob = async (values) => {
    setIsLoading(true);

    try {
      await updateJob.mutateAsync({ jobId: id, values });
      setAlertSeverity('success');
      setAlertMessage('Job updated successfully');
      setTimeout(() => {
        navigate('/jobs');
      }, 2000);
    } catch (error) {
      setAlertSeverity('error');
      setAlertMessage(`Error updating job: ${error.message}`);
    } finally {
      setIsLoading(false);
      setOpenSnackbar(true);
    }
  };

  return (
    <Box sx={formPageSx}>
      <Header title={jobDetails.jobName ? `Edit Job: ${jobDetails.jobName}` : "Edit Job"} subtitle="" />
      <Box>
        <Formik
          initialValues={jobDetails}
          enableReinitialize
          validationSchema={jobSchema}
          onSubmit={handleUpdateJob}
        >
          {({ handleChange, handleBlur, handleSubmit, setFieldValue, values, errors, touched }) => (
            <Form onSubmit={handleSubmit}>
              <Grid container spacing={2}>
                {/* Job details fields */}
                <Grid item xs={12}>
                  <Typography variant="h5" component="span" fontWeight="bold">
                    Job Name:
                  </Typography>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="filled"
                    margin="normal"
                    name="jobName"
                    value={values.jobName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.jobName && Boolean(errors.jobName)}
                    helperText={touched.jobName && errors.jobName}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="h5" component="span" fontWeight="bold">
                    Description:
                  </Typography>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="filled"
                    margin="normal"
                    name="description"
                    value={values.description}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    multiline
                    rows={3}
                    error={touched.description && Boolean(errors.description)}
                    helperText={touched.description && errors.description}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="h5" component="span" fontWeight="bold">
                    Client:
                  </Typography>
                  <Field
                    as={Select}
                    fullWidth
                    variant="filled"
                    name="client"
                    value={values.client}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.client && Boolean(errors.client)}
                    helperText={touched.client && errors.client}
                  >
                    {clients.map((client) => (
                      <MenuItem key={client._id} value={client._id}>
                        {client.firstName} {client.lastName}
                      </MenuItem>
                    ))}
                  </Field>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="h5" component="span" fontWeight="bold">
                    Assigned Staff:
                  </Typography>
                  <Field
                    as={Select}
                    fullWidth
                    variant="filled"
                    multiple
                    name="assignedStaff"
                    value={values.assignedStaff || []}
                    onChange={(event) => {
                      const selectedIds = event.target.value;
                      setFieldValue("assignedStaff", selectedIds);
                      setFieldValue("staffRates", Object.fromEntries(
                        Object.entries(values.staffRates || {}).filter(([staffId]) => selectedIds.includes(staffId))
                      ));
                    }}
                    onBlur={handleBlur}
                    error={touched.assignedStaff && Boolean(errors.assignedStaff)}
                    renderValue={(selected) => staffs
                      .filter((staff) => selected.includes(staff._id))
                      .map((staff) => `${staff.firstName} ${staff.lastName}`.trim())
                      .join(", ")}
                  >
                    {staffs.map((staff) => (
                      <MenuItem key={staff._id} value={staff._id}>
                        <Checkbox checked={(values.assignedStaff || []).includes(staff._id)} />
                        <ListItemText primary={`${staff.firstName} ${staff.lastName}`} />
                      </MenuItem>
                    ))}
                  </Field>
                  {(values.assignedStaff || []).map((staffId) => {
                    const selectedStaff = staffs.find((staff) => staff._id === staffId);
                    if (!selectedStaff) return null;
                    return (
                      <Box key={staffId} sx={{ mt: 2 }}>
                        <Typography variant="h6" component="span" fontWeight="bold">
                          Hourly Rate for {selectedStaff.firstName} {selectedStaff.lastName}:
                        </Typography>
                        <TextField
                          fullWidth
                          variant="filled"
                          type="number"
                          value={values.staffRates?.[staffId] ?? values.staffHourRate}
                          onChange={(event) => setFieldValue(`staffRates.${staffId}`, event.target.value)}
                          onBlur={handleBlur}
                          inputProps={{ min: 0, step: "0.01" }}
                        />
                      </Box>
                    );
                  })}
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="h5" component="span" fontWeight="bold">
                   Original Number of Hours:
                  </Typography>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="filled"
                    type="number"
                    name="orgNoOfhours"
                    value={values.orgNoOfhours}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.orgNoOfhours && Boolean(errors.orgNoOfhours)}
                    helperText={touched.orgNoOfhours && errors.orgNoOfhours}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="h5" component="span" fontWeight="bold">
                   Originally Hourly Rate:
                  </Typography>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="filled"
                    type="number"
                    name="orgHourRate"
                    value={values.orgHourRate}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.orgHourRate && Boolean(errors.orgHourRate)}
                    helperText={touched.orgHourRate && errors.orgHourRate}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="h5" component="span" fontWeight="bold">
                   Estimated Hours per Staff Member:
                  </Typography>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="filled"
                    type="number"
                    name="estNoOfhours"
                    value={values.estNoOfhours}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.estNoOfhours && Boolean(errors.estNoOfhours)}
                    helperText={touched.estNoOfhours && errors.estNoOfhours}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="h5" component="span" fontWeight="bold">
                   Default Hourly Rate per Staff Member:
                  </Typography>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="filled"
                    type="number"
                    name="staffHourRate"
                    value={values.staffHourRate}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.staffHourRate && Boolean(errors.staffHourRate)}
                    helperText={touched.staffHourRate && errors.staffHourRate}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="h5" component="span" fontWeight="bold">
                    Notes:
                  </Typography>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="filled"
                    margin="normal"
                    name="notes"
                    value={values.notes}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    multiline
                    rows={3}
                    error={touched.notes && Boolean(errors.notes)}
                    helperText={touched.notes && errors.notes}
                  />
                </Grid>
                {/* Update button */}
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
                    {isLoading ? 'Updating...' : 'Update Job'}
                  </Button>
                </Grid>
              </Grid>
            </Form>
          )}
        </Formik>
      </Box>
      {/* Snackbar for alerts */}
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

export default EditJob;
