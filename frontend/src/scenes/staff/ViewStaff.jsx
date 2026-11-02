import { Box, Button } from "@mui/material";
import { useParams, Link } from "react-router-dom";
import Header from "../../components/Header";
import DetailGrid from "../../components/DetailGrid";
import { pageContainerSx, pageHeaderRowSx } from "../../styles/uiStyles";
import { useStaffById } from "./staffQueries";
import { useServiceQuery } from "../../queries/queryHelpers";
import { userService } from "../../services/userService";

const ViewStaff = () => {
  const { id } = useParams();
  const staffQuery = useStaffById(id);
  const staffDetails = staffQuery.data?.staff || {
    firstName: "",
    lastName: "",
    address: "",
    email: "",
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
    workStatus: "",
    supervisorName: "",
  };
  const userId = typeof staffDetails.user === "object"
    ? staffDetails.user?._id
    : staffDetails.user;
  const { data: userResponse } = useServiceQuery(
    ["users", "detail", userId],
    () => userService.getById(userId),
    { enabled: Boolean(userId) }
  );
  const userEmail = userResponse?.userDetails?.email || "";

  return (
    <Box sx={{ ...pageContainerSx, maxWidth: 1100, mx: "auto" }}>
      <Box sx={pageHeaderRowSx}>
        <Header title="Staff details" subtitle={[staffDetails.firstName, staffDetails.lastName].filter(Boolean).join(" ")} />
        <Link to={`/staff/viewstaff/${id}/jobs`} style={{ textDecoration: "none" }}>
          <Button variant="contained">
            Payroll & Job History
          </Button>
        </Link>
      </Box>
      <DetailGrid
        data={{ ...staffDetails, email: userEmail }}
        exclude={["_id", "createdAt", "__v", "updatedAt", "user", "adminId"]}
      />
    </Box>
  );
};

export default ViewStaff;
