import { COURTS_SLUG, SCREENS, THEMES, VIEWPORTS, expect, gotoReady, signIn, test } from './support';

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    test.describe(`capturas ${theme} ${vp.name}`, () => {
      test.use({ colorScheme: theme, viewport: { width: vp.width, height: vp.height } });

      for (const screen of SCREENS) {
        test(screen.key, async ({ prepared: page, apiProblems }) => {
          if (screen.auth) await signIn(page);
          await gotoReady(page, screen.path, apiProblems, screen.ready);
          await expect(page).toHaveScreenshot(`${screen.key}-${theme}-${vp.name}.png`, { fullPage: true });
        });
      }

      test('canchas con día seleccionado y apartado', async ({ prepared: page, apiProblems }) => {
        await gotoReady(page, `/e/${COURTS_SLUG}/canchas`, apiProblems, '.alumno-res');
        await page.locator('.alumno-res__hours button:not([disabled])').first().click();
        await expect(page).toHaveScreenshot(`canchas-apartado-${theme}-${vp.name}.png`, { fullPage: true });
      });

      test('mis reservas', async ({ prepared: page, apiProblems }) => {
        await signIn(page);
        await gotoReady(page, `/e/${COURTS_SLUG}/canchas`, apiProblems, '.alumno-res__mine');
        await expect(page.locator('.alumno-res__mine')).toHaveScreenshot(`mis-reservas-${theme}-${vp.name}.png`);
      });
    });
  }
}
