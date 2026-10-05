import type { ReactNode } from 'react';
import { MenuItem, TextField, type TextFieldProps } from '@mui/material';

export type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export function SelectField({
  options,
  ...props
}: Omit<TextFieldProps, 'select' | 'children' | 'slotProps'> & {
  options: readonly SelectOption[];
}) {
  return (
    <TextField
      {...props}
      select
      fullWidth
      slotProps={{
        inputLabel: { shrink: true },
        select: {
          displayEmpty: true,
          MenuProps: {
            slotProps: { paper: { sx: { maxHeight: 320, mt: 0.5 } } },
          },
        },
      }}
    >
      {options.map((option) => (
        <MenuItem
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          sx={{ minHeight: 48, whiteSpace: 'normal', overflowWrap: 'anywhere' }}
        >
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
