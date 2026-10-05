import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const db = new PGlite();
const userA = '00000000-0000-4000-8000-000000000001';
const userB = '00000000-0000-4000-8000-000000000002';
const group = '00000000-0000-4000-8000-000000000003';
const rows = [
  {
    title: 'A',
    dose: '1 comprimido',
    timezone: 'Europe/Lisbon',
    starts_at: '2026-01-01T08:00:00Z',
    ends_at: null,
    rrule: 'FREQ=DAILY',
    reminder: 0,
    active: true,
  },
  {
    title: 'A',
    dose: '1 comprimido',
    timezone: 'Europe/Lisbon',
    starts_at: '2026-01-01T20:00:00Z',
    ends_at: null,
    rrule: 'FREQ=DAILY',
    reminder: 0,
    active: true,
  },
];
async function asUser(id: string) {
  await db.exec('reset role; set role authenticated;');
  await db.query(
    "select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', 'authenticated', false)",
    [id],
  );
}
beforeAll(async () => {
  // Supabase roles and Auth helpers are stubbed; all actual application SQL runs unchanged.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
    grant usage on schema storage to authenticated;
    grant select, insert, delete on storage.objects to authenticated;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as
      $$ select current_setting('request.jwt.claim.role', true) $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
  `);
  for (const file of [
    '0001_init.sql',
    '0002_harden_ownership.sql',
    '0003_medication_groups.sql',
    '0004_photos_and_reminder_state.sql',
    '0005_calendar_worker_lock.sql',
    '0007_daily_care.sql',
    '0008_tasks.sql',
    '0009_recurrence.sql',
    '0010_task_completion_history.sql',
  ]) {
    await db.exec(
      await readFile(
        new URL(`../../supabase/migrations/${file}`, import.meta.url),
        'utf8',
      ),
    );
  }
  await db.exec(
    "insert into public.allowed_emails(email) values ('a@example.com'), ('b@example.com');",
  );
  await db.query('insert into auth.users(id,email) values ($1,$2), ($3,$4)', [
    userA,
    'a@example.com',
    userB,
    'b@example.com',
  ]);
}, 30_000);
afterAll(async () => {
  await db.close();
});

describe.sequential(
  'real application migrations with Supabase auth stubs',
  () => {
    it('rejects unapproved signup and seeds settings for approved users', async () => {
      await expect(
        db.query(
          "insert into auth.users(id,email) values (gen_random_uuid(), 'blocked@example.com')",
        ),
      ).rejects.toThrow(/closed/);
      expect(
        (await db.query('select * from public.user_settings')).rows,
      ).toHaveLength(2);
    });
    it('saves two medication rows atomically and queues both for future sync', async () => {
      await asUser(userA);
      await db.query('select public.save_medication_group($1,$2::jsonb)', [
        group,
        JSON.stringify(rows),
      ]);
      expect((await db.query('select * from public.events')).rows).toHaveLength(
        2,
      );
      await db.exec('reset role');
      expect(
        (await db.query('select * from public.sync_outbox')).rows,
      ).toHaveLength(2);
    });
    it('rolls back every change if a later dose fails validation', async () => {
      await asUser(userA);
      const existing = (
        await db.query<{ id: string }>(
          'select id from public.events order by starts_at',
        )
      ).rows;
      await expect(
        db.query('select public.save_medication_group($1,$2::jsonb)', [
          group,
          JSON.stringify([
            { ...rows[0], id: existing[0].id, title: 'Changed' },
            { ...rows[1], dose: '' },
          ]),
        ]),
      ).rejects.toThrow(/Invalid medication values/);
      expect(
        (
          await db.query<{ title: string }>('select title from public.events')
        ).rows.every((row) => row.title === 'A'),
      ).toBe(true);
    });
    it('rejects null and empty payloads without deleting the group', async () => {
      await asUser(userA);
      for (const payload of [null, '[]']) {
        await expect(
          db.query('select public.save_medication_group($1,$2::jsonb)', [
            group,
            payload,
          ]),
        ).rejects.toThrow(/Invalid medication group/);
        expect(
          (await db.query('select * from public.events')).rows,
        ).toHaveLength(2);
      }
    });
    it('isolates users and rejects cross-user completion references', async () => {
      await db.exec('reset role');
      const eventId = (
        await db.query<{ id: string }>('select id from public.events limit 1')
      ).rows[0].id;
      await asUser(userB);
      expect((await db.query('select * from public.events')).rows).toEqual([]);
      await expect(
        db.query(
          'insert into public.event_completions(user_id,event_id,occurrence_at) values ($1,$2,$3)',
          [userB, eventId, '2026-01-01T08:00:00Z'],
        ),
      ).rejects.toThrow(/completions_event_owner/);
      await expect(
        db.query('select public.save_medication_group($1,$2::jsonb)', [
          group,
          JSON.stringify([{ ...rows[0], id: eventId }]),
        ]),
      ).rejects.toThrow(/not found/);
      await db.query('select public.delete_medication_group($1)', [group]);
      await asUser(userA);
      expect((await db.query('select * from public.events')).rows).toHaveLength(
        2,
      );
    });
    it('supports Taken, Skip and undo without duplicate completions', async () => {
      await asUser(userA);
      const eventId = (
        await db.query<{ id: string }>(
          'select id from public.events order by starts_at',
        )
      ).rows[0].id;
      await db.query(
        'insert into public.event_completions(user_id,event_id,occurrence_at) values ($1,$2,$3)',
        [userA, eventId, '2026-01-01T08:00:00Z'],
      );
      await db.query(
        "insert into public.event_completions(user_id,event_id,occurrence_at,status) values ($1,$2,$3,'skipped') on conflict (event_id,occurrence_at) do update set status = excluded.status",
        [userA, eventId, '2026-01-01T08:00:00Z'],
      );
      expect(
        (
          await db.query<{ status: string }>(
            'select status from public.event_completions',
          )
        ).rows,
      ).toEqual([{ status: 'skipped' }]);
      await db.exec('delete from public.event_completions');
      expect(
        (await db.query('select * from public.event_completions')).rows,
      ).toHaveLength(0);
    });
    it('protects Google metadata and service-only tables', async () => {
      await asUser(userA);
      await expect(
        db.exec("update public.events set google_event_id = 'forged'"),
      ).rejects.toThrow(/service-only/);
      await expect(
        db.exec('select * from public.google_tokens'),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.exec('select * from public.allowed_emails'),
      ).rejects.toThrow(/permission denied/);
      await db.exec('reset role; set role anon;');
      await expect(db.exec('select * from public.events')).rejects.toThrow(
        /permission denied/,
      );
    });
    it('keeps unchanged event IDs on edit, then deletes the whole group', async () => {
      await asUser(userA);
      const existing = (
        await db.query<{ id: string }>(
          'select id from public.events order by starts_at',
        )
      ).rows;
      await db.query('select public.save_medication_group($1,$2::jsonb)', [
        group,
        JSON.stringify(
          rows.map((row, index) => ({
            ...row,
            id: existing[index].id,
            title: 'Edited',
          })),
        ),
      ]);
      expect(
        (
          await db.query<{ id: string }>(
            'select id from public.events order by starts_at',
          )
        ).rows,
      ).toEqual(existing);
      await db.query('select public.delete_medication_group($1)', [group]);
      expect((await db.query('select * from public.events')).rows).toHaveLength(
        0,
      );
    });
    it('keeps packaging photos private to their owner', async () => {
      await asUser(userA);
      await db.query(
        "insert into storage.objects(bucket_id,name) values ('medication-photos',$1)",
        [userA + '/photo.jpg'],
      );
      await expect(
        db.query(
          "insert into storage.objects(bucket_id,name) values ('medication-photos',$1)",
          [userB + '/photo.jpg'],
        ),
      ).rejects.toThrow(/row-level security/);
      await asUser(userB);
      expect(
        (await db.query('select * from storage.objects')).rows,
      ).toHaveLength(0);
      await expect(
        db.query('select public.save_medication_with_photo($1,$2::jsonb,$3)', [
          group,
          JSON.stringify(rows),
          userA + '/photo.jpg',
        ]),
      ).rejects.toThrow(/Photo does not belong/);
      expect((await db.query('select * from public.events')).rows).toHaveLength(
        0,
      );
    });
    it('books paid bills atomically, updates without duplicating, and undoes the expense', async () => {
      await asUser(userA);
      const bill = (
        await db.query<{ id: string }>(
          "insert into public.events(user_id,type,title,starts_at,amount,reminder_minutes) values ($1,'bill','Test bill','2026-01-05T09:00:00Z',12.34,array[4320,0]) returning id",
          [userA],
        )
      ).rows[0].id;
      await db.query(
        "select public.mark_bill_paid($1,'2026-01-05T09:00:00Z',12.34,'2026-01-05')",
        [bill],
      );
      await db.query(
        "select public.mark_bill_paid($1,'2026-01-05T09:00:00Z',15.00,'2026-01-06')",
        [bill],
      );
      const expenses = (
        await db.query<{ amount: string }>('select amount from public.expenses')
      ).rows;
      expect(expenses).toHaveLength(1);
      expect(Number(expenses[0].amount)).toBe(15);
      await expect(
        db.query(
          "select public.mark_bill_paid($1,'2026-01-05T09:00:00Z',-1,'2026-01-06')",
          [bill],
        ),
      ).rejects.toThrow();
      await asUser(userB);
      await expect(
        db.query("select public.mark_bill_paid($1,'2026-01-05T09:00:00Z')", [
          bill,
        ]),
      ).rejects.toThrow();
      await asUser(userA);
      await db.query('delete from public.event_completions where event_id=$1', [
        bill,
      ]);
      expect(
        (await db.query('select * from public.expenses')).rows,
      ).toHaveLength(0);
    });
  },
);

describe.sequential('daily care and selective family sharing', () => {
  it('saves optional medication reminders atomically and rejects invalid values', async () => {
    await asUser(userA);
    await db.query(
      'select public.save_medication_with_photo($1,$2::jsonb,null)',
      [
        group,
        JSON.stringify(
          rows.map((r) => ({
            ...r,
            refill_on: '2026-11-01',
            refill_reminder_days: 3,
            followup_minutes: 30,
          })),
        ),
      ],
    );
    const meds = (
      await db.query<{
        id: string;
        followup_minutes: number;
        refill_on: string;
      }>(
        "select id,followup_minutes,refill_on from public.events where type='medication'",
      )
    ).rows;
    expect(meds).toHaveLength(2);
    expect(meds.every((e) => e.followup_minutes === 30)).toBe(true);
    const existing = (
      await db.query<{ id: string }>(
        "select id from public.events where type='medication' order by starts_at",
      )
    ).rows;
    await expect(
      db.query('select public.save_medication_with_photo($1,$2::jsonb,null)', [
        group,
        JSON.stringify(
          rows.map((r, i) => ({
            ...r,
            id: existing[i].id,
            followup_minutes: 999,
            title: 'Invalid',
          })),
        ),
      ]),
    ).rejects.toThrow();
    expect(
      (
        await db.query<{ title: string }>(
          "select title from public.events where type='medication'",
        )
      ).rows.every((r) => r.title === 'A'),
    ).toBe(true);
  });
  it('stopping medication retains history and snoozes cannot reference another owner', async () => {
    await asUser(userA);
    const event = (
      await db.query<{ id: string }>(
        "select id from public.events where type='medication' order by starts_at limit 1",
      )
    ).rows[0];
    await db.query(
      "insert into public.event_completions(user_id,event_id,occurrence_at) values($1,$2,'2026-01-01T08:00:00Z')",
      [userA, event.id],
    );
    await db.query(
      "insert into public.dose_snoozes(user_id,event_id,occurrence_at,remind_at) values($1,$2,'2026-01-01T08:00:00Z','2026-01-01T08:10:00Z')",
      [userA, event.id],
    );
    await asUser(userB);
    expect(
      (await db.query('select * from public.dose_snoozes')).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.dose_snoozes(user_id,event_id,occurrence_at,remind_at) values($1,$2,'2026-01-02T08:00:00Z','2026-01-02T08:10:00Z')",
        [userB, event.id],
      ),
    ).rejects.toThrow();
    await asUser(userA);
    await db.query('update public.events set active=false where group_id=$1', [
      group,
    ]);
    expect(
      (
        await db.query(
          'select * from public.event_completions where event_id=$1',
          [event.id],
        )
      ).rows,
    ).toHaveLength(1);
    await db.query('update public.events set active=true where group_id=$1', [
      group,
    ]);
  });
  it('single appointment edits exclude only that occurrence and roll back on failure', async () => {
    await asUser(userA);
    const appt = (
      await db.query<{ id: string }>(
        "insert into public.events(user_id,type,title,starts_at,ends_at,rrule,notes) values($1,'appointment','Series','2026-01-01T09:00:00Z','2026-01-01T09:30:00Z','FREQ=WEEKLY','Private note') returning id",
        [userA],
      )
    ).rows[0];
    const payload = {
      title: 'Rescheduled',
      starts_at: '2026-01-09T10:00:00Z',
      ends_at: '2026-01-09T10:30:00Z',
      location: 'Clinic',
      notes: 'Bring documents',
      category_id: null,
      reminder_minutes: [60],
    };
    await asUser(userB);
    await expect(
      db.query(
        "select public.save_appointment_occurrence($1,'2026-01-08T09:00:00Z',$2::jsonb)",
        [appt.id, JSON.stringify(payload)],
      ),
    ).rejects.toThrow(/not found/);
    await asUser(userA);
    await expect(
      db.query(
        "select public.save_appointment_occurrence($1,'2026-01-08T09:00:00Z',$2::jsonb)",
        [
          appt.id,
          JSON.stringify({ ...payload, ends_at: '2026-01-01T09:00:00Z' }),
        ],
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.query<{ excluded_dates: string[] }>(
          'select excluded_dates from public.events where id=$1',
          [appt.id],
        )
      ).rows[0].excluded_dates,
    ).toHaveLength(0);
    await db.query(
      "select public.save_appointment_occurrence($1,'2026-01-08T09:00:00Z',$2::jsonb)",
      [appt.id, JSON.stringify(payload)],
    );
    expect(
      (
        await db.query<{ excluded_dates: string[] }>(
          'select excluded_dates from public.events where id=$1',
          [appt.id],
        )
      ).rows[0].excluded_dates,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "select * from public.events where title='Rescheduled' and rrule is null",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it('family readers see only selected fields and cannot write or read owner tables', async () => {
    await asUser(userA);
    await expect(
      db.query(
        "select public.share_with_family('unapproved@example.com',true,false,false)",
      ),
    ).rejects.toThrow(/unavailable/);
    await expect(
      db.query(
        "select public.share_with_family('b@example.com',false,false,false)",
      ),
    ).rejects.toThrow();
    await db.query(
      "select public.share_with_family('b@example.com',true,false,false)",
    );
    await asUser(userB);
    const shared = (
      await db.query<{
        data: {
          events: Record<string, unknown>[];
          completions: Record<string, unknown>[];
        }[];
      }>('select public.read_family_view() as data')
    ).rows[0].data;
    expect(shared).toHaveLength(1);
    expect(shared[0].events).toHaveLength(2);
    for (const e of shared[0].events) {
      expect(e.type).toBe('medication');
      for (const key of [
        'notes',
        'location',
        'photo_path',
        'google_event_id',
        'user_id',
      ])
        expect(e).not.toHaveProperty(key);
    }
    expect((await db.query('select * from public.events')).rows).toHaveLength(
      0,
    );
    expect(
      (await db.query('select * from public.family_shares')).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("update public.events set title='Forged' returning id"))
        .rows,
    ).toHaveLength(0);
    await asUser(userA);
    await db.exec('delete from public.family_shares');
    await asUser(userB);
    expect(
      (
        await db.query<{ data: unknown[] }>(
          'select public.read_family_view() as data',
        )
      ).rows[0].data,
    ).toEqual([]);
  });
});

describe.sequential('general tasks', () => {
  const taskId = '00000000-0000-4000-8000-000000000080';
  it('supports unscheduled tasks, date-only tasks, completion and undo', async () => {
    await asUser(userA);
    await db.query(
      'insert into public.tasks(id,user_id,title) values ($1,$2,$3)',
      [taskId, userA, 'Call the plumber'],
    );
    const unscheduled = (
      await db.query<{
        due_on: string | null;
        due_time: string | null;
        completed_at: string | null;
      }>('select * from public.tasks where id=$1', [taskId])
    ).rows[0];
    expect(unscheduled.due_on).toBeNull();
    expect(unscheduled.due_time).toBeNull();
    expect(unscheduled.completed_at).toBeNull();
    await db.query(
      "update public.tasks set due_on='2026-10-02', completed_at=now() where id=$1",
      [taskId],
    );
    expect(
      (
        await db.query<{ completed_at: string | null }>(
          'select completed_at from public.tasks where id=$1',
          [taskId],
        )
      ).rows[0].completed_at,
    ).not.toBeNull();
    await db.query('update public.tasks set completed_at=null where id=$1', [
      taskId,
    ]);
    expect(
      (
        await db.query<{ completed_at: string | null }>(
          'select completed_at from public.tasks where id=$1',
          [taskId],
        )
      ).rows[0].completed_at,
    ).toBeNull();
  });
  it('rejects invalid titles and times without dates', async () => {
    await asUser(userA);
    await expect(
      db.query("insert into public.tasks(user_id,title) values ($1,'  ')", [
        userA,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.tasks(user_id,title,due_time) values ($1,'Call','09:00')",
        [userA],
      ),
    ).rejects.toThrow();
  });
  it('isolates tasks and prevents cross-user writes and reassignment', async () => {
    await asUser(userB);
    expect(
      (await db.query('select * from public.tasks where id=$1', [taskId])).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "update public.tasks set title='Forged' where id=$1 returning id",
          [taskId],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query('delete from public.tasks where id=$1 returning id', [
          taskId,
        ])
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query("insert into public.tasks(user_id,title) values ($1,'Forged')", [
        userA,
      ]),
    ).rejects.toThrow();
    await asUser(userA);
    await expect(
      db.query('update public.tasks set user_id=$1 where id=$2', [
        userB,
        taskId,
      ]),
    ).rejects.toThrow();
    await db.query('delete from public.tasks where id=$1', [taskId]);
  });
});

describe.sequential('recurring tasks and financial series', () => {
  const taskId = '00000000-0000-4000-8000-000000000090';
  const eventId = '00000000-0000-4000-8000-000000000091';
  it('preserves completion history when a standalone task becomes recurring', async () => {
    await asUser(userA);
    const {
      rows: [task],
    } = await db.query<{ id: string }>(
      "insert into public.tasks(user_id,title,due_on,completed_at) values($1,'Converted task','2026-01-01','2026-01-01T12:00:00Z') returning id",
      [userA],
    );
    await db.query(
      "update public.tasks set rrule='FREQ=DAILY',due_on='2026-01-02' where id=$1",
      [task.id],
    );
    expect(
      (
        await db.query('select completed_at from public.tasks where id=$1', [
          task.id,
        ])
      ).rows[0],
    ).toEqual({ completed_at: null });
    expect(
      (
        await db.query(
          'select occurrence_on::text from public.task_completions where task_id=$1',
          [task.id],
        )
      ).rows,
    ).toEqual([{ occurrence_on: '2026-01-01' }]);
  });
  it('completes task occurrences independently and enforces ownership', async () => {
    await asUser(userA);
    await db.query(
      "insert into public.tasks(id,user_id,title,due_on,rrule) values($1,$2,'Chore','2026-01-01','FREQ=DAILY;COUNT=5')",
      [taskId, userA],
    );
    await db.query(
      "insert into public.task_completions(user_id,task_id,occurrence_on) values($1,$2,'2026-01-01')",
      [userA, taskId],
    );
    await asUser(userB);
    expect(
      (
        await db.query(
          'select * from public.task_completions where task_id=$1',
          [taskId],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.task_completions(user_id,task_id,occurrence_on) values($1,$2,'2026-01-02')",
        [userB, taskId],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "select public.edit_task_occurrence($1,'2026-01-02','single',null)",
        [taskId],
      ),
    ).rejects.toThrow();
    await asUser(userA);
    expect(
      (
        await db.query(
          'select * from public.task_completions where task_id=$1',
          [taskId],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it('moves one task occurrence and splits future occurrences without deleting history', async () => {
    await asUser(userA);
    await db.query(
      "select public.edit_task_occurrence($1,'2026-01-02','single',$2::jsonb)",
      [
        taskId,
        JSON.stringify({
          title: 'Moved chore',
          notes: '',
          due_on: '2026-01-03',
          due_time: null,
        }),
      ],
    );
    expect(
      (
        await db.query<{ excluded_dates: string[] }>(
          'select excluded_dates from public.tasks where id=$1',
          [taskId],
        )
      ).rows[0].excluded_dates,
    ).toHaveLength(1);
    await db.query(
      "select public.edit_task_occurrence($1,'2026-01-03','future',$2::jsonb)",
      [
        taskId,
        JSON.stringify({
          title: 'New chore',
          notes: '',
          due_on: '2026-01-03',
          due_time: null,
          rrule: 'FREQ=WEEKLY;BYDAY=SA',
        }),
      ],
    );
    expect(
      (
        await db.query<{ rrule: string }>(
          'select rrule from public.tasks where id=$1',
          [taskId],
        )
      ).rows[0].rrule,
    ).toContain('UNTIL=20260102T235959Z');
    expect(
      (
        await db.query(
          'select * from public.task_completions where task_id=$1',
          [taskId],
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      db.query(
        "select public.edit_task_occurrence($1,'2026-01-01','future',null)",
        [taskId],
      ),
    ).rejects.toThrow();
  });
  it('rolls back exclusions if a moved occurrence fails validation', async () => {
    await asUser(userA);
    const before = (
      await db.query('select excluded_dates from public.tasks where id=$1', [
        taskId,
      ])
    ).rows[0];
    await expect(
      db.query(
        "select public.edit_task_occurrence($1,'2026-01-02','single',$2::jsonb)",
        [taskId, JSON.stringify({ title: '', due_on: '2026-01-03' })],
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.query('select excluded_dates from public.tasks where id=$1', [
          taskId,
        ])
      ).rows[0],
    ).toEqual(before);
  });
  it('keeps paid bills and their expenses when splitting future bills', async () => {
    await asUser(userA);
    await db.query(
      "insert into public.events(id,user_id,type,title,starts_at,all_day,amount,rrule) values($1,$2,'bill','Subscription','2026-01-01T09:00:00Z',true,10,'FREQ=MONTHLY')",
      [eventId, userA],
    );
    await db.query(
      "select public.mark_bill_paid($1,'2026-01-01T09:00:00Z',10,'2026-01-01')",
      [eventId],
    );
    await expect(
      db.query(
        "select public.edit_event_occurrence($1,'2026-01-01T09:00:00Z','single',null)",
        [eventId],
      ),
    ).rejects.toThrow();
    await db.query(
      "select public.edit_event_occurrence($1,'2026-02-01T09:00:00Z','future',$2::jsonb)",
      [
        eventId,
        JSON.stringify({
          title: 'Changed subscription',
          starts_at: '2026-02-01T09:00:00Z',
          ends_at: null,
          amount: 12,
          reminder_minutes: [0],
          rrule: 'FREQ=MONTHLY;BYMONTHDAY=1',
        }),
      ],
    );
    expect(
      (
        await db.query('select * from public.expenses where event_id=$1', [
          eventId,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query<{ rrule: string }>(
          'select rrule from public.events where id=$1',
          [eventId],
        )
      ).rows[0].rrule,
    ).toContain('UNTIL=20260201T085959Z');
    await asUser(userB);
    await expect(
      db.query(
        "select public.edit_event_occurrence($1,'2026-02-01T09:00:00Z','single',null)",
        [eventId],
      ),
    ).rejects.toThrow();
  });
  it('records only the confirmed expense and schedules future payment confirmation atomically', async () => {
    await asUser(userA);
    const input = {
      title: 'Recurring groceries',
      spent_on: '2026-01-02',
      starts_at: '2026-01-31T09:00:00Z',
      amount: 20,
      category_id: null,
      note: 'Groceries',
      rrule: 'FREQ=MONTHLY;BYMONTHDAY=-1',
    };
    const before = (await db.query('select * from public.expenses')).rows
      .length;
    const created = (
      await db.query<{ id: string }>(
        'select public.create_recurring_expense($1::jsonb) as id',
        [JSON.stringify(input)],
      )
    ).rows[0].id;
    expect((await db.query('select * from public.expenses')).rows.length).toBe(
      before + 1,
    );
    expect(
      (
        await db.query(
          'select * from public.event_completions where event_id=$1',
          [created],
        )
      ).rows,
    ).toHaveLength(0);
    const eventsBefore = (await db.query('select id from public.events')).rows
      .length;
    await expect(
      db.query('select public.create_recurring_expense($1::jsonb)', [
        JSON.stringify({ ...input, amount: -1 }),
      ]),
    ).rejects.toThrow();
    expect((await db.query('select id from public.events')).rows.length).toBe(
      eventsBefore,
    );
  });
});
