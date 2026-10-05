import { createContext, useContext, useState } from 'react';

export const ModalBusyContext = createContext<((busy: boolean) => void) | null>(
  null,
);

// Share form pending state with the dialog's close controls, without coupling forms to it.
export function useFormPending(): [boolean, (pending: boolean) => void] {
  const [pending, setPending] = useState(false);
  const setModalBusy = useContext(ModalBusyContext);
  return [
    pending,
    (next) => {
      setPending(next);
      setModalBusy?.(next);
    },
  ];
}
