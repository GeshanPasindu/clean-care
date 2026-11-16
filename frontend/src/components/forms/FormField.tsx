import { TextField, type TextFieldProps } from "@mui/material";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

export type FormFieldProps<T extends FieldValues> = Omit<
  TextFieldProps,
  "name" | "value" | "defaultValue" | "onChange" | "onBlur"
> & { control: Control<T>; name: FieldPath<T> };
export default function FormField<T extends FieldValues>({
  control,
  name,
  ...props
}: FormFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { ref, ...field }, fieldState }) => (
        <TextField
          {...props}
          {...field}
          value={field.value ?? ""}
          inputRef={ref}
          fullWidth
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message || props.helperText}
        />
      )}
    />
  );
}
