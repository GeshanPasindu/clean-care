import AttachMoneyRoundedIcon from "@mui/icons-material/AttachMoneyRounded";
import Groups2OutlinedIcon from "@mui/icons-material/Groups2Outlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import { Box, Card, CardContent, Grid, Skeleton, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import axios from "axios";
import React, { useEffect, useState } from "react";
import Header from "../../components/Header";
import { environment } from "../../environment";
import { pageContainerSx, pageHeaderRowSx } from "../../styles/uiStyles";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const MetricCard = ({ label, value, icon, color, loading, currency = false }) => {
  const theme = useTheme();
  const Icon = icon;

  return (
    <Card sx={{ height: "100%", transition: "transform 180ms ease, box-shadow 180ms ease", "&:hover": { transform: "translateY(-2px)", boxShadow: 4 } }}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography color="text.secondary" sx={{ fontSize: "0.85rem", fontWeight: 600, mb: 1 }}>
              {label}
            </Typography>
            {loading ? (
              <Skeleton width={110} height={42} />
            ) : (
              <Typography variant="h2" sx={{ fontSize: { xs: "1.65rem", lg: "1.9rem" }, wordBreak: "break-word" }}>
                {currency ? currencyFormatter.format(Number(value) || 0) : Number(value) || 0}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              flex: "0 0 auto",
              display: "grid",
              placeItems: "center",
              borderRadius: 2.5,
              color,
              backgroundColor: alpha(color, theme.palette.mode === "dark" ? 0.16 : 0.1),
            }}
          >
            <Icon sx={{ fontSize: 25 }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState({
    staff: 0,
    clients: 0,
    jobs: 0,
    totalPayments: 0,
    staffPayments: 0,
    profit: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [staffResponse, clientResponse, jobResponse, totalsResponse] = await Promise.all([
          axios.get(`${environment.apiUrl}/staff/getAllStaffCount`),
          axios.get(`${environment.apiUrl}/client/getAllClientCount`),
          axios.get(`${environment.apiUrl}/job/getCount`),
          axios.get(`${environment.apiUrl}/job/getTotalAndProfit`),
        ]);
        const totals = totalsResponse.data.data || {};

        setMetrics({
          staff: staffResponse.data.count || 0,
          clients: clientResponse.data.count || 0,
          jobs: jobResponse.data.count || 0,
          totalPayments: totals.totalOrgTotal || 0,
          staffPayments: totals.totalStaffPayTotal || 0,
          profit: totals.totalProfit || 0,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, []);

  const cards = [
    { label: "Staff members", value: metrics.staff, icon: PeopleAltOutlinedIcon, color: "#4f46e5" },
    { label: "Active clients", value: metrics.clients, icon: Groups2OutlinedIcon, color: "#0ea5e9" },
    { label: "Total jobs", value: metrics.jobs, icon: WorkOutlineRoundedIcon, color: "#8b5cf6" },
    { label: "Total payments", value: metrics.totalPayments, icon: AttachMoneyRoundedIcon, color: "#12b76a", currency: true },
    { label: "Staff payments", value: metrics.staffPayments, icon: PaymentsOutlinedIcon, color: "#f79009", currency: true },
    { label: "Gross profit", value: metrics.profit, icon: TrendingUpRoundedIcon, color: "#ec4899", currency: true },
  ];

  return (
    <Box sx={pageContainerSx}>
      <Box sx={pageHeaderRowSx}>
        <Header title="Dashboard" subtitle="A clear overview of your business today" />
        <Typography
          sx={{
            color: "text.secondary",
            fontSize: "0.85rem",
            px: 1.5,
            py: 0.75,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            backgroundColor: "background.paper",
          }}
        >
          {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}
        </Typography>
      </Box>

      <Grid container spacing={2.5}>
        {cards.map((card) => (
          <Grid item xs={12} sm={6} xl={4} key={card.label}>
            <MetricCard {...card} loading={loading} />
          </Grid>
        ))}
      </Grid>

      <Card sx={{ mt: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 }, "&:last-child": { pb: { xs: 2.5, sm: 3 } } }}>
          <Typography variant="h3" sx={{ mb: 0.75 }}>
            Financial snapshot
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Current payment distribution across the business.
          </Typography>
          <Grid container spacing={3}>
            {cards.slice(3).map((card) => (
              <Grid item xs={12} sm={4} key={`summary-${card.label}`}>
                <Typography color="text.secondary" sx={{ fontSize: "0.8rem", mb: 0.75 }}>
                  {card.label}
                </Typography>
                {loading ? (
                  <Skeleton width="70%" height={34} />
                ) : (
                  <Typography variant="h3">{currencyFormatter.format(Number(card.value) || 0)}</Typography>
                )}
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AdminDashboard;
