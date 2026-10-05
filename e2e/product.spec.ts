import { test, expect } from '@playwright/test';
import { testAuthStorageKey, testSupabaseUrl } from './config';
const userId = '00000000-0000-4000-8000-000000000001';

test('shared dropdowns preserve language, empty choices, filters and numeric medication settings', async ({
  page,
}) => {
  const category = {
    id: '00000000-0000-4000-8000-000000000098',
    user_id: userId,
    kind: 'expense',
    name: 'Supermercado',
  };
  await page.route('**/rest/v1/categories?**', (route) =>
    route.fulfill({ json: [category] }),
  );
  await page.goto('/settings');
  // Finish initial Vite dependency loading before opening an animated menu.
  await page.waitForLoadState('networkidle');
  await expect(page.locator('select')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Idioma', exact: true }).click();
  await page.getByRole('option', { name: 'English', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Language', exact: true }),
  ).toContainText('English');
  await page.getByRole('combobox', { name: 'Language', exact: true }).click();
  await page.getByRole('option', { name: 'Português', exact: true }).click();
  await page.goto('/add/expense');
  await expect(
    page.getByRole('combobox', { name: 'Categoria', exact: true }),
  ).toContainText('Sem categoria');
  await page.getByRole('combobox', { name: 'Categoria', exact: true }).click();
  await page.getByRole('option', { name: 'Supermercado', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Categoria', exact: true }),
  ).toContainText('Supermercado');
  await page.goto('/money');
  await page.getByRole('button', { name: 'Mais filtros', exact: true }).click();
  await page.getByRole('combobox', { name: 'Categoria', exact: true }).click();
  await page.getByRole('option', { name: 'Supermercado', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Categoria', exact: true }),
  ).toContainText('Supermercado');
  await page
    .getByRole('button', { name: 'Limpar filtros', exact: true })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Categoria', exact: true }),
  ).toContainText('Todas as categorias');
  let saved:
    { p_rows: { reminder: number; followup_minutes: number }[] } | undefined;
  await page.route('**/rest/v1/rpc/save_medication_with_photo', (route) => {
    saved = route.request().postDataJSON();
    return route.fulfill({ json: '00000000-0000-4000-8000-000000000099' });
  });
  await page.goto('/add/medication');
  await page
    .getByRole('textbox', { name: 'Nome do medicamento', exact: true })
    .fill('Teste');
  await page
    .getByRole('textbox', { name: 'Dose', exact: true })
    .fill('1 comprimido');
  await page
    .getByRole('combobox', { name: 'Quando lembrar', exact: true })
    .click();
  await page
    .getByRole('option', { name: '30 minutos antes', exact: true })
    .click();
  await page
    .locator('summary')
    .filter({ hasText: 'Embalagem e lembretes adicionais' })
    .click();
  await page
    .getByRole('combobox', {
      name: 'Se a toma não estiver registada',
      exact: true,
    })
    .click();
  await page
    .getByRole('option', { name: '1 hora depois', exact: true })
    .click();
  await expect(page.locator('select')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Guardar medicamento', exact: true })
    .click();
  await expect(page).toHaveURL(/\/medications$/);
  expect(saved?.p_rows[0].reminder).toBe(30);
  expect(saved?.p_rows[0].followup_minutes).toBe(60);
});

test('Money browses months and years with read-only history and monthly drill-down', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-02T12:00:00Z') });
  const rows = [
    {
      id: '00000000-0000-4000-8000-000000000091',
      user_id: userId,
      amount: 10.1,
      spent_on: '2026-01-31',
      note: 'January expense',
      category_id: null,
      completion_id: null,
      event_id: null,
    },
    {
      id: '00000000-0000-4000-8000-000000000092',
      user_id: userId,
      amount: 20.2,
      spent_on: '2026-09-30',
      note: 'September expense',
      category_id: null,
      completion_id: null,
      event_id: null,
    },
    {
      id: '00000000-0000-4000-8000-000000000093',
      user_id: userId,
      amount: 30.3,
      spent_on: '2026-10-01',
      note: 'October expense',
      category_id: null,
      completion_id: null,
      event_id: null,
    },
    {
      id: '00000000-0000-4000-8000-000000000094',
      user_id: userId,
      amount: 99,
      spent_on: '2025-12-31',
      note: 'Last year expense',
      category_id: null,
      completion_id: null,
      event_id: null,
    },
  ];
  await page.route('**/rest/v1/expenses?**', (route) => {
    const params = new URL(route.request().url()).searchParams.getAll(
      'spent_on',
    );
    const from = params.find((value) => value.startsWith('gte.'))?.slice(4);
    const to = params.find((value) => value.startsWith('lt.'))?.slice(3);
    return route.fulfill({
      json: rows.filter(
        (row) => (!from || row.spent_on >= from) && (!to || row.spent_on < to),
      ),
    });
  });
  await page.goto('/money');
  await expect(
    page.getByRole('heading', { name: 'October expense', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Adicionar despesa', exact: true }),
  ).toBeVisible();
  await page.locator('.money-period-trigger').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('button', { name: 'outubro 2026', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.money-period-trigger')).toBeFocused();
  await page.locator('.money-period-trigger').click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'setembro 2026', exact: true })
    .click();
  await expect(page.locator('.money-period-trigger')).toContainText(
    'setembro 2026',
  );
  await expect(
    page.getByRole('heading', { name: 'September expense', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Adicionar despesa', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('main').getByRole('button', { name: 'Editar', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('main').getByRole('button', { name: 'Eliminar', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Este período é apenas para consulta.', { exact: false }),
  ).toBeVisible();
  await page.locator('.money-period-trigger').click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'outubro 2026', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'October expense', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Ano', exact: true }).click();
  await expect(page.locator('.money-period-trigger')).toContainText('2026');
  await expect(page.locator('.money-overview')).toContainText('60,60');
  await expect(
    page.getByRole('img', { name: 'Despesas por mês', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.money-month-grid button')).toHaveCount(12);
  await expect(
    page.locator('main').getByRole('button', { name: 'Editar', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Last year expense', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Mais filtros', exact: true }).click();
  await page
    .getByRole('searchbox', { name: 'Procurar pelo nome…', exact: true })
    .fill('September');
  await expect(page.locator('.statistics-section')).toContainText('20,20');
  await expect(page.locator('.money-overview')).toContainText('60,60');
  await expect(
    page.locator('.money-month-grid').getByRole('button', { name: /janeiro/ }),
  ).toContainText('0,00');
  await page
    .getByRole('button', { name: 'Limpar filtros', exact: true })
    .click();
  await page
    .locator('.money-month-grid')
    .getByRole('button', { name: /setembro/ })
    .click();
  await expect(page.locator('.money-period-trigger')).toContainText(
    'setembro 2026',
  );
  await expect(
    page.getByRole('heading', { name: 'September expense', exact: true }),
  ).toBeVisible();
  await page.locator('.money-period-trigger').click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Mês atual', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'Adicionar despesa', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Ano', exact: true }).click();
  await page.locator('.money-period-trigger').click();
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Ano', exact: true })
    .click();
  await page.getByRole('option', { name: '2025', exact: true }).click();
  await page
    .getByRole('button', { name: 'Ver ano completo', exact: true })
    .click();
  await expect(page.locator('.money-overview')).toContainText('99,00');
  await page.locator('.money-period-trigger').click();
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Ano', exact: true })
    .click();
  await page.getByRole('option', { name: '2026', exact: true }).click();
  await page
    .getByRole('button', { name: 'Ver ano completo', exact: true })
    .click();
  await expect(page.locator('.money-overview')).toContainText('60,60');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('manual expense dates stay within the current month', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-02T12:00:00Z') });
  await page.goto('/add/expense');
  const date = page.locator('input[type="date"]');
  await expect(date).toHaveAttribute('min', '2026-10-01');
  await expect(date).toHaveAttribute('max', '2026-10-31');
  await expect(date).toHaveValue('2026-10-02');
  await page
    .getByRole('textbox', { name: 'Valor (€)', exact: true })
    .fill('10');
  await date.fill('2026-09-30');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  expect(
    await date.evaluate(
      (input: HTMLInputElement) => input.validity.rangeUnderflow,
    ),
  ).toBe(true);
  await expect(page).toHaveURL(/\/add\/expense/);
});

test('desktop sidebar fits without scrolling and uses the menu on short screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/settings');
  await expect(page.locator('.sidebar .brand p')).toHaveCount(0);
  await expect(page.locator('.sidebar .account-menu-trigger')).toBeInViewport();
  expect(
    await page
      .locator('.sidebar')
      .evaluate((sidebar) => sidebar.scrollHeight <= sidebar.clientHeight),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 640 });
  await expect(page.locator('.sidebar')).not.toBeVisible();
  await page.getByRole('button', { name: 'Mais', exact: true }).click();
  await page
    .locator('.mobile-drawer')
    .getByRole('button', { name: 'A sua conta', exact: true })
    .click();
  await expect(
    page.getByRole('menuitem', { name: 'Sair', exact: true }),
  ).toBeVisible();
});

test('local notification service worker becomes active', async ({ page }) => {
  await page.goto('/settings');
  await expect
    .poll(
      async () =>
        page.evaluate(async () =>
          Boolean((await navigator.serviceWorker.getRegistration())?.active),
        ),
      { timeout: 10000 },
    )
    .toBe(true);
});

test('financial dashboard renders real totals and readable chart data', async ({
  page,
}) => {
  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
  const rows = [
    {
      id: '00000000-0000-4000-8000-000000000030',
      user_id: userId,
      amount: 12.34,
      spent_on: `${month}-01`,
      category_id: null,
      note: 'Test expense',
      completion_id: null,
      event_id: null,
    },
  ];
  await page.route('**/rest/v1/expenses?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rows),
    }),
  );
  await page.goto('/money');
  await page
    .getByText('Ver gráficos e análise das despesas', { exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'O dinheiro, em perspetiva' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Despesas nos últimos 6 meses' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Evolução do gasto no mês' }),
  ).toBeVisible();
  await page
    .getByText('Ver valores do gráfico', { exact: true })
    .first()
    .click();
  await expect(page.locator('.chart-data table').first()).toContainText(
    '12,34',
  );
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll('body *'))
      .filter(
        (element) => element.getBoundingClientRect().right > innerWidth + 1,
      )
      .map((element) => ({
        tag: element.tagName,
        class: element.className,
        width: element.getBoundingClientRect().width,
        parent: element.parentElement?.className,
        overflow: getComputedStyle(element).overflowX,
      }))
      .slice(0, 15),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    JSON.stringify(overflow),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/dashboard-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('edit dialog contains scrolling and cannot close during a save', async ({
  page,
}) => {
  const row = {
    id: '00000000-0000-4000-8000-000000000010',
    user_id: userId,
    group_id: '00000000-0000-4000-8000-000000000020',
    type: 'medication',
    title: 'Teste',
    dose: '1 comprimido',
    starts_at: '2026-01-01T08:00:00Z',
    ends_at: null,
    rrule: 'FREQ=DAILY',
    timezone: 'Europe/Lisbon',
    active: true,
    all_day: false,
    photo_path: null,
    reminder_minutes: [0],
    google_sync_error: null,
    location: null,
    notes: null,
    amount: null,
  };
  await page.route('**/rest/v1/events?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([row]),
    }),
  );
  await page.route(
    '**/rest/v1/rpc/save_medication_with_photo',
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Test failure' }),
      });
    },
  );
  await page.goto('/medications');
  const edit = page.getByRole('button', { name: 'Editar', exact: true });
  await edit.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    'hidden',
  );
  const bounds = await dialog.boundingBox();
  expect(bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await dialog.getByRole('button', { name: 'Guardar medicamento' }).click();
  await expect(
    dialog.getByRole('button', { name: 'Fechar', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Fechar', exact: true }),
  ).toBeEnabled();
  await expect(dialog.getByLabel('Nome do medicamento')).toHaveValue('Teste');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(edit).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    'hidden',
  );
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ userId, testAuthStorageKey }) => {
      const session = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_in: 86400,
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        user: {
          id: userId,
          aud: 'authenticated',
          role: 'authenticated',
          email: 'test@example.com',
          app_metadata: { provider: 'google' },
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      };
      localStorage.setItem(testAuthStorageKey, JSON.stringify(session));
    },
    { userId, testAuthStorageKey },
  );
  await page.route(`${testSupabaseUrl}/**`, async (route) => {
    const url = new URL(route.request().url());
    const data = url.pathname.includes('/auth/')
      ? { id: userId, email: 'test@example.com' }
      : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
});
test('daily overview and quick add are usable without horizontal overflow', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Hoje', exact: true }),
  ).toBeVisible();
  const mobile = page.viewportSize()!.width <= 760;
  if (mobile)
    await page.getByRole('button', { name: 'Mais', exact: true }).click();
  await page
    .locator(mobile ? '.mobile-drawer' : '.sidebar')
    .getByRole('link', { name: 'Adicionar', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Adicionar', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Adicionar medicamento/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/add-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test('medication form adds distinct dose times and keeps input on errors', async ({
  page,
}) => {
  await page.goto('/add/medication');
  await page
    .getByRole('textbox', { name: 'Nome do medicamento', exact: true })
    .fill('Teste');
  await page
    .getByRole('textbox', { name: 'Dose', exact: true })
    .fill('1 comprimido');
  await page.getByRole('button', { name: 'Adicionar hora' }).click();
  const times = await page
    .locator('input[type=time]')
    .evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    );
  expect(new Set(times).size).toBe(times.length);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/medication-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test('calendar, money and event forms are real screens', async ({ page }) => {
  for (const [path, heading] of [
    ['/calendar', 'Calendário'],
    ['/money', 'Dinheiro'],
    ['/add/appointment', 'Adicionar compromisso'],
    ['/add/bill', 'Adicionar conta'],
    ['/add/expense', 'Adicionar despesa'],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test('appointment reminder choices are included in the saved event', async ({
  page,
}) => {
  let saved: { reminder_minutes: number[] } | undefined;
  await page.route('**/rest/v1/events', async (route) => {
    if (route.request().method() === 'POST')
      saved = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: '[]',
    });
  });
  await page.goto('/add/appointment');
  await page
    .getByRole('textbox', { name: 'Nome do compromisso', exact: true })
    .fill('Consulta de teste');
  await page
    .getByRole('checkbox', { name: '1 dia antes', exact: true })
    .uncheck();
  await page
    .getByRole('checkbox', { name: 'À hora marcada', exact: true })
    .check();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Compromissos', exact: true }),
  ).toBeVisible();
  expect(saved?.reminder_minutes.slice().sort((a, b) => a - b)).toEqual([
    0, 60,
  ]);
});

test('Today shows an overdue unpaid bill and hides a paid bill', async ({
  page,
}) => {
  const occurrence = new Date(Date.now() - 86400000).toISOString();
  const bills = ['Conta por pagar', 'Conta já paga'].map((title, index) => ({
    id: `00000000-0000-4000-8000-00000000004${index}`,
    user_id: userId,
    title,
    type: 'bill',
    amount: 42.5,
    starts_at: occurrence,
    timezone: 'Europe/Lisbon',
    active: true,
    all_day: true,
    rrule: null,
    ends_at: null,
    reminder_minutes: [4320, 0],
    dose: null,
    location: null,
    notes: null,
    photo_path: null,
  }));
  await page.route('**/rest/v1/events?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        new URL(route.request().url()).searchParams.get('type') ===
          'eq.medication'
          ? []
          : bills,
      ),
    }),
  );
  await page.route('**/rest/v1/event_completions?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: '00000000-0000-4000-8000-000000000050',
          user_id: userId,
          event_id: bills[1].id,
          occurrence_at: occurrence,
          status: 'done',
          completed_at: occurrence,
          amount_paid: 42.5,
        },
      ]),
    }),
  );
  await page.goto('/');
  await expect(
    page
      .locator('.bill-attention')
      .getByRole('heading', { name: 'Conta por pagar', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Em atraso', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Conta já paga', exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: `test-results/today-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Ver e pagar', exact: true }).click();
  await expect(page).toHaveURL(/\/items\//);
  await expect(
    page.getByRole('heading', {
      name: 'Conta por pagar',
      level: 1,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Ver todos', exact: true }).click();
  await page.getByRole('button', { name: 'Pagas', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Conta já paga', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Em atraso', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Conta por pagar', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Conta já paga', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Por pagar', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.statistics-section')).toContainText('42,50');
  await expect(
    page.getByRole('button', { name: 'Mais filtros', exact: true }),
  ).toHaveAttribute('aria-expanded', 'false');
  await page.screenshot({
    path: `test-results/bills-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('expense quick filters update the selection while preserving monthly totals', async ({
  page,
}) => {
  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
  const rows = [
    {
      id: '00000000-0000-4000-8000-000000000060',
      user_id: userId,
      amount: 12.34,
      spent_on: `${month}-01`,
      category_id: null,
      note: 'Compra manual',
      completion_id: null,
      event_id: null,
    },
    {
      id: '00000000-0000-4000-8000-000000000061',
      user_id: userId,
      amount: 20,
      spent_on: `${month}-01`,
      category_id: null,
      note: 'Conta paga',
      completion_id: '00000000-0000-4000-8000-000000000070',
      event_id: null,
    },
  ];
  await page.route('**/rest/v1/expenses?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rows),
    }),
  );
  await page.goto('/money');
  await expect(
    page.getByRole('combobox', { name: 'Origem', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Criadas ao pagar uma conta', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Conta paga', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Compra manual', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.statistics-section')).toContainText('20,00');
  await expect(
    page.getByRole('heading', { name: '32,34 €', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mais filtros', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Categoria', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Limpar filtros', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Compra manual', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/filters-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('calendar swipes navigate months, weeks and agenda with accessible mobile controls', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-01-31T12:00:00Z'));
  await page.goto('/calendar');
  const title = page.locator('.calendar-toolbar h2');
  await expect(page.locator('.calendar-views button')).toHaveCount(3);
  const swipe = async (dx: number, dy = 0) => {
    const feedback = await page.getByTestId('calendar-swipe').evaluate(
      (element, offset) => {
        const touch = (x: number, y: number) =>
          new Touch({ identifier: 1, target: element, clientX: x, clientY: y });
        element.dispatchEvent(
          new TouchEvent('touchstart', {
            bubbles: true,
            touches: [touch(200, 200)],
          }),
        );
        element.dispatchEvent(
          new TouchEvent('touchmove', {
            bubbles: true,
            touches: [touch(200 + offset.dx, 200 + offset.dy)],
          }),
        );
        const feedback = (element as HTMLElement).style.getPropertyValue(
          '--swipe-offset',
        );
        const events = element.querySelector('.calendar-events')!;
        if (
          getComputedStyle(events).transform !== 'none' ||
          events.closest('.calendar-content')
        ) {
          throw new Error(
            'Event details must stay outside the calendar animation',
          );
        }
        element.dispatchEvent(
          new TouchEvent('touchend', {
            bubbles: true,
            touches: [],
            changedTouches: [touch(200 + offset.dx, 200 + offset.dy)],
          }),
        );
        return feedback;
      },
      { dx, dy },
    );
    expect(feedback).toBe(
      dy ? '0px' : `${Math.max(-60, Math.min(60, dx * 0.4))}px`,
    );
  };
  await page.getByRole('button', { name: 'Mês', exact: true }).click();
  await expect(title).toContainText('janeiro');
  const toolbarBounds = await page.locator('.calendar-toolbar').boundingBox();
  const calendar = await page.getByTestId('calendar-swipe').boundingBox();
  expect(
    calendar!.y - (toolbarBounds!.y + toolbarBounds!.height),
  ).toBeLessThanOrEqual(32);
  await page.getByRole('button', { name: 'Seguinte', exact: true }).click();
  await expect(title).toContainText('fevereiro');
  await expect(page.locator('.calendar-grid')).toBeInViewport();
  await page.getByRole('button', { name: 'Anterior', exact: true }).click();
  await expect(title).toContainText('janeiro');
  await swipe(-100);
  await expect(title).toContainText('fevereiro');
  await expect(page.locator('.calendar-content')).toHaveCSS(
    'animation-name',
    'calendar-slide-in',
  );
  await swipe(100);
  await expect(title).toContainText('janeiro');
  await swipe(-20, 120);
  await expect(title).toContainText('janeiro');
  await page.locator('.calendar-today').click();
  await page.getByRole('button', { name: 'Semana', exact: true }).click();
  await expect(page.locator('.calendar-cell')).toHaveCount(7);
  const week = await title.textContent();
  await swipe(-100);
  await expect(title).not.toHaveText(week!);
  await swipe(100);
  await expect(title).toHaveText(week!);
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  const agenda = await title.textContent();
  await swipe(-100);
  await expect(title).not.toHaveText(agenda!);
  await page.locator('.calendar-today').click();
  await expect(title).toHaveText(agenda!);
  const controls = await page
    .locator('.calendar-navigation button')
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    );
  expect(
    controls.every((control) => control.width >= 44 && control.height >= 44),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/calendar-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('log out is available in the account menu', async ({ page }) => {
  await page.goto('/settings');
  await expect(
    page.locator('main').getByRole('button', { name: 'Sair', exact: true }),
  ).toHaveCount(0);
  const mobile = page.viewportSize()!.width <= 760;
  if (mobile)
    await page.getByRole('button', { name: 'Mais', exact: true }).click();
  await page
    .locator(mobile ? '.mobile-drawer' : '.sidebar')
    .getByRole('button', { name: 'A sua conta', exact: true })
    .click();
  const logout = page.getByRole('menuitem', { name: 'Sair', exact: true });
  await expect(page.locator('.account-menu-details')).toContainText(
    'test@example.com',
  );
  await logout.scrollIntoViewIfNeeded();
  await expect(logout).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole('link', { name: /PDF/ })).toHaveCount(0);
  await logout.click();
  await expect(page).toHaveURL(/\/login/);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), testAuthStorageKey),
  ).toBeNull();
});

function careEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000080',
    user_id: userId,
    group_id: '00000000-0000-4000-8000-000000000081',
    type: 'medication',
    title: 'Medicamento habitual',
    dose: '1 comprimido',
    starts_at: '2026-01-01T08:00:00Z',
    ends_at: null,
    timezone: 'Europe/Lisbon',
    rrule: 'FREQ=DAILY',
    active: true,
    all_day: false,
    location: null,
    notes: null,
    photo_path: null,
    amount: null,
    reminder_minutes: [0],
    google_sync_error: null,
    refill_on: null,
    refill_reminder_days: 3,
    followup_minutes: null,
    excluded_dates: [],
    ...overrides,
  };
}

test('Today records the next dose and collapses completed doses with undo', async ({
  page,
}) => {
  const row = careEvent();
  let records: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/events?**', (route) =>
    route.fulfill({ json: [row] }),
  );
  await page.route('**/rest/v1/event_completions?**', async (route) => {
    if (route.request().method() === 'POST') {
      records = [
        {
          ...route.request().postDataJSON(),
          id: '00000000-0000-4000-8000-000000000082',
          amount_paid: null,
        },
      ];
    } else if (route.request().method() === 'DELETE') records = [];
    await route.fulfill({ json: records });
  });
  await page.goto('/');
  await expect(page.locator('.next-action')).toContainText(
    'Medicamento habitual',
  );
  await page
    .locator('.next-action')
    .getByRole('button', { name: 'Marcar como tomado' })
    .click();
  await expect(page.locator('.completed-doses')).toContainText(
    'Tomas registadas (1)',
  );
  await expect(page.locator('.dose-card')).toBeHidden();
  await page.locator('.completed-doses summary').click();
  await expect(page.locator('.dose-card')).toContainText('Tomado');
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(page.locator('.next-action')).toBeVisible();
  expect(records).toHaveLength(0);
});

test('Today pays the exact bill occurrence through the atomic payment dialog', async ({
  page,
}) => {
  const row = careEvent({
    type: 'bill',
    group_id: null,
    title: 'Conta urgente',
    dose: null,
    rrule: null,
    amount: 42.5,
    all_day: true,
    starts_at: new Date(Date.now() - 86400000).toISOString(),
  });
  let payment: Record<string, unknown> | undefined;
  let records: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/events?**', (route) =>
    route.fulfill({
      json:
        new URL(route.request().url()).searchParams.get('type') ===
        'eq.medication'
          ? []
          : [row],
    }),
  );
  await page.route('**/rest/v1/event_completions?**', (route) =>
    route.fulfill({ json: records }),
  );
  await page.route('**/rest/v1/rpc/mark_bill_paid', async (route) => {
    payment = route.request().postDataJSON();
    records = [
      {
        id: '00000000-0000-4000-8000-000000000082',
        user_id: userId,
        event_id: row.id,
        occurrence_at: row.starts_at,
        status: 'done',
        completed_at: new Date().toISOString(),
        amount_paid: 42.5,
      },
    ];
    await route.fulfill({ json: '00000000-0000-4000-8000-000000000082' });
  });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Marcar como pago', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Conta urgente');
  await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(payment?.p_event_id).toBe(row.id);
  expect(payment?.p_occurrence_at).toBe(row.starts_at);
  expect(payment?.p_amount_paid).toBe(42.5);
  await expect(
    page.getByRole('heading', { name: 'Conta urgente', exact: true }),
  ).toHaveCount(0);
});

