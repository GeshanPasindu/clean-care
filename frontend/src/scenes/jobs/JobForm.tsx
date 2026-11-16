import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Grid,
  ListItemText,
  MenuItem,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import type { z } from "zod";
import Header from "../../components/Header";
import FormField from "../../components/forms/FormField";
import {
  useServiceMutation,
  useServiceQuery,
} from "../../queries/queryHelpers";
import { formPageSx } from "../../styles/uiStyles";
import { errorMessage } from "../../utils/errors";
import {
  jobDefaults,
  jobFormSchema,
  type JobValues,
} from "../../validation/forms";
import { useActiveClients } from "../clients/clientQueries";
import { useAssignableStaff } from "../users/userQueries";
import { jobService } from "./jobService";

type FormInput = z.input<typeof jobFormSchema>;
const numbers = [
  ["orgNoOfhours", "Billable hours"],
  ["orgHourRate", "Hourly rate charged to client"],
  ["estNoOfhours", "Estimated hours per cleaner"],
] as const;
export default function JobForm({ editing = false }: { editing?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const clients = useActiveClients();
  const employees = useAssignableStaff();
  const query = useServiceQuery(
    ["jobs", "detail", id],
    () => jobService.getById(id),
    { enabled: editing && Boolean(id) },
  );
  const create = useServiceMutation(jobService.create, {
    invalidate: [["jobs"]],
  });
  const update = useServiceMutation(
    (values: Omit<JobValues, "jobDate">) => jobService.update(id, values),
    { invalidate: [["jobs"]] },
  );
  const [error, setError] = useState("");
  const {
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormInput, unknown, JobValues>({
    defaultValues: jobDefaults,
    resolver: zodResolver(jobFormSchema),
  });
  const staffIds = useWatch({ control, name: "assignedStaff" });
  useEffect(() => {
    const job = query.data?.job;
    if (!job) return;
    reset({
      ...jobDefaults,
      ...job,
      client: job.client._id,
      assignedStaff: job.assignedStaff.map((staff) => staff._id),
      staffRates: Object.fromEntries(
        job.staffAssignments
          .filter((assignment) => assignment.isAssigned !== false)
          .map((assignment) => [assignment.staff._id, assignment.hourRate]),
      ),
      jobDate: "",
      notes: job.notes || "",
    });
  }, [query.data, reset]);
  useEffect(() => {
    const rates = getValues("staffRates");
    const next = Object.fromEntries(
      staffIds.map((staffId) => [staffId, rates[staffId] ?? ""]),
    );
    if (JSON.stringify(rates) !== JSON.stringify(next))
      setValue("staffRates", next, { shouldDirty: true });
  }, [staffIds, getValues, setValue]);
  const submit = handleSubmit(async (values) => {
    setError("");
    try {
      if (editing) {
        const { jobDate, ...updates } = values;
        await update.mutateAsync(updates);
      } else await create.mutateAsync(values);
      navigate("/jobs");
    } catch (error) {
      setError(errorMessage(error));
    }
  });
  if (editing && query.isPending) return <CircularProgress />;
  if (editing && query.isError)
    return <Alert severity="error">{query.error.message}</Alert>;
  const staff = employees.data?.users || [];
  return (
    <Box sx={formPageSx}>
      <Header
        title={editing ? "Edit job" : "Add job"}
        subtitle="Client, staff assignments, and billing"
      />
      {error && (
        <Alert severity="error" sx={{ my: 2 }}>
          {error}
        </Alert>
      )}
      {(clients.isError || employees.isError) && (
        <Alert severity="error">
          Could not load clients or staff. Please reload before saving.
        </Alert>
      )}
      <Box component="form" onSubmit={submit} noValidate sx={{ mt: 3 }}>
        <Grid container spacing={2.5}>
          <Grid item xs={12}>
            <FormField control={control} name="jobName" label="Job name" />
          </Grid>
          <Grid item xs={12}>
            <FormField
              control={control}
              name="description"
              label="Description"
              multiline
              minRows={3}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormField control={control} name="client" label="Client" select>
              {(clients.data?.clients || []).map((client) => (
                <MenuItem key={client._id} value={client._id}>
                  {client.firstName} {client.lastName}
                </MenuItem>
              ))}
            </FormField>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormField
              control={control}
              name="assignedStaff"
              label="Assigned Staff"
              select
              SelectProps={{
                multiple: true,
                renderValue: (value) =>
                  Array.isArray(value)
                    ? staff
                        .filter((user) => value.includes(user._id))
                        .map((user) => `${user.firstName} ${user.lastName}`)
                        .join(", ")
                    : "",
              }}
            >
              {staff.map((user) => (
                <MenuItem key={user._id} value={user._id}>
                  <Checkbox checked={staffIds.includes(user._id)} />
                  <ListItemText
                    primary={`${user.firstName} ${user.lastName}`}
                  />
                </MenuItem>
              ))}
            </FormField>
          </Grid>
          {numbers.map(([name, label]) => (
            <Grid item xs={12} md={6} key={name}>
              <FormField
                control={control}
                name={name}
                label={label}
                type="number"
                inputProps={{ min: 0, step: "any" }}
              />
            </Grid>
          ))}
          {staffIds.map((staffId) => {
            const user = staff.find((person) => person._id === staffId);
            return (
              <Grid item xs={12} md={6} key={staffId}>
                <FormField
                  control={control}
                  name={`staffRates.${staffId}`}
                  label={`Hourly pay for ${user ? `${user.firstName} ${user.lastName}` : "assigned cleaner"}`}
                  helperText="Amount paid to this cleaner for each hour worked."
                  type="number"
                  inputProps={{ min: 0, step: "any" }}
                />
              </Grid>
            );
          })}
          {!editing && (
            <Grid item xs={12} md={6}>
              <FormField
                control={control}
                name="jobDate"
                label="Start time"
                type="datetime-local"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          )}
          <Grid item xs={12}>
            <FormField
              control={control}
              name="notes"
              label="Notes"
              multiline
              minRows={3}
            />
          </Grid>
        </Grid>
        <Box
          sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}
        >
          <Button onClick={() => navigate("/jobs")}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || clients.isPending || employees.isPending}
          >
            {editing ? "Save changes" : "Create job"}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
