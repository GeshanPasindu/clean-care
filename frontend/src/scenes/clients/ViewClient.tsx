import { Box, Button } from "@mui/material";
import { Link, useParams } from "react-router-dom";
import DetailGrid from "../../components/DetailGrid";
import Header from "../../components/Header";
import { pageContainerSx, pageHeaderRowSx } from "../../styles/uiStyles";
import { useClient } from "./clientQueries";

const ViewClient = () => {
  const { id } = useParams();
  const { data: responseData } = useClient(id);
  const clientDetails = responseData?.client || {
    firstName: "",
    lastName: "",
    email: "",
    address: "",
    phoneNumber: "",
    contactName: "",
    contactPhoneNumber: "",
    contactEmail: "",
    accountManager: "",
    notes: "",
    clientStatus: "",
  };

  return (
    <Box sx={{ ...pageContainerSx, maxWidth: 1100, mx: "auto" }}>
      <Box sx={pageHeaderRowSx}>
        <Header
          title="Client details"
          subtitle={[clientDetails.firstName, clientDetails.lastName]
            .filter(Boolean)
            .join(" ")}
        />
        <Link
          to={`/clients/viewClient/${id}/jobs`}
          style={{ textDecoration: "none" }}
        >
          <Button variant="contained">View Client Jobs</Button>
        </Link>
      </Box>
      <DetailGrid
        data={clientDetails}
        exclude={["_id", "createdAt", "__v", "updatedAt", "tenantId"]}
      />
    </Box>
  );
};

export default ViewClient;
