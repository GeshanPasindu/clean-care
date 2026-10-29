import { getAccessToken } from "../../auth/apiClient";
import {
    Box,
    Button,
    Checkbox,
    ListItemText,
    MenuItem,
    Alert as MuiAlert,
    Select,
    Snackbar,
    TextField,
    Typography,
    FormControl,
  FormHelperText
  } from "@mui/material";
  import AlertTitle from "@mui/material/AlertTitle";
  import useMediaQuery from "@mui/material/useMediaQuery";
  import { Formik } from "formik";
  import React, { useState, useEffect } from "react";
  import { useNavigate } from "react-router-dom";
  import * as yup from "yup";
  import axios from "axios";
  import Header from "../../components/Header";
import { environment } from "../../environment";
import { formPageSx } from "../../styles/uiStyles";
  
  const AddJob = () => {
    const isNonMobile = useMediaQuery("(min-width:600px)");
    const [loading, setLoading] = useState(false);
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");
    const [alertSeverity, setAlertSeverity] = useState("success");
    const [clients, setClients] = useState([]);
    const [staffs, setStaffs] = useState([]);
    const navigate = useNavigate();
  
    useEffect(() => {
      fetchClients();
      fetchStaffs();
    }, []);
    const token = getAccessToken()

    const fetchClients = async () => {
        try {
          const headers = {
            Authorization: `Bearer ${token}`
          };
      
          const response = await axios.get(environment.apiUrl + "/client/getAllActiveClient", { headers });
      
          if (response.data.success) {
            setClients(response.data.clients);
          } else {
            setAlertSeverity("error");
            setAlertMessage("Failed to fetch clients");
            setOpenSnackbar(true);
          }
        } catch (error) {
          console.error("Error fetching clients:", error);
          setAlertSeverity("error");
          setAlertMessage("Failed to fetch clients");
          setOpenSnackbar(true);
        }
      };
  
    const fetchStaffs = async () => {
        try {
          // The shared API client attaches the in-memory access token.
          const response = await axios.get(environment.apiUrl + "/staff/getAllActiveStaff", {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          if (response.data.success) {
            console.log(staffs);
            setStaffs(response.data.staffs);
          } else {
            setAlertSeverity("error");
            setAlertMessage("Failed to fetch staffs");
            setOpenSnackbar(true);
          }
        } catch (error) {
          console.error("Error fetching staffs:", error);
          setAlertSeverity("error");
          setAlertMessage("Failed to fetch staffs");
          setOpenSnackbar(true);
        }
      };
  
      const handleFormSubmit = async (values, { resetForm }) => {
        setLoading(true);
        try {
          const headers = {
            Authorization: `Bearer ${token}`
          };
      
          const response = await axios.post(environment.apiUrl + `/job/addJob`, values, { headers });
          console.log("Response:", response.data);
      
          if (response.data.success== true) {
            setAlertSeverity("success");
            setAlertMessage("Job Added Successfully");
            setTimeout(() => {
              navigate("/jobs");
            }, 2000);
            resetForm();
          } else {
            setAlertSeverity("error");
            setAlertMessage(response.data.result.message);
          }
        } catch (error) {
          console.error("Error creating job:", error);
          setAlertSeverity("error");
          setAlertMessage("Failed to add job");
        } finally {
          setLoading(false);
          setOpenSnackbar(true);
        }
      };
  
    return (
      <Box sx={formPageSx}>
        <Header title="Add Job" subtitle="" />
        <Snackbar
          open={openSnackbar}
          autoHideDuration={5000}
          onClose={() => setOpenSnackbar(false)}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MuiAlert
            onClose={() => setOpenSnackbar(false)}
            severity={alertSeverity}
            elevation={6}
            variant="filled"
            sx={{ color: "#fff" }}
          >
            <AlertTitle>
              {alertSeverity === "success" ? "Success" : "Error"}
            </AlertTitle>
            {alertMessage}
          </MuiAlert>
        </Snackbar>
        <Formik
          onSubmit={handleFormSubmit}
          initialValues={initialValues}
          validationSchema={jobSchema}
        >
          {({
            values,
            errors,
            touched,
            handleBlur,
            handleChange,
            handleSubmit,
            setFieldValue,
          }) => (
            <form onSubmit={handleSubmit} height="41vh">
              <Box
                display="grid"
                gap="30px"
                gridTemplateColumns={
                  isNonMobile ? "repeat(1, 1fr)" : "repeat(1, 1fr)"
                }
              >
                <Typography fontWeight="bold" fontSize="16px">
                  Job Name*
                </Typography>
                <Box mt={-2}>
                  <TextField
                    fullWidth
                    variant="filled"
                    type="text"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.jobName}
                    name="jobName"
                    error={!!touched.jobName && !!errors.jobName}
                    helperText={touched.jobName && errors.jobName}
                  />
                </Box>
                <Typography fontWeight="bold" fontSize="16px">
                  Description*
                </Typography>
                <Box mt={-2}>
                  <TextField
                    fullWidth
                    variant="filled"
                    type="text"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.description}
                    name="description"
                    multiline
                    rows={5}
                    error={!!touched.description && !!errors.description}
                    helperText={touched.description && errors.description}
                  />
                </Box>
                <Typography fontWeight="bold" fontSize="16px">
                  Client*
                </Typography>
                <Box mt={-2}>
                <FormControl
                 fullWidth
                 variant="filled"
                 error={!!touched.client && !!errors.client}
                     >
                  <Select
                    fullWidth
                    variant="filled"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.client}
                    name="client"
                    error={!!touched.client && !!errors.client}
                    helperText={touched.client && errors.client}
                  >
                    {clients.map((client) => (
                      <MenuItem key={client._id} value={client._id}>
                        {client.firstName} {client.lastName}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>{touched.client && errors.client}</FormHelperText>
                  </FormControl>
                </Box>
                <Typography fontWeight="bold" fontSize="16px">
                  Assigned Staff*
                </Typography>
                
                <Box mt={-2}>
                <FormControl
                  fullWidth
                  variant="filled"
                  error={!!touched.assignedStaff && !!errors.assignedStaff}
                >
                  <Select
                    fullWidth
                    variant="filled"
                    multiple
                    onBlur={handleBlur}
                    onChange={(event) => {
                      const selectedIds = event.target.value;
                      setFieldValue("assignedStaff", selectedIds);
                      setFieldValue("staffRates", Object.fromEntries(
                        Object.entries(values.staffRates || {}).filter(([staffId]) => selectedIds.includes(staffId))
                      ));
                    }}
                    value={values.assignedStaff || []}
                    name="assignedStaff"
                    error={!!touched.assignedStaff && !!errors.assignedStaff}
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
                  </Select>
                  <FormHelperText>{touched.assignedStaff && errors.assignedStaff}</FormHelperText>
                  </FormControl>
                </Box>
                {(values.assignedStaff || []).map((staffId) => {
                  const selectedStaff = staffs.find((staff) => staff._id === staffId);
                  if (!selectedStaff) return null;
                  return (
                    <Box key={staffId}>
                      <Typography fontWeight="bold" fontSize="16px">
                        Hourly Rate for {selectedStaff.firstName} {selectedStaff.lastName}*
                      </Typography>
                      <TextField
                        fullWidth
                        variant="filled"
                        type="number"
                        value={values.staffRates?.[staffId] ?? values.staffHourRate}
                        onBlur={handleBlur}
                        onChange={(event) => setFieldValue(`staffRates.${staffId}`, event.target.value)}
                        inputProps={{ min: 0, step: "0.01" }}
                      />
                    </Box>
                  );
                })}
                <Typography fontWeight="bold" fontSize="16px">
                  Start Time
                </Typography>
                <Box mt={-2}>
                  <TextField
                    fullWidth
                    variant="filled"
                    type="datetime-local"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.jobDate}
                    name="jobDate"
                    error={!!touched.jobDate && !!errors.jobDate}
                    helperText={touched.jobDate && errors.jobDate}
                  />
                </Box>
                <Typography fontWeight="bold" fontSize="16px">
                  Original Number of Hours*
                </Typography>
                <Box mt={-2}>
                  <TextField
                    fullWidth
                    variant="filled"
                    type="number"
                    onBlur={handleBlur}
                    onChange={(e) => {
                      handleChange(e);
                    }}
                    value={values.orgNoOfhours || null}
                    name="orgNoOfhours"
                    inputProps={{ min: 0, step: "0.01" }}
                    error={!!touched.orgNoOfhours && !!errors.orgNoOfhours}
                    helperText={touched.orgNoOfhours && errors.orgNoOfhours}
                  />
                </Box>
                <Typography fontWeight="bold" fontSize="16px">
                 Original Hourly Rate*
                </Typography>
                <Box mt={-2}>
                  <TextField
                    fullWidth
                    variant="filled"
                    type="number"
                    onBlur={handleBlur}
                    onChange={(e) => {
                      handleChange(e);
                    }}
                    value={values.orgHourRate || null}
                    name="orgHourRate"
                    inputProps={{ min: 0, step: "0.01" }}
                    error={!!touched.orgHourRate && !!errors.orgHourRate}
                    helperText={touched.orgHourRate && errors.orgHourRate}
                  />
                </Box>
                <Typography fontWeight="bold" fontSize="16px">
                  Estimated Hours per Staff Member*
                </Typography>
                <Box mt={-2}>
                  <TextField
                    fullWidth
                    variant="filled"
                    type="number"
                    onBlur={handleBlur}
                    onChange={(e) => {
                      handleChange(e);
                    }}
                    value={values.estNoOfhours || null}
                    name="estNoOfhours"
                    inputProps={{ min: 0, step: "0.01" }}
                    error={!!touched.estNoOfhours && !!errors.estNoOfhours}
                    helperText={touched.estNoOfhours && errors.estNoOfhours}
                  />
                </Box>
                <Typography fontWeight="bold" fontSize="16px">
                 Default Hourly Rate per Staff Member*
                </Typography>
                <Box mt={-2}>
                  <TextField
                    fullWidth
                    variant="filled"
                    type="number"
                    onBlur={handleBlur}
                    onChange={(e) => {
                      handleChange(e);
                    }}
                    value={values.staffHourRate || null}
                    name="staffHourRate"
                    inputProps={{ min: 0, step: "0.01" }}
                    error={!!touched.staffHourRate && !!errors.staffHourRate}
                    helperText={touched.staffHourRate && errors.staffHourRate}
                  />
                </Box>
                <Typography fontWeight="bold" fontSize="16px">
                  Notes
                </Typography>
                <Box mt={-2}>
                  <TextField
                    fullWidth
                    variant="filled"
                    type="text"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.notes}
                    name="notes"
                    multiline
                    rows={3}
                    error={!!touched.notes && !!errors.notes}
                    helperText={touched.notes && errors.notes}
                  />
                </Box>
              </Box>
              {/* Submit Button */}
              <Box display="flex" justifyContent="end" mt="20px">
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  sx={{
                    backgroundColor: "#6870fa",
                    color: "white",
                    marginRight: 2,
                    fontSize: "16px",
                    "&:hover": {
                      backgroundColor: "#3e4396",
                    },
                  }}
                >
                  {loading ? "Adding..." : "Add"}
                </Button>
              </Box>
            </form>
          )}
        </Formik>
      </Box>
    );
  };
  
  const jobSchema = yup.object().shape({
    jobName: yup.string().required("Job Name is required"),
    description: yup.string().required("Description is required"),
    client: yup.string().required("Client is required"),
    assignedStaff: yup.array().of(yup.string().required()).min(1, "Select at least one staff member").required("Assigned Staff is required"),
    staffRates: yup.object(),
    orgNoOfhours: yup.number().required("Number of Hours is required"),
    orgHourRate: yup.number().required("Hourly Rate is required"),
    estNoOfhours: yup.number().required("Number of Hours is required"),
    staffHourRate: yup.number().required("Hourly Rate is required"),
    notes: yup.string(),
    jobDate: yup.date()
  });
  
  const initialValues = {
    jobName: "",
    description: "",
    client: "",
    assignedStaff: [],
    staffRates: {},
    orgNoOfhours: "",
    orgHourRate: "",
    estNoOfhours: "",
    staffHourRate: "",
    notes: "",
    jobDate:""
  };
  
  export default AddJob;
