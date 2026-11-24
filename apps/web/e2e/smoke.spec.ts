import { expect, test } from '@playwright/test';

test('smoke: add an application, advance its status, find it, see reports', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Response rate')).toBeVisible();
  await expect(page.getByText('In interview')).toBeVisible();

  await page.getByRole('button', { name: 'Add application' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Company').fill('Smoke Test Co');
  await dialog.getByLabel('Role').fill('QA Engineer');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();

  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Smoke Test Co');

  const timeline = page.getByRole('region', { name: 'Status timeline' });
  await timeline.getByLabel('Status').selectOption({ label: 'Interview' });
  await timeline.getByRole('button', { name: 'Add status' }).click();
  await expect(page.getByRole('heading', { level: 1 }).locator('xpath=following-sibling::*').getByText('Interview', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Applications', exact: true }).click();
  await page.getByLabel('Search').fill('smoke');
  await expect(page.getByRole('link', { name: /Smoke Test Co/ })).toHaveCount(1);
  await expect(page.getByRole('link', { name: /Smoke Test Co/ })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Smoke Test Co' })).toHaveCount(1);

  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Status flow (Sankey chart)' })).toBeVisible();

  await expect(page.getByRole('contentinfo')).toContainText(/In-memory/);
});
