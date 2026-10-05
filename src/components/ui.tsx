import {
  Children,
  isValidElement,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import {
  Alert,
  Button as MuiButton,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Paper,
  TextField,
  type TextFieldProps,
} from '@mui/material';
import { useI18n } from '../i18n/context';
import { ModalBusyContext } from './modal-context';
import { Icon } from './Icon';
import { SelectField } from './SelectField';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> & {
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <MuiButton
      type="button"
      variant={variant === 'secondary' ? 'outlined' : 'contained'}
      color={variant === 'danger' ? 'error' : 'primary'}
      className={className}
      {...props}
    />
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Paper component="section" elevation={0} className={`card ${className}`}>
      {children}
    </Paper>
  );
}

// Preserve field handlers while rendering shared Material UI controls.
export function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  const id = useId();
  if (
    isValidElement<Record<string, unknown>>(children) &&
    ['input', 'textarea', 'select'].includes(String(children.type)) &&
    !['file', 'checkbox'].includes(String(children.props.type))
  ) {
    const {
      children: options,
      value,
      defaultValue,
      onChange,
      onBlur,
      required,
      disabled,
      type,
      name,
      autoFocus,
      ...htmlProps
    } = children.props;
    const fieldProps = {
      value,
      defaultValue,
      onChange,
      onBlur,
      required,
      disabled,
      name,
      autoFocus,
    } as TextFieldProps;
    if (children.type === 'select') {
      return (
        <SelectField
          {...fieldProps}
          id={id}
          label={label}
          error={!!error}
          helperText={error}
          className="field"
          options={Children.toArray(options as ReactNode).flatMap((option) => {
            if (
              !isValidElement<{
                value?: string | number;
                children?: ReactNode;
                disabled?: boolean;
              }>(option) ||
              option.type !== 'option'
            )
              return [];
            return [
              {
                value: String(option.props.value ?? ''),
                label: option.props.children,
                disabled: option.props.disabled,
              },
            ];
          })}
        />
      );
    }
    return (
      <TextField
        {...fieldProps}
        id={id}
        label={label}
        error={!!error}
        helperText={error}
        fullWidth
        className="field"
        type={children.type === 'input' ? String(type || 'text') : undefined}
        multiline={children.type === 'textarea'}
        minRows={children.type === 'textarea' ? 3 : undefined}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: {
            ...(htmlProps.inputMode === 'decimal'
              ? { pattern: '[0-9]+([.,][0-9]{1,2})?' }
              : {}),
            ...htmlProps,
          },
        }}
      >
        {options as ReactNode}
      </TextField>
    );
  }
  return (
    <label className="field native-field">
      <span>{label}</span>
      {children}
      {error && <span role="alert">{error}</span>}
    </label>
  );
}

export function Banner({
  children,
  alert = false,
}: {
  children: ReactNode;
  alert?: boolean;
}) {
  return (
    <Alert
      severity={alert ? 'warning' : 'info'}
      role={alert ? 'alert' : 'status'}
      className="banner"
    >
      {children}
    </Alert>
  );
}
export function Spinner() {
  const { t } = useI18n();
  return (
    <div role="status" aria-live="polite" className="loading">
      <CircularProgress size={24} />
      <span>{t('loading')}</span>
    </div>
  );
}
export function EmptyState({
  title,
  help,
  children,
}: {
  title: string;
  help: string;
  children?: ReactNode;
}) {
  return (
    <Card className="empty-state">
      <span aria-hidden="true" className="empty-symbol">
        <Icon name="check" size={28} />
      </span>
      <h2>{title}</h2>
      {help && <p>{help}</p>}
      {children}
    </Card>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const [formBusy, setFormBusy] = useState(false);
  const saving = busy || formBusy;
  const id = useId();
  const { t } = useI18n();
  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      aria-labelledby={id}
      aria-busy={saving}
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <DialogTitle component="div" className="modal-heading">
        <h2 id={id}>{title}</h2>
        <Button variant="secondary" disabled={saving} onClick={onClose}>
          {t('close')}
        </Button>
      </DialogTitle>
      <DialogContent className="modal-body">
        <ModalBusyContext.Provider value={setFormBusy}>
          {children}
        </ModalBusyContext.Provider>
      </DialogContent>
    </Dialog>
  );
}
