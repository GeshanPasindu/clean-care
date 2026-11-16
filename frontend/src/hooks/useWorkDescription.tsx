import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import FormField from "../components/forms/FormField";
import { workDescriptionSchema } from "../validation/forms";

export function useWorkDescription() {
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<((value: string | null) => void) | null>(null);
  const { control, handleSubmit, reset } = useForm<{ description: string }>({
    defaultValues: { description: "" },
    resolver: zodResolver(workDescriptionSchema),
  });
  useEffect(
    () => () => {
      resolveRef.current?.(null);
    },
    [],
  );
  const finish = (value: string | null) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOpen(false);
  };
  const requestDescription = () =>
    new Promise<string | null>((resolve) => {
      resolveRef.current?.(null);
      resolveRef.current = resolve;
      reset({ description: "" });
      setOpen(true);
    });
  const dialog = (
    <Dialog open={open} onClose={() => finish(null)} fullWidth maxWidth="sm">
      <DialogTitle>Describe the work completed</DialogTitle>
      <form
        onSubmit={handleSubmit(({ description }) => finish(description))}
        noValidate
      >
        <DialogContent>
          <FormField
            control={control}
            name="description"
            label="Work description"
            multiline
            minRows={4}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => finish(null)}>
            Keep working
          </Button>
          <Button type="submit" variant="contained">
            Save and sign out
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
  return { requestDescription, descriptionDialog: dialog };
}
