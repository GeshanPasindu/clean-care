export const pageContainerSx = {
  width: "100%",
  minWidth: 0,
  px: { xs: 2, sm: 2.5, lg: 3.5 },
  py: { xs: 2, sm: 3 },
};

export const pageHeaderRowSx = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: { xs: "flex-start", sm: "center" },
  flexDirection: { xs: "column", sm: "row" },
  gap: 2,
  mb: 2.5,
};

export const surfaceSx = {
  backgroundColor: "background.paper",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 3,
  boxShadow: "0 2px 10px rgba(16, 24, 40, 0.04)",
};

export const tableSurfaceSx = {
  ...surfaceSx,
  mt: 2,
  height: { xs: "68vh", md: "calc(100vh - 235px)" },
  minHeight: 440,
  overflow: "hidden",
  "& .MuiDataGrid-root": {
    border: "none",
    fontSize: "0.875rem",
  },
  "& .MuiDataGrid-columnHeaders": {
    backgroundColor: "background.default",
    borderBottom: "1px solid",
    borderColor: "divider",
  },
  "& .MuiDataGrid-columnHeaderTitle": {
    fontWeight: 700,
  },
  "& .MuiDataGrid-cell": {
    borderBottom: "1px solid",
    borderColor: "divider",
  },
  "& .MuiDataGrid-row:hover": {
    backgroundColor: "action.hover",
  },
  "& .MuiDataGrid-virtualScroller": {
    backgroundColor: "background.paper",
  },
  "& .MuiDataGrid-footerContainer": {
    borderTop: "1px solid",
    borderColor: "divider",
    backgroundColor: "background.paper",
  },
  "& .MuiDataGrid-toolbarContainer": {
    px: 2,
    py: 1.25,
    gap: 0.5,
    borderBottom: "1px solid",
    borderColor: "divider",
  },
  "& .MuiDataGrid-toolbarContainer .MuiButton-text": {
    color: "text.secondary !important",
  },
  "& .MuiCheckbox-root": {
    color: "primary.main !important",
  },
  "& .MuiSelect-select": {
    py: 0.75,
  },
};

export const filterBarSx = {
  ...surfaceSx,
  display: "flex",
  alignItems: "flex-end",
  flexWrap: "wrap",
  gap: 1.5,
  p: 2,
  mb: 2,
  "& > .MuiBox-root": {
    minWidth: { xs: "100%", sm: 150 },
  },
  "& .MuiButton-root": {
    mb: 0.25,
  },
};

export const formPageSx = {
  ...pageContainerSx,
  maxWidth: 1120,
  mx: "auto",
  height: "auto",
  overflow: "visible",
  "& form": {
    ...surfaceSx,
    mt: 2.5,
    p: { xs: 2, sm: 3 },
  },
  "& form > .MuiBox-root:first-of-type[style], & form > .MuiBox-root:first-of-type": {
    gridTemplateColumns: { xs: "1fr", md: "minmax(170px, 230px) minmax(0, 1fr)" },
    columnGap: 3,
    rowGap: 1.5,
  },
  "& form > .MuiBox-root:first-of-type > .MuiTypography-root": {
    alignSelf: "center",
    color: "text.primary",
    fontSize: "0.875rem",
  },
  "& form > .MuiBox-root:first-of-type > .MuiBox-root": {
    marginTop: "0 !important",
  },
};

export const formSurfaceSx = {
  ...surfaceSx,
  p: { xs: 2, sm: 3 },
  "& form > .MuiBox-root:first-of-type": {
    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
    columnGap: 3,
    rowGap: 1.5,
  },
};

export const actionButtonSx = {
  whiteSpace: "nowrap",
};
