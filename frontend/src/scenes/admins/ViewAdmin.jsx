import { Box } from "@mui/material";
import { useParams } from "react-router-dom";
import Header from "../../components/Header";
import DetailGrid from "../../components/DetailGrid";
import { pageContainerSx } from "../../styles/uiStyles";
import { useServiceQuery } from "../../queries/queryHelpers";
import { userService } from "../../services/userService";

const ViewAdmin = () => {
  const { id } = useParams();
  const { data: responseData } = useServiceQuery(
    ["users", "detail", id],
    () => userService.getById(id),
    { enabled: Boolean(id) }
  );
  const userData = responseData?.userDetails;
  const adminDetails = {
    firstName: userData?.adminDetails?.firstName || "",
    lastName: userData?.adminDetails?.lastName || "",
    position: userData?.adminDetails?.position || "",
    userName: userData?.userName || "",
    email: userData?.email || "",
    Status: userData?.status || "",
  };

  return (
    <Box sx={{ ...pageContainerSx, maxWidth: 1000, mx: "auto" }}>
      <Header title="Administrator details" subtitle={[adminDetails.firstName, adminDetails.lastName].filter(Boolean).join(" ") || adminDetails.userName} />
      <DetailGrid data={adminDetails} exclude={["_id"]} />
    </Box>
  );
};

export default ViewAdmin;
