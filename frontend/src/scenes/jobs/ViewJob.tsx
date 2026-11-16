import {
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "../../auth/AuthContext";
import DetailGrid from "../../components/DetailGrid";
import Header from "../../components/Header";
import { useWorkDescription } from "../../hooks/useWorkDescription";
import {
  useServiceMutation,
  useServiceQuery,
} from "../../queries/queryHelpers";
import { pageContainerSx } from "../../styles/uiStyles";
import type { Assignment, Client, Job } from "../../types/domain";
import type { AttendanceAction, AttendanceInput } from "../../types/requests";
import { errorMessage } from "../../utils/errors";
import { jobService } from "./jobService";

function ViewJob() {
  const { requestDescription, descriptionDialog } = useWorkDescription();
  const { user, hasPermission } = useAuth();
  const hideField = !hasPermission("jobs.financials.read");
  const fieldsToHide = hideField
    ? ["orgNoOfhours", "orgHourRate", "orgTotal"]
    : [];

  const { id } = useParams();
  const jobQuery = useServiceQuery(
    ["jobs", "detail", id],
    () => jobService.getById(id),
    {
      enabled: Boolean(id),
    },
  );
  const updateAttendance = useServiceMutation(
    ({
      action,
      jobId,
      body,
    }: {
      action: AttendanceAction;
      jobId: string | undefined;
      body: AttendanceInput;
    }) => jobService.updateAction(action, jobId, body),
    { invalidate: [["jobs", "detail", id], ["jobs"]] },
  );
  const [jobDetails, setJobDetails] = useState<
    Omit<Partial<Job>, "assignedStaff" | "client"> & {
      assignedStaff: string;
      client: Partial<Client>;
      staffAssignments: Assignment[];
    }
  >({
    jobName: "",
    description: "",
    client: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      address: "",
    },
    assignedStaff: "",
    staffAssignments: [],
    currentStaffAssignment: null,
    orgNoOfhours: 0,
    orgHourRate: 0,
    orgTotal: 0,
    staffPayTotal: 0,
    estNoOfhours: 0,
    jobStatus: "InProgress",
    notes: "",
    jobDate: "",
  });
  const attendanceUpdating = updateAttendance.isPending;

  const fieldNames = {
    jobName: "Job Name",
    description: "Description",
    orgNoOfhours: "Billable hours",
    orgHourRate: "Hourly rate charged to client",
    orgTotal: "Client charge total",
    staffPayTotal: "Staff Pay Total",
    estNoOfhours: "Estimated hours per cleaner",
    jobStatus: "Job Status",
    notes: "Notes",
    client: "Client",
    assignedStaff: "Assigned Staff",
    jobDate: "Start Time",
  };

  useEffect(() => {
    const job = jobQuery.data?.job;
    if (!job) return;
    const {
      jobName,
      description,
      client,
      assignedStaff,
      orgNoOfhours,
      orgHourRate,
      estNoOfhours,
      orgTotal,
      staffPayTotal,
      jobStatus,
      notes,
      jobDate,
    } = job;
    const formattedClient = {
      firstName: client.firstName || "",
      lastName: client.lastName || "",
      phoneNumber: client.phoneNumber || "",
      address: client.address || "",
    };
    const formattedAssignedStaff = (
      Array.isArray(assignedStaff) ? assignedStaff : [assignedStaff]
    )
      .map((staff) =>
        `${staff?.firstName || ""} ${staff?.lastName || ""}`.trim(),
      )
      .filter(Boolean)
      .join(", ");
    setJobDetails({
      jobName,
      description,
      client: formattedClient,
      assignedStaff: formattedAssignedStaff,
      staffAssignments: Array.isArray(job.staffAssignments)
        ? job.staffAssignments
        : [],
      currentStaffAssignment: job.currentStaffAssignment || null,
      orgNoOfhours,
      orgHourRate,
      estNoOfhours,
      orgTotal,
      staffPayTotal,
      jobStatus,
      notes,
      jobDate: jobDate ? new Date(jobDate).toLocaleString() : "",
    });
  }, [jobQuery.data]);

  const handleAttendanceToggle = async () => {
    const assignment = jobDetails.currentStaffAssignment;
    const isSignedIn = !!assignment?.isSignIn && !assignment?.isSignOff;
    const action = isSignedIn ? "signOffJob" : "signInJob";
    let body = {};
    if (isSignedIn) {
      const description = await requestDescription();
      if (description === null) return;
      body = { description };
    }
    try {
      const response = await updateAttendance.mutateAsync({
        action,
        jobId: id,
        body,
      });
      if (!response.success)
        throw new Error(response.message || "Attendance update failed");
      await jobQuery.refetch();
      Swal.fire(
        "Updated",
        `You have been signed ${isSignedIn ? "out" : "in"}.`,
        "success",
      );
    } catch (error) {
      Swal.fire(
        "Error",
        errorMessage(error) || "Could not update attendance.",
        "error",
      );
    }
  };

  return (
    <Box sx={{ ...pageContainerSx, maxWidth: 1100, mx: "auto" }}>
      {descriptionDialog}
      <Header title="Job details" subtitle={jobDetails.jobName} />
      <DetailGrid
        data={jobDetails}
        exclude={[
          ...fieldsToHide,
          "staffAssignments",
          "currentStaffAssignment",
          "signInTime",
          "signOffTime",
        ]}
        labels={fieldNames}
      />
      <Box sx={{ mt: 3 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ mb: 1.5 }}>
          Staff work records
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                {!hideField && <TableCell>Staff Member</TableCell>}
                <TableCell>Attendance Status</TableCell>
                {hideField && <TableCell>Action</TableCell>}
                <TableCell>Work Sessions (Sign In to Sign Out)</TableCell>
                <TableCell>Hours</TableCell>
                {!hideField && (
                  <>
                    <TableCell>Hourly Rate</TableCell>
                    <TableCell>Payment</TableCell>
                    <TableCell>Payment Status</TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {(hideField
                ? jobDetails.currentStaffAssignment
                  ? [jobDetails.currentStaffAssignment]
                  : []
                : jobDetails.staffAssignments
              ).map((assignment, index) => {
                const staff = assignment.staff || {};
                const displayName = hideField
                  ? user?.userName || "Your record"
                  : [staff.firstName, staff.lastName]
                      .filter(Boolean)
                      .join(" ") || `Staff member ${index + 1}`;
                const isSignedIn =
                  !!assignment?.isSignIn && !assignment?.isSignOff;
                const attendanceStatus = isSignedIn
                  ? "Signed In"
                  : assignment.isSignOff ||
                      (assignment.timeEntries || []).some(
                        (session) => session.signOffTime,
                      )
                    ? "Signed Out"
                    : "Not Started";
                const canSignIn = jobDetails.jobStatus === "InProgress";
                const formatTime = (value: string | null | undefined) =>
                  value ? new Date(value).toLocaleString() : "—";
                return (
                  <TableRow key={`${staff._id || displayName}-${index}`}>
                    {!hideField && <TableCell>{displayName}</TableCell>}
                    <TableCell>
                      <Chip
                        size="small"
                        label={attendanceStatus}
                        color={
                          isSignedIn
                            ? "success"
                            : attendanceStatus === "Signed Out"
                              ? "default"
                              : "warning"
                        }
                      />
                    </TableCell>
                    {hideField && (
                      <TableCell>
                        <Button
                          size="small"
                          variant="contained"
                          color={isSignedIn ? "secondary" : "primary"}
                          disabled={
                            attendanceUpdating || (!isSignedIn && !canSignIn)
                          }
                          onClick={handleAttendanceToggle}
                        >
                          {isSignedIn
                            ? "Sign Out"
                            : canSignIn
                              ? "Sign In"
                              : "Closed"}
                        </Button>
                      </TableCell>
                    )}
                    <TableCell>
                      {(assignment.timeEntries?.length
                        ? assignment.timeEntries
                        : [
                            {
                              signInTime: assignment.signInTime,
                              signOffTime: assignment.signOffTime,
                              hours: assignment.hours,
                              description: "",
                            },
                          ]
                      ).map((session, sessionIndex) => (
                        <Box key={sessionIndex}>
                          <Typography
                            variant="body2"
                            sx={{ whiteSpace: "nowrap" }}
                          >
                            {formatTime(session.signInTime)} to{" "}
                            {formatTime(session.signOffTime)} (
                            {Number(session.hours || 0).toFixed(2)} h)
                          </Typography>
                          {session.description && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ whiteSpace: "pre-wrap", ml: 1 }}
                            >
                              {session.description}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </TableCell>
                    <TableCell>
                      {Number(assignment.hours || 0).toFixed(2)}
                    </TableCell>
                    {!hideField && (
                      <>
                        <TableCell>
                          {Number(assignment.hourRate || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {Number(assignment.payment || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {assignment.paymentStatus || "Pending"}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
              {((hideField && !jobDetails.currentStaffAssignment) ||
                (!hideField && !jobDetails.staffAssignments.length)) && (
                <TableRow>
                  <TableCell colSpan={hideField ? 4 : 7}>
                    No staff work records yet.
                  </TableCell>
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
