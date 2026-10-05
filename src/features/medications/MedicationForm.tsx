import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCopy } from '../../i18n/ux';
import { useI18n } from '../../i18n/context';
import { Banner, Button, Card, Field } from '../../components/ui';
import { useFormPending } from '../../components/modal-context';
import { useCareBackend } from '../../lib/backend';
import { useOnline } from '../../lib/network';
import {
  dayLabels,
  doseRows,
  inputFor,
  medicationSchema,
  weekDays,
  type MedicationGroup,
} from './model';
import { useMedicationActions } from './queries';
import { useAuth } from '../../app/auth-context';
import { supabase } from '../../lib/supabase';
import { MedicationPhoto } from './Photo';
import { uploadMedicationPhoto } from './upload-photo';

export function MedicationForm({
  group,
  onClose,
}: {
  group?: MedicationGroup;
  onClose?: () => void;
}) {
  const { t } = useI18n();
  const copy = useCopy();
  const navigate = useNavigate();
  const online = useOnline();
  const backend = useCareBackend();
  const [input, setInput] = useState(() => inputFor(group));
  const [pending, setPending] = useFormPending();
  const [error, setError] = useState<'validation' | 'saveError' | null>(null);
  const { save } = useMedicationActions();
  const { session } = useAuth();
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const photoInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const finish = () => (onClose ? onClose() : navigate('/medications'));
  return (
    <Card>
      <form
        className="care-form"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setFieldErrors({});
          const parsed = medicationSchema.safeParse(input);
          if (!parsed.success) {
            setError('validation');
            setFieldErrors(
              Object.fromEntries(
                parsed.error.issues.map((issue) => [
                  String(issue.path[0]),
                  issue.message === 'Duplicate times'
                    ? t('duplicateTimes')
                    : issue.message === 'End before start'
                      ? t('endBeforeStart')
                      : issue.path[0] === 'days'
                        ? t('chooseDays')
                        : t('checkField'),
                ]),
              ),
            );
            return;
          }
          try {
            doseRows(parsed.data, group);
          } catch {
            setFieldErrors({ times: t('invalidSchedule') });
            setError('validation');
            return;
          }
          if ((input.refillOn || input.followup) && backend.data !== true) {
            setError('saveError');
            return;
          }
          setPending(true);
          void (async () => {
            let uploaded: string | undefined;
            const previous = group?.rows[0].photo_path;
            try {
              if (photo)
                uploaded = await uploadMedicationPhoto(photo, session!.user.id);
              await save(
                parsed.data,
                group,
                uploaded || (removePhoto ? '' : previous),
              );
            } catch (error) {
              if (uploaded)
                await supabase.storage
                  .from('medication-photos')
                  .remove([uploaded]);
              throw error;
            }
            if (previous && (uploaded || removePhoto))
              await supabase.storage
                .from('medication-photos')
                .remove([previous]);
          })()
            .then(finish)
            .catch(() => setError('saveError'))
            .finally(() => setPending(false));
        }}
      >
        <h2>{t('medicationDetails')}</h2>
        <Field label={t('name')} error={fieldErrors.title}>
          <input
            required
            maxLength={120}
            placeholder={t('namePlaceholder')}
            value={input.title}
            onChange={(event) =>
              setInput({ ...input, title: event.target.value })
            }
            autoComplete="off"
          />
        </Field>
        <Field label={t('dose')} error={fieldErrors.dose}>
          <input
            required
            maxLength={120}
            placeholder={t('dosePlaceholder')}
            value={input.dose}
            onChange={(event) =>
              setInput({ ...input, dose: event.target.value })
            }
            autoComplete="off"
          />
        </Field>
        <details className="form-details">
          <summary>
            {t('photo')} · {copy.optional}
          </summary>
          {preview && (
            <img src={preview} className="medicine-photo" alt={t('photoAlt')} />
          )}
          {!preview && !removePhoto && group?.rows[0].photo_path && (
            <MedicationPhoto path={group.rows[0].photo_path} />
          )}
          <div className="field">
            <span>{t('photo')}</span>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => photoInput.current?.click()}
            >
              {t('choosePhoto')}
            </Button>
            <input
              ref={photoInput}
              className="sr-only"
              aria-label={t('photo')}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setPhotoError(
                  !!file &&
                    (!['image/jpeg', 'image/png', 'image/webp'].includes(
                      file.type,
                    ) ||
                      file.size > 4194304),
                );
                if (
                  file &&
                  ['image/jpeg', 'image/png', 'image/webp'].includes(
                    file.type,
                  ) &&
                  file.size <= 4194304
                ) {
                  setPhoto(file);
                  setPreview(URL.createObjectURL(file));
                  setRemovePhoto(false);
                } else {
                  setPhoto(null);
                  setPreview(null);
                }
              }}
            />
          </div>
          <p>{t('photoHelp')}</p>
          {photoError && <Banner alert>{t('photoError')}</Banner>}
          {(photo || (!removePhoto && group?.rows[0].photo_path)) && (
            <Button
              variant="secondary"
              onClick={() => {
                setPhoto(null);
                setPreview(null);
                setPhotoError(false);
                if (photoInput.current) photoInput.current.value = '';
                setRemovePhoto(true);
              }}
            >
              {t('removePhoto')}
            </Button>
          )}
        </details>
        <h2>{t('schedule')}</h2>
        <p>{t('scheduleHelp')}</p>
        <fieldset>
          <legend>{t('times')}</legend>
          {input.times.map((time, index) => (
            <div className="time-row" key={index}>
              <Field
                label={`${t('times')} ${index + 1}`}
                error={fieldErrors.times}
              >
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(event) =>
                    setInput({
                      ...input,
                      times: input.times.map((value, i) =>
                        i === index ? event.target.value : value,
                      ),
                    })
                  }
                />
              </Field>
              {input.times.length > 1 && (
                <Button
                  variant="secondary"
                  aria-label={`${t('removeTime')} ${index + 1}`}
                  onClick={() =>
                    setInput({
                      ...input,
                      times: input.times.filter((_, i) => i !== index),
                    })
                  }
                >
                  {t('removeTime')}
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="secondary"
            disabled={input.times.length >= 8}
            onClick={() =>
              setInput({
                ...input,
                times: [
                  ...input.times,
                  [
                    '20:00',
                    '08:00',
                    '12:00',
                    '16:00',
                    '22:00',
                    '06:00',
                    '10:00',
                    '18:00',
                    '14:00',
                  ].find((time) => !input.times.includes(time))!,
                ],
              })
            }
          >
            {t('addTime')}
          </Button>
        </fieldset>
        <fieldset>
          <legend>{t('days')}</legend>
          <Button
            className="everyday-shortcut"
            variant="secondary"
            onClick={() => setInput({ ...input, days: [...weekDays] })}
          >
            {t('everyday')}
          </Button>
          {fieldErrors.days && <Banner alert>{fieldErrors.days}</Banner>}
          <div className="day-options">
            {weekDays.map((day, index) => (
              <label className="checkbox" key={day}>
                <input
                  type="checkbox"
                  checked={input.days.includes(day)}
                  onChange={(event) =>
                    setInput({
                      ...input,
                      days: event.target.checked
                        ? [...input.days, day]
                        : input.days.filter((value) => value !== day),
                    })
                  }
                />
                {t(dayLabels[index])}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-grid">
          <Field label={t('startDate')} error={fieldErrors.startDate}>
            <input
              type="date"
              required
              value={input.startDate}
              onChange={(event) =>
                setInput({ ...input, startDate: event.target.value })
              }
            />
          </Field>
          <Field label={t('endDate')} error={fieldErrors.endDate}>
            <input
              type="date"
              min={input.startDate}
              value={input.endDate}
              onChange={(event) =>
                setInput({ ...input, endDate: event.target.value })
              }
            />
          </Field>
        </div>
        <Field label={t('reminderChoice')} error={fieldErrors.reminder}>
          <select
            value={input.reminder}
            onChange={(event) =>
              setInput({ ...input, reminder: Number(event.target.value) })
            }
          >
            {[...new Set([0, 10, 30, 60, input.reminder])].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes === 0
                  ? t('reminderAtTime')
                  : minutes === 10
                    ? t('tenBefore')
                    : minutes === 30
                      ? t('thirtyBefore')
                      : minutes === 60
                        ? copy.hourBefore
                        : `${minutes} ${t('minutes')}`}
              </option>
            ))}
          </select>
        </Field>
        <details className="form-details">
          <summary>{t('refillSettings')}</summary>
          {backend.data === false && <Banner>{t('featureSetup')}</Banner>}
          {backend.isError && (
            <Banner alert>
              {t('error')}
              <Button onClick={() => void backend.refetch()}>
                {t('retry')}
              </Button>
            </Banner>
          )}
          <fieldset disabled={backend.data !== true}>
            <Field label={t('refillDate')} error={fieldErrors.refillOn}>
              <input
                type="date"
                value={input.refillOn || ''}
                onChange={(e) =>
                  setInput({ ...input, refillOn: e.target.value })
                }
              />
            </Field>
            <Field label={t('refillDays')} error={fieldErrors.refillDays}>
              <input
                type="number"
                min={0}
                max={30}
                value={input.refillDays ?? 3}
                onChange={(e) =>
                  setInput({
                    ...input,
                    refillDays:
                      e.target.value === '' ? NaN : Number(e.target.value),
                  })
                }
              />
            </Field>
            <p>{t('refillHelp')}</p>
            <Field label={t('followup')}>
              <select
                value={input.followup || 0}
                onChange={(e) =>
                  setInput({
                    ...input,
                    followup: Number(e.target.value) as 0 | 15 | 30 | 60,
                  })
                }
              >
                {([0, 15, 30, 60] as const).map((value) => (
                  <option key={value} value={value}>
                    {t(
                      value === 0
                        ? 'followupOff'
                        : value === 15
                          ? 'fifteenAfter'
                          : value === 30
                            ? 'thirtyAfter'
                            : 'sixtyAfter',
                    )}
                  </option>
                ))}
              </select>
            </Field>
            <p>{t('followupHelp')}</p>
          </fieldset>
        </details>
        <Card className="schedule-preview">
          <h3>{t('schedulePreview')}</h3>
          <p>
            {input.title || t('name')} · {input.dose || t('dose')}
          </p>
          <p>
            {input.days.length === 7
              ? t('everyday')
              : weekDays
                  .filter((day) => input.days.includes(day))
                  .map((day) => t(dayLabels[weekDays.indexOf(day)]))
                  .join(', ')}{' '}
            · {input.times.filter(Boolean).join(' · ')}
          </p>
          <p>
            {input.startDate}
            {input.endDate ? ` → ${input.endDate}` : ''}
          </p>
        </Card>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={input.active}
            onChange={(event) =>
              setInput({ ...input, active: event.target.checked })
            }
          />
          {t('active')}
        </label>
        {error && <Banner alert>{t(error)}</Banner>}
        <div className="actions">
          <Button type="submit" disabled={pending || !online || photoError}>
            {t(pending ? 'saving' : 'saveMedication')}
          </Button>
          <Button variant="secondary" disabled={pending} onClick={finish}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
export function AddMedication() {
  const { t } = useI18n();
  return (
    <div className="form-page">
      <header className="page-heading">
        <h1>{t('newMedication')}</h1>
      </header>
      <MedicationForm />
    </div>
  );
}
