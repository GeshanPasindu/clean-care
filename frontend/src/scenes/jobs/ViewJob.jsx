import { Box, Button, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Header from "../../components/Header";
import axios from "../../auth/apiClient";
import { environment } from "../../environment";
import DetailGrid from "../../components/DetailGrid";
import { pageContainerSx } from "../../styles/uiStyles";
import { useAuth } from "../../auth/AuthContext";
import Swal from "sweetalert2";

function ViewJob() {
  const { user } = useAuth();
  const userRole = user?.role;
  const hideField = userRole === "staff";
  const fieldsToHide = hideField
    ? ["orgNoOfhours", "orgHourRate", "orgTotal"]
    : [];


  const { id } = useParams();
  const [jobDetails, setJobDetails] = useState({
    jobName: "",
    description: "",
    client: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      address :""
    },
    assignedStaff: "",
    staffAssignments: [],
    currentStaffAssignment: null,
    orgNoOfhours: "",
    orgHourRate: "",
    orgTotal: "",
    staffPayTotal: "",
    estNoOfhours: "",
    staffHourRate: "",
    jobStatus: "",
    notes: "",
    jobDate:"",
  });
  const [attendanceUpdating, setAttendanceUpdating] = useState(false);

  const fieldNames = {
    jobName: "Job Name",
    description: "Description",
    orgNoOfhours: "Original Number of Hours",
    orgHourRate: "Original Hour Rate",
    orgTotal: "Original Total",
    staffPayTotal: "Staff Pay Total",
    estNoOfhours: "Estimated Number of Hours",
    staffHourRate: "Staff Hour Rate",
    jobStatus: "Job Status",
    notes: "Notes",
    client: "Client",
    assignedStaff: "Assigned Staff",
    jobDate :"Start Time",
  };

  useEffect(() => {
    fetchJobDetails();
  }, [id]);

  const fetchJobDetails = async () => {
    try {
      const response = await axios.get(environment.apiUrl + `/job/getJobById/${id}`);
      const responseData = response.data;
      console.log(responseData)
      if (responseData.success) {
        const { job } = responseData;
        const { jobName, description, client, assignedStaff, orgNoOfhours, orgHourRate, estNoOfhours, staffHourRate, orgTotal, staffPayTotal, jobStatus, notes ,jobDate } = job;
        const formattedClient = {
          firstName: client.firstName,
          lastName: client.lastName,
          phoneNumber: client.phoneNumber,
          address:client.address
        };
        const formattedAssignedStaff = (Array.isArray(assignedStaff) ? assignedStaff : [assignedStaff])
          .map((staff) => `${staff?.firstName || ""} ${staff?.lastName || ""}`.trim())
          .filter(Boolean)
          .join(", ");
        setJobDetails({
          jobName,
          description,
          client: formattedClient,
          assignedStaff: formattedAssignedStaff,
          staffAssignments: Array.isArray(job.staffAssignments) ? job.staffAssignments : [],
          currentStaffAssignment: job.currentStaffAssignment || null,
          orgNoOfhours,
          orgHourRate,
          estNoOfhours,
          staffHourRate,
          orgTotal,
          staffPayTotal,
          jobStatus,
          notes,
          jobDate: jobDate ? new Date(jobDate).toLocaleString() : "",
        });
      } else {
        console.error("Failed to fetch job details:");
      }
    } catch (error) {
      console.error("Error fetching job details:", error);
    }
  };

  const handleAttendanceToggle = async () => {
    const assignment = jobDetails.currentStaffAssignment || {};
    const isSignedIn = !!assignment.isSignIn && !assignment.isSignOff;
    const action = isSignedIn ? "signOffJob" : "signInJob";
    let body = {};
    if (isSignedIn) {
      const result = await Swal.fire({
        title: "Describe the work completed",
        input: "textarea",
        inputPlaceholder: "Add a short description of the work...",
        inputAttributes: { maxlength: "1000", "aria-label": "Work description" },
        inputValidator: (value) => !value?.trim() ? "Enter a work description before signing out." : undefined,
        showCancelButton: true,
        confirmButtonText: "Save and sign out",
        cancelButtonText: "Keep working",
      });
      if (!result.isConfirmed) return;
      body = { description: result.value.trim() };
    }
    setAttendanceUpdating(true);
    try {
      const response = await axios.put(`${environment.apiUrl}/job/${action}/${id}`, body);
      if (!response.data.success) throw new Error(response.data.message || "Attendance update failed");
      await fetchJobDetails();
      Swal.fire("Updated", `You have been signed ${isSignedIn ? "out" : "in"}.`, "success");
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || error.message || "Could not update attendance.", "error");
    } finally {
      setAttendanceUpdating(false);
    }
  };

  return (
    <Box sx={{ ...pageContainerSx, maxWidth: 1100, mx: "auto" }}>
    <Header title="Job details" subtitle={jobDetails.jobName} />
    <DetailGrid data={jobDetails} exclude={[...fieldsToHide, "staffAssignments", "currentStaffAssignment", "signInTime", "signOffTime"]} labels={fieldNames} />
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 1.5 }}>Staff work records</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {!hideField && <TableCell>Staff Member</TableCell>}
              <TableCell>Attendance Status</TableCell>
              {hideField && <TableCell>Action</TableCell>}
              <TableCell>Work Sessions (Sign In to Sign Out)</TableCell>
              <TableCell>Hours</TableCell>
              {!hideField && <>
                <TableCell>Hourly Rate</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell>Payment Status</TableCell>
              </>}
            </TableRow>
          </TableHead>
          <TableBody>
            {(hideField
              ? jobDetails.currentStaffAssignment ? [jobDetails.currentStaffAssignment] : []
              : jobDetails.staffAssignments
            ).map((assignment, index) => {
              const staff = assignment.staff || {};
              const displayName = hideField
                ? user?.userName || "Your record"
                : [staff.firstName, staff.lastName].filter(Boolean).join(" ") || `Staff member ${index + 1}`;
              const isSignedIn = !!assignment.isSignIn && !assignment.isSignOff;
              const attendanceStatus = isSignedIn
                ? "Signed In"
                : assignment.isSignOff || (assignment.timeEntries || []).some((session) => session.signOffTime)
                  ? "Signed Out"
                  : "Not Started";
              const canSignIn = jobDetails.jobStatus === "InProgress";
              const formatTime = (value) => value ? new Date(value).toLocaleString() : "—";
              return (
                <TableRow key={`${staff._id || displayName}-${index}`}>
                  {!hideField && <TableCell>{displayName}</TableCell>}
                  <TableCell>
                    <Chip
                      size="small"
                      label={attendanceStatus}
                      color={isSignedIn ? "success" : attendanceStatus === "Signed Out" ? "default" : "warning"}
                    />
                  </TableCell>
                  {hideField && <TableCell>
                    <Button
                      size="small"
                      variant="contained"
                      color={isSignedIn ? "secondary" : "primary"}
                      disabled={attendanceUpdating || (!isSignedIn && !canSignIn)}
                      onClick={handleAttendanceToggle}
                    >
                      {isSignedIn ? "Sign Out" : canSignIn ? "Sign In" : "Closed"}
                    </Button>
                  </TableCell>}
                  <TableCell>
                    {(assignment.timeEntries?.length
                      ? assignment.timeEntries
                      : [{ signInTime: assignment.signInTime, signOffTime: assignment.signOffTime, hours: assignment.hours }]
                    ).map((session, sessionIndex) => (
                      <Box key={sessionIndex}>
                        <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                          {formatTime(session.signInTime)} to {formatTime(session.signOffTime)} ({Number(session.hours || 0).toFixed(2)} h)
                        </Typography>
                        {session.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", ml: 1 }}>
                            {session.description}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </TableCell>
                  <TableCell>{Number(assignment.hours || 0).toFixed(2)}</TableCell>
                  {!hideField && <>
                    <TableCell>{Number(assignment.hourRate || 0).toFixed(2)}</TableCell>
                    <TableCell>{Number(assignment.payment || 0).toFixed(2)}</TableCell>
                    <TableCell>{assignment.paymentStatus || "Pending"}</TableCell>
                  </>}
                </TableRow>
              );
            })}
            {((hideField && !jobDetails.currentStaffAssignment) || (!hideField && !jobDetails.staffAssignments.length)) && (
              <TableRow>
                <TableCell colSpan={hideField ? 4 : 7}>No staff work records yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  </Box>
  );
}

export default ViewJob;
