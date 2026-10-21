import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { SCREENS, THEMES, expect, gotoReady, signIn, test } from './support';

const { exceptions } = JSON.parse(readFileSync(new URL('./a11y-exceptions.json', import.meta.url), 'utf8')) as {
  exceptions: { rule: string; ticket: string; selector?: string }[];
};

test('toda excepción de axe cita un ticket', () => {
  for (const e of exceptions) expect(e.ticket, `excepción ${e.rule}`).toMatch(/^[\w.-]+\/[\w.-]+#\d+$/);
});

for (const theme of THEMES) {
  test.describe(`axe ${theme}`, () => {
    test.use({ colorScheme: theme, viewport: { width: 390, height: 844 } });

    for (const screen of SCREENS) {
      test(screen.key, async ({ prepared: page, apiProblems }) => {
        if (screen.auth) await signIn(page);
        await gotoReady(page, screen.path, apiProblems, screen.ready);
        let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
        const ruleIds = exceptions.filter((e) => !e.selector).map((e) => e.rule);
        if (ruleIds.length) builder = builder.disableRules(ruleIds);
        for (const e of exceptions) if (e.selector) builder = builder.exclude(e.selector);
        const { violations } = await builder.analyze();
        const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      });
    }
  });
}