test('appointment details display preparation and edit only the chosen occurrence', async ({
  page,
}) => {
  const occurrence = new Date(Date.now() - 3600000).toISOString();
  const row = careEvent({
    type: 'appointment',
    group_id: null,
    title: 'Consulta recorrente',
    dose: null,
    starts_at: occurrence,
    ends_at: new Date(
      new Date(occurrence).getTime() + 30 * 60000,
    ).toISOString(),
    rrule: 'FREQ=WEEKLY',
    location: 'Clínica Lisboa',
    notes: 'Levar os exames',
  });
  let edit: Record<string, unknown> | undefined;
  await page.route('**/rest/v1/events?**', (route) =>
    route.fulfill({
      json:
        new URL(route.request().url()).searchParams.get('type') ===
        'eq.medication'
          ? []
          : [row],
    }),
  );
  await page.route(
    '**/rest/v1/rpc/save_appointment_occurrence',
    async (route) => {
      edit = route.request().postDataJSON();
      await route.fulfill({ json: '00000000-0000-4000-8000-000000000083' });
    },
  );
  await page.goto(`/items/${row.id}?at=${encodeURIComponent(occurrence)}`);
  await expect(
    page.getByText('Levar os exames', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Abrir direções' }),
  ).toHaveAttribute('href', /query=Cl%C3%ADnica%20Lisboa/);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('combobox', { name: 'O que pretende alterar?' })
    .click();
  await page
    .getByRole('option', { name: 'Só este compromisso', exact: true })
    .click();
  await dialog.getByLabel('Nome do compromisso').fill('Consulta alterada');
  await dialog.getByLabel('Duração (minutos)').fill('45');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(edit?.p_event_id).toBe(row.id);
  expect(edit?.p_occurrence_at).toBe(occurrence);
  const input = edit?.p_input as {
    title: string;
    starts_at: string;
    ends_at: string;
  };
  expect(input.title).toBe('Consulta alterada');
  expect(
    new Date(input.ends_at).getTime() - new Date(input.starts_at).getTime(),
  ).toBe(45 * 60000);
});

test('stopping medication keeps history and a past record can be corrected', async ({
  page,
}) => {
  let row = careEvent();
  let records = [
    {
      id: '00000000-0000-4000-8000-000000000082',
      user_id: userId,
      event_id: row.id,
      occurrence_at: new Date(Date.now() - 86400000).toISOString(),
      completed_at: new Date(Date.now() - 86300000).toISOString(),
      status: 'done',
      amount_paid: null,
    },
  ];
  await page.route('**/rest/v1/events?**', async (route) => {
    if (route.request().method() === 'PATCH')
      row = { ...row, ...route.request().postDataJSON() };
    await route.fulfill({ json: [row] });
  });
  await page.route('**/rest/v1/event_completions?**', async (route) => {
    if (route.request().method() === 'PATCH')
      records = [{ ...records[0], ...route.request().postDataJSON() }];
    await route.fulfill({ json: records });
  });
  await page.goto('/medications');
  await page
    .getByRole('button', { name: 'Parar medicamento', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(row.active).toBe(false);
  expect(records).toHaveLength(1);
  await page.goto('/medications/history');
  await expect(page.getByText(/Registado em:/)).toBeVisible();
  await page
    .getByRole('button', { name: 'Corrigir registo', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Saltar toma', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(records[0].status).toBe('skipped');
});

test('expense shortcuts fill a new expense without writing until confirmed', async ({
  page,
}) => {
  const category = {
    id: '00000000-0000-4000-8000-000000000090',
    kind: 'expense',
    name: 'Supermercado',
    user_id: userId,
  };
  const previous = {
    id: '00000000-0000-4000-8000-000000000091',
    user_id: userId,
    amount: 18.25,
    spent_on: '2026-01-01',
    note: 'Compras habituais',
    category_id: category.id,
    completion_id: null,
    event_id: null,
  };
  let writes = 0;
  await page.route('**/rest/v1/categories?**', (route) =>
    route.fulfill({ json: [category] }),
  );
  await page.route('**/rest/v1/expenses**', async (route) => {
    if (route.request().method() === 'POST') writes++;
    await route.fulfill({ json: [previous] });
  });
  await page.goto('/add/expense');
  await page
    .locator('summary')
    .filter({ hasText: 'Despesas habituais' })
    .click();
  await page.getByRole('button', { name: /Compras habituais/ }).click();
  await expect(
    page.getByRole('textbox', { name: 'Valor (€)', exact: true }),
  ).toHaveValue('18.25');
  await expect(
    page.getByRole('combobox', { name: 'Categoria', exact: true }),
  ).toContainText(category.name);
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page).toHaveURL(/\/money$/);
  expect(writes).toBe(1);
});

test('family view has no actions to change shared data and fits small screens', async ({
  page,
}) => {
  const event = careEvent({ starts_at: new Date().toISOString(), rrule: null });
  await page.route('**/rest/v1/rpc/read_family_view', (route) =>
    route.fulfill({
      json: [
        {
          id: '00000000-0000-4000-8000-000000000092',
          owner: 'mother@example.com',
          medications: true,
          appointments: false,
          bills: false,
          events: [event],
          completions: [],
        },
      ],
    }),
  );
  await page.goto('/family');
  await expect(
    page.getByRole('heading', { name: 'Medicamento habitual', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Ainda não registada', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Marcar como tomado' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Editar', exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('reminder setup records confirmation only after sending a device test', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
    Object.defineProperty(navigator.serviceWorker, 'getRegistration', {
      value: async () => ({
        pushManager: {
          getSubscription: async () => ({
            endpoint: 'https://fcm.googleapis.com/fcm/send/test-device',
          }),
        },
      }),
    });
  });
  let testBody: { endpoint: string; locale: string } | undefined;
  await page.route('**/functions/v1/test-reminder', async (route) => {
    testBody = route.request().postDataJSON();
    await route.fulfill({ json: { sent: true } });
  });
  await page.goto('/settings');
  await expect(
    page.getByRole('button', {
      name: 'Vi a notificação neste dispositivo',
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Enviar lembrete de teste', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'Vi a notificação neste dispositivo',
      exact: true,
    })
    .click();
  await expect(
    page.getByText('Notificação confirmada neste dispositivo', { exact: true }),
  ).toBeVisible();
  expect(testBody?.endpoint).toBe(
    'https://fcm.googleapis.com/fcm/send/test-device',
  );
  expect(
    await page.evaluate(
      (id) => localStorage.getItem(`lembra-data:reminder-check:${id}`),
      userId,
    ),
  ).toBeTruthy();
});

test('care forms keep controls separated and phone pages contained', async ({
  page,
}) => {
  await page.goto('/add/medication');
  const everyday = page.getByRole('button', {
    name: 'Todos os dias',
    exact: true,
  });
  const days = page.locator('.day-options');
  const shortcutBox = await everyday.boundingBox();
  const daysBox = await days.boundingBox();
  expect(
    daysBox!.y - shortcutBox!.y - shortcutBox!.height,
  ).toBeGreaterThanOrEqual(8);
  const active = page.locator('.care-form > .checkbox');
  const actions = page.locator('.care-form > .actions');
  const activeBox = await active.boundingBox();
  const actionsBox = await actions.boundingBox();
  expect(
    actionsBox!.y - activeBox!.y - activeBox!.height,
  ).toBeGreaterThanOrEqual(12);
  await page
    .locator('summary')
    .filter({ hasText: 'Embalagem e lembretes adicionais' })
    .click();
  await page.screenshot({
    path: `test-results/care-form-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto('/settings');
  await expect(
    page.getByRole('heading', { name: 'Preparar os lembretes no telemóvel' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Partilhar com a família' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/care-settings-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('an existing backend without the new migration keeps core flows usable', async ({
  page,
}) => {
  const missing = {
    code: 'PGRST205',
    message: 'Could not find table in schema cache',
  };
  await page.route('**/rest/v1/family_shares?**', (route) =>
    route.fulfill({ status: 404, json: missing }),
  );
  await page.route('**/rest/v1/dose_snoozes?**', (route) =>
    route.fulfill({ status: 404, json: missing }),
  );
  await page.goto('/settings');
  await expect(
    page.getByRole('alert').filter({
      hasText:
        'Esta funcionalidade ainda precisa de ser ativada. As restantes áreas do Lembra continuam disponíveis.',
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Não foi possível carregar os dados. Verifique a ligação e tente novamente.',
      { exact: true },
    ),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Dar acesso', exact: true }),
  ).toBeDisabled();
  await page.goto('/add/medication');
  await page
    .locator('summary')
    .filter({ hasText: 'Embalagem e lembretes adicionais' })
    .click();
  await expect(page.getByLabel('Embalagem acaba em')).toBeDisabled();
  await expect(
    page.getByRole('textbox', { name: 'Nome do medicamento', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Guardar medicamento', exact: true }),
  ).toBeEnabled();
});

for (const reason of [
  'worker',
  'permission',
  'subscription',
  'save',
] as const) {
  test(`notification activation explains a ${reason} failure`, async ({
    page,
  }) => {
    await page.addInitScript((reason) => {
      Object.defineProperty(Notification, 'permission', {
        get: () => (reason === 'permission' ? 'denied' : 'granted'),
      });
      Object.defineProperty(Notification, 'requestPermission', {
        value: async () => (reason === 'permission' ? 'denied' : 'granted'),
      });
      Object.defineProperty(navigator.serviceWorker, 'getRegistration', {
        value: async () =>
          reason === 'worker'
            ? undefined
            : {
                active: {},
                pushManager: {
                  getSubscription: async () => null,
                  subscribe: async () => {
                    if (reason === 'subscription')
                      throw new Error('Browser subscription failed');
                    return {
                      endpoint:
                        'https://fcm.googleapis.com/fcm/send/test-device',
                      toJSON: () => ({
                        keys: { p256dh: 'test-public-key', auth: 'test-auth' },
                      }),
                      unsubscribe: async () => true,
                    };
                  },
                },
              },
      });
    }, reason);
    if (reason === 'save')
      await page.route('**/rest/v1/push_subscriptions**', (route) =>
        route.fulfill({
          status: 403,
          json: { message: 'Permission denied', code: '42501' },
        }),
      );
    await page.goto('/settings');
    await page
      .getByRole('button', { name: 'Ativar notificações', exact: true })
      .click();
    const messages = {
      worker: 'O serviço de notificações ainda não está pronto.',
      permission: 'As notificações estão bloqueadas neste navegador.',
      subscription: 'O navegador não conseguiu ativar as notificações.',
      save: 'Não foi possível guardar as notificações na sua conta.',
    };
    await expect(
      page.getByRole('alert').filter({ hasText: messages[reason] }),
    ).toBeVisible();
  });
}

test('general tasks support optional scheduling, editing, Today, Calendar, completion, undo and deletion', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-02T12:00:00Z') });
  let tasks: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/tasks**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      tasks.push({
        ...request.postDataJSON(),
        id: '00000000-0000-4000-8000-000000000081',
        completed_at: null,
        created_at: '2026-10-02T12:00:00Z',
        updated_at: '2026-10-02T12:00:00Z',
      });
    } else if (request.method() === 'PATCH') {
      tasks = tasks.map((task) => ({ ...task, ...request.postDataJSON() }));
    } else if (request.method() === 'DELETE') {
      tasks = [];
    }
    await route.fulfill({ json: request.method() === 'GET' ? tasks : null });
  });
  await page.goto('/add');
  await page.getByRole('link', { name: /Nova tarefa/ }).click();
  await page.getByLabel('Nome da tarefa').fill('Telefonar ao canalizador');
  await expect(page.getByLabel('Hora (opcional)')).toBeDisabled();
  await page.getByLabel(/Notas/).fill('Perguntar pela reparação');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(
    page.getByRole('heading', { name: 'Telefonar ao canalizador' }),
  ).toBeVisible();
  expect(tasks[0].due_on).toBeNull();
  expect(tasks[0].due_time).toBeNull();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Data (opcional)').fill('2026-10-02');
  await dialog.getByLabel('Hora (opcional)').fill('15:30');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(tasks[0].due_on).toBe('2026-10-02');
  expect(tasks[0].due_time).toBe('15:30');
  await page.goto('/calendar');
  await page.getByRole('button', { name: 'Tarefas', exact: true }).click();
  await expect(
    page
      .locator('.calendar-events')
      .getByRole('link', { name: 'Telefonar ao canalizador' }),
  ).toBeVisible();
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Telefonar ao canalizador' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page.locator('summary').filter({ hasText: 'Tarefas' }).click();
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Concluir', exact: true }),
  ).toBeVisible();
  expect(tasks[0].completed_at).toBeNull();
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page.getByRole('button', { name: 'Concluídas', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Telefonar ao canalizador' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Eliminar', exact: true })
    .click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Sem tarefas nesta lista.' }),
  ).toBeVisible();
  expect(tasks).toHaveLength(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('tasks retain input on a failed save and explain a missing migration', async ({
  page,
}) => {
  await page.route('**/rest/v1/tasks**', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: [] })
      : route.fulfill({ status: 500, json: { message: 'Save failed' } }),
  );
  await page.goto('/add/task');
  await page.getByLabel('Nome da tarefa').fill('Comprar pão');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Os seus dados continuam no formulário',
  );
  await expect(page.getByLabel('Nome da tarefa')).toHaveValue('Comprar pão');
  await page.route('**/rest/v1/tasks**', (route) =>
    route.fulfill({
      status: 404,
      json: { code: 'PGRST205', message: 'Missing tasks table' },
    }),
  );
  await page.goto('/tasks');
  await expect(
    page.getByText('As tarefas ainda não estão disponíveis.', { exact: false }),
  ).toBeVisible();
});

test('repeat controls save monthly month-end bills with leap-year previews and an occurrence limit', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-02T12:00:00Z') });
  let saved: Record<string, unknown> | undefined;
  await page.route('**/rest/v1/events**', (route) => {
    if (route.request().method() === 'POST')
      saved = route.request().postDataJSON();
    return route.fulfill({ json: [] });
  });
  await page.goto('/add/bill');
  await page.getByLabel('Nome da conta').fill('Assinatura');
  await page.locator('input[type="date"]').fill('2028-01-01');
  await page.getByLabel('Valor (€)').fill('15');
  await page.getByRole('combobox', { name: 'Repetição', exact: true }).click();
  await page.getByRole('option', { name: 'Mensalmente', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Quando no mês', exact: true })
    .click();
  await page
    .getByRole('option', {
      name: 'Último dia do mês (ou dias antes)',
      exact: true,
    })
    .click();
  await expect(page.locator('.schedule-preview')).toContainText('29');
  await expect(page.locator('.schedule-preview')).toContainText('29/02/2028');
  await page.getByRole('combobox', { name: 'Termina', exact: true }).click();
  await page
    .getByRole('option', { name: 'Após um número de ocorrências', exact: true })
    .click();
  await page.getByLabel('Ocorrências').fill('3');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page).toHaveURL(/\/bills$/);
  expect(saved?.rrule).toBe('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1;COUNT=3');
  expect(saved?.starts_at).toBe('2028-01-31T09:00:00.000Z');
});

test('recurring task occurrences complete independently, undo and skip without ending the series', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-02T12:00:00Z') });
  const taskId = '00000000-0000-4000-8000-000000000092';
  const task = {
    id: taskId,
    user_id: userId,
    title: 'Regar as plantas',
    notes: '',
    due_on: '2026-10-01',
    due_time: null,
    rrule: 'FREQ=DAILY;COUNT=3',
    excluded_dates: [] as string[],
    completed_at: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };
  let completed: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/tasks**', (route) =>
    route.fulfill({ json: [task] }),
  );
  await page.route('**/rest/v1/task_completions**', (route) => {
    const request = route.request();
    if (request.method() === 'POST') completed = [request.postDataJSON()];
    if (request.method() === 'DELETE') completed = [];
    return route.fulfill({
      json: request.method() === 'GET' ? completed : null,
    });
  });
  await page.route('**/rest/v1/rpc/edit_task_occurrence', (route) => {
    const body = route.request().postDataJSON();
    task.excluded_dates.push(body.p_day);
    return route.fulfill({ json: null });
  });
  await page.goto('/tasks');
  await expect(
    page.getByRole('heading', { name: 'Regar as plantas', exact: true }),
  ).toHaveCount(3);
  await page
    .getByRole('button', { name: 'Concluir', exact: true })
    .first()
    .click();
  await expect(
    page.getByRole('button', { name: 'Concluir', exact: true }),
  ).toHaveCount(2);
  expect(completed[0].occurrence_on).toBe('2026-10-01');
  await page.getByRole('button', { name: 'Concluídas', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Regar as plantas', exact: true }),
  ).toHaveCount(1);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await page.getByRole('button', { name: 'Por fazer', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Concluir', exact: true }),
  ).toHaveCount(3);
  await page
    .getByRole('button', { name: 'Omitir esta ocorrência', exact: true })
    .first()
    .click();
  await expect(
    page.getByRole('button', { name: 'Concluir', exact: true }),
  ).toHaveCount(2);
  expect(task.excluded_dates).toEqual(['2026-10-01']);
});

test('calendar date picker jumps across years, clamps month ends and preserves the selected view', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-02T12:00:00Z') });
  await page.goto('/calendar');
  await page.getByRole('button', { name: 'Mês', exact: true }).click();
  await page.getByRole('button', { name: /Escolher data:/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Escolher data' });
  await dialog.getByLabel('Data').fill('2028-01-31');
  await dialog
    .getByRole('button', { name: 'Ir para esta data', exact: true })
    .click();
  await page.getByRole('button', { name: /Escolher data:/ }).click();
  await dialog
    .getByRole('button', { name: 'fevereiro 2028', exact: true })
    .click();
  await expect(page.locator('.calendar-period')).toContainText('fevereiro');
  await expect(page.locator('.calendar-events .section-heading')).toContainText(
    '29',
  );
  await page.getByRole('button', { name: 'Semana', exact: true }).click();
  await page.getByRole('button', { name: /Escolher data:/ }).click();
  await dialog.getByLabel('Data').fill('2050-12-31');
  await dialog
    .getByRole('button', { name: 'Ir para esta data', exact: true })
    .click();
  await expect(page.locator('.calendar-period')).toContainText('2051');
  await expect(
    page.getByRole('button', { name: 'Semana', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Escolher data:/ }).click();
  await dialog.getByRole('button', { name: 'Hoje', exact: true }).click();
  await expect(page.locator('.calendar-period')).toContainText('2026');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('recurring expense saves a confirmed first payment and a schedule for later confirmation', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-02T12:00:00Z') });
  let input: Record<string, unknown> | undefined;
  await page.route('**/rest/v1/rpc/create_recurring_expense', (route) => {
    input = route.request().postDataJSON().p_input;
    return route.fulfill({ json: '00000000-0000-4000-8000-000000000094' });
  });
  await page.goto('/add/expense');
  await page.getByLabel('Valor (€)').fill('20');
  await page.getByRole('combobox', { name: 'Repetição', exact: true }).click();
  await page.getByRole('option', { name: 'Semanalmente', exact: true }).click();
  await page.getByLabel('Nome da despesa recorrente').fill('Compras semanais');
  await expect(
    page.getByText('As próximas aparecem em Contas', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page).toHaveURL(/\/money$/);
  expect(input?.rrule).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=FR');
  expect(input?.spent_on).toBe('2026-10-02');
  expect(input?.amount).toBe(20);
});

test('Tasks filters, summary counts and sorting work on all screen sizes', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-02T12:00:00Z') });
  const tasks = [
    {
      title: 'Zebra overdue',
      due_on: '2026-10-01',
      notes: 'Telephone the repair service',
    },
    { title: 'Alpha today', due_on: '2026-10-02', due_time: '15:30:00' },
    { title: 'Beta upcoming', due_on: '2026-10-05' },
    { title: 'Gamma unscheduled', due_on: null },
    {
      title: 'Delta completed',
      due_on: '2026-10-02',
      completed_at: '2026-10-02T11:00:00Z',
    },
  ].map((task, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 80).padStart(12, '0')}`,
    user_id: userId,
    notes: '',
    due_time: null,
    completed_at: null,
    rrule: null,
    excluded_dates: [],
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
    ...task,
  }));
  await page.route('**/rest/v1/tasks**', (route) =>
    route.fulfill({ json: tasks }),
  );
  await page.goto('/tasks');
  await expect(page.locator('.task-row')).toHaveCount(4);
  await expect(
    page.getByRole('region', { name: 'Resumo das tarefas' }),
  ).toBeVisible();
  await expect(page.locator('.task-row').first()).toContainText(
    'Zebra overdue',
  );
  await page.getByRole('button', { name: 'Mais filtros', exact: true }).click();
  const sortControl = page.getByRole('combobox', {
    name: 'Ordenar por',
    exact: true,
  });
  await sortControl.evaluate((element) =>
    element.scrollIntoView({ block: 'center' }),
  );
  await sortControl.click();
  await page.getByRole('option', { name: 'Nome: A a Z', exact: true }).click();
  await expect(page.locator('.task-row').first()).toContainText('Alpha today');
  await page.getByRole('combobox', { name: 'Período', exact: true }).click();
  await page.getByRole('option', { name: 'Sem data', exact: true }).click();
  await expect(page.locator('.task-row')).toHaveCount(1);
  await expect(page.locator('.task-row')).toContainText('Gamma unscheduled');
  await page
    .getByRole('button', { name: 'Limpar filtros', exact: true })
    .click();
  await page.getByLabel('Procurar tarefas').fill('repair');
  await expect(page.locator('.task-row')).toHaveCount(1);
  await expect(page.locator('.task-row')).toContainText('Zebra overdue');
  await page
    .getByRole('button', { name: 'Limpar filtros', exact: true })
    .click();
  await page.getByRole('button', { name: 'Concluídas', exact: true }).click();
  await expect(page.locator('.task-row')).toHaveCount(1);
  await expect(page.locator('.task-row')).toContainText('Delta completed');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('home overview shows real attention counts, monthly spending and upcoming plans', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-02T12:00:00Z') });
  const tasks = [
    { title: 'Overdue chore', due_on: '2026-10-01' },
    { title: 'Today chore', due_on: '2026-10-02' },
    { title: 'Next week chore', due_on: '2026-10-05' },
    { title: 'Buy a gift', due_on: null },
    {
      title: 'Finished without a date',
      due_on: null,
      completed_at: '2026-10-02T11:00:00Z',
    },
    {
      title: 'Finished ahead of schedule',
      due_on: '2026-10-10',
      completed_at: '2026-10-02T11:00:00Z',
    },
  ].map((task, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 70).padStart(12, '0')}`,
    user_id: userId,
    due_time: null,
    completed_at: null,
    notes: '',
    rrule: null,
    excluded_dates: [],
    created_at: '2026-10-01T12:00:00Z',
    ...task,
  }));
  const events = [
    {
      id: '00000000-0000-4000-8000-000000000065',
      type: 'appointment',
      title: 'Dentist next week',
      starts_at: '2026-10-06T09:00:00Z',
    },
    {
      id: '00000000-0000-4000-8000-000000000066',
      type: 'bill',
      title: 'Internet bill',
      starts_at: '2026-10-04T09:00:00Z',
      amount: 25,
    },
  ].map((event) => ({
    user_id: userId,
    active: true,
    all_day: false,
    timezone: 'Europe/Lisbon',
    rrule: null,
    ends_at: null,
    dose: null,
    notes: null,
    reminder_minutes: [],
    ...event,
  }));
  await page.route('**/rest/v1/tasks**', (route) =>
    route.fulfill({ json: tasks }),
  );
  await page.route('**/rest/v1/events?**', (route) =>
    route.fulfill({
      json:
        new URL(route.request().url()).searchParams.get('type') ===
        'eq.medication'
          ? []
          : events,
    }),
  );
  await page.route('**/rest/v1/expenses?**', (route) => {
    expect(
      new URL(route.request().url()).searchParams.getAll('spent_on'),
    ).toEqual(['gte.2026-10-01', 'lt.2026-11-01']);
    return route.fulfill({ json: [{ amount: 12.5 }, { amount: 7.25 }] });
  });
  await page.goto('/');
  const overview = page.getByRole('region', {
    name: 'A sua rotina num relance',
  });
  await expect(
    overview
      .locator('.home-stat')
      .filter({ hasText: 'Tarefas a tratar' })
      .locator('strong'),
  ).toHaveText('2');
  await expect(
    overview
      .locator('.home-stat')
      .filter({ hasText: 'Contas por pagar' })
      .locator('strong'),
  ).toHaveText('1');
  await expect(
    overview
      .locator('.home-stat')
      .filter({ hasText: 'Gasto este mês' })
      .locator('strong'),
  ).toHaveText(/19,75/);
  await expect(page.locator('.home-upcoming')).toContainText(
    'Dentist next week',
  );
  await expect(page.locator('.home-upcoming')).toContainText('Next week chore');
  await expect(page.locator('.home-unscheduled')).toContainText('Buy a gift');
  const completed = page
    .locator('details')
    .filter({ hasText: 'Tarefas · Concluídas (2)' });
  await completed.locator('summary').click();
  await expect(
    completed.getByRole('heading', { name: 'Finished without a date' }),
  ).toBeVisible();
  await expect(
    completed.getByRole('heading', { name: 'Finished ahead of schedule' }),
  ).toBeVisible();
  await completed.locator('summary').click();

  await expect(
    page.getByText('Prepare os seus lembretes', { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath('home-overview.png'),
    fullPage: true,
  });
  await overview.getByRole('link', { name: /Contas por pagar/ }).click();
  await expect(page).toHaveURL(/\/bills$/);
});

test('simplified navigation keeps appointments and bills accessible within their main sections', async ({
  page,
}) => {
  await page.goto('/');
  const mobile = page.viewportSize()!.width <= 760;
  if (mobile)
    await page.getByRole('button', { name: 'Mais', exact: true }).click();
  const navigation = page.locator(mobile ? '.mobile-drawer' : '.sidebar');
  await expect(
    navigation.locator('.primary-nav').getByRole('link'),
  ).toHaveCount(5);
  await expect(
    navigation.locator('.secondary-nav').getByRole('link'),
  ).toHaveCount(2);
  await expect(
    navigation.getByRole('link', { name: 'Compromissos', exact: true }),
  ).toHaveCount(0);
  await expect(
    navigation.getByRole('link', { name: 'Contas', exact: true }),
  ).toHaveCount(0);
  await expect(
    navigation.getByText('test@example.com', { exact: true }),
  ).toHaveCount(0);
  await navigation
    .getByRole('link', { name: 'Calendário', exact: true })
    .click();
  const calendarNav = page.getByRole('navigation', {
    name: 'Calendário e compromissos',
  });
  await calendarNav
    .getByRole('link', { name: 'Compromissos', exact: true })
    .click();
  await expect(page).toHaveURL(/\/appointments$/);
  if (mobile)
    await page.getByRole('button', { name: 'Mais', exact: true }).click();
  await expect(
    navigation.getByRole('link', { name: 'Calendário', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await navigation.getByRole('link', { name: 'Dinheiro', exact: true }).click();
  const moneyNav = page.getByRole('navigation', { name: 'Dinheiro e contas' });
  await moneyNav.getByRole('link', { name: 'Contas', exact: true }).click();
  await expect(page).toHaveURL(/\/bills$/);
  if (mobile)
    await page.getByRole('button', { name: 'Mais', exact: true }).click();
  await expect(
    navigation.getByRole('link', { name: 'Dinheiro', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await navigation
    .getByRole('button', { name: 'A sua conta', exact: true })
    .click();
  await expect(page.locator('.account-menu-details')).toContainText(
    'test@example.com',
  );
  await page.getByRole('menu').press('Escape');
  await expect(page.getByRole('menu')).not.toBeVisible();
  if (mobile)
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.screenshot({
    path: test.info().outputPath('navigation.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('mobile hamburger keeps closing and account controls usable on short screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await page.goto('/');
  const menuButton = page.getByRole('button', { name: 'Mais', exact: true });
  await menuButton.click();
  await expect(
    page.locator('.mobile-bottom-nav button[aria-haspopup="dialog"]'),
  ).toHaveAttribute('aria-expanded', 'true');
  const drawer = page.locator('.mobile-drawer');
  await expect(
    drawer.getByRole('button', { name: 'A sua conta', exact: true }),
  ).toBeInViewport();
  await expect(drawer.locator('.drawer-navigation')).toHaveJSProperty(
    'scrollTop',
    0,
  );
  await drawer
    .getByRole('button', { name: 'A sua conta', exact: true })
    .click();
  await expect(
    page.getByRole('menuitem', { name: 'Sair', exact: true }),
  ).toBeVisible();
  await page.getByRole('menu').press('Escape');
  await expect(
    drawer.getByRole('button', { name: 'Fechar', exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath('mobile-menu.png') });
  await drawer.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await menuButton.click();
  await drawer.getByRole('link', { name: 'Tarefas', exact: true }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(drawer).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('mobile top hamburger stays visible and navigates with the bottom bar hidden', async ({
  page,
}) => {
  if (page.viewportSize()!.width > 760)
    await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.addStyleTag({
    content: '.mobile-bottom-nav { display: none !important; }',
  });
  const hamburger = page.getByRole('button', {
    name: 'Abrir menu',
    exact: true,
  });
  await expect(hamburger).toBeInViewport();
  const size = await hamburger.boundingBox();
  expect(size!.width).toBeGreaterThanOrEqual(44);
  expect(size!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: test.info().outputPath('mobile-header.png') });
  for (const [label, path] of [
    ['Tarefas', '/tasks'],
    ['Medicamentos', '/medications'],
    ['Calendário', '/calendar'],
    ['Dinheiro', '/money'],
    ['Definições', '/settings'],
  ]) {
    await hamburger.click();
    const drawer = page.getByRole('dialog', { name: 'Navegação', exact: true });
    await drawer.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(drawer).not.toBeVisible();
    await expect(hamburger).toBeInViewport();
  }
  await page.evaluate(() =>
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'instant',
    }),
  );
  await expect(hamburger).toBeInViewport();
  await hamburger.click();
  await page
    .getByRole('dialog', { name: 'Navegação', exact: true })
    .getByRole('button', { name: 'Fechar', exact: true })
    .click();
  await expect(hamburger).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('mobile header exposes account details and logout without opening navigation', async ({
  page,
}) => {
  if (page.viewportSize()!.width > 760)
    await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings');
  const account = page
    .locator('.mobile-header')
    .getByRole('button', { name: 'A sua conta', exact: true });
  await expect(account).toBeInViewport();
  await page.evaluate(() =>
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'instant',
    }),
  );
  await expect(account).toBeInViewport();
  await account.click();
  await expect(page.locator('.mobile-drawer')).not.toBeVisible();
  await expect(page.locator('.account-menu-details')).toContainText(
    'test@example.com',
  );
  const logout = page.getByRole('menuitem', { name: 'Sair', exact: true });
  await expect(logout).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath('mobile-account.png') });
  await logout.click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), testAuthStorageKey),
  ).toBeNull();
});
