import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test, expect, type Page } from '@playwright/test';
import { SignupOptionalProfileFields } from '../src/components/signup-profile-fields';

const viewportWidths = [320, 360, 375, 402];
const memberViewportWidths = [320, 360, 390, 768, 1440];
const authViewports = [
  { name: '320px mobile', width: 320, height: 760 },
  { name: '360px mobile', width: 360, height: 800 },
  { name: '390px mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];
const authenticatedState = process.env.GLOBUS_VIEWPORT_STORAGE_STATE;
const validAuthenticatedState =
  authenticatedState && existsSync(authenticatedState) ? authenticatedState : undefined;

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const measurements = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const visibleOverflowingElements: string[] = [];

    for (const element of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        Number(style.opacity) === 0 ||
        style.position === 'fixed' ||
        rect.width === 0 ||
        rect.height === 0
      ) {
        continue;
      }

      let ancestor = element.parentElement;
      let containedByHorizontalScroller = false;
      while (ancestor && ancestor !== document.body) {
        const overflowX = window.getComputedStyle(ancestor).overflowX;
        if (['auto', 'scroll', 'hidden'].includes(overflowX)) {
          containedByHorizontalScroller = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }

      if (!containedByHorizontalScroller && rect.right > viewportWidth + 1) {
        const identifier = element.id ? `#${element.id}` : '';
        const classes =
          typeof element.className === 'string'
            ? `.${element.className.trim().replace(/\s+/g, '.')}`
            : '';
        visibleOverflowingElements.push(
          `${element.tagName.toLowerCase()}${identifier}${classes} ends at ${Math.round(rect.right)}px`,
        );
      }
    }

    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      visibleOverflowingElements: visibleOverflowingElements.slice(0, 8),
    };
  });

  expect(
    measurements.documentWidth,
    `${context}: document scroll width exceeds its ${measurements.viewportWidth}px viewport`,
  ).toBeLessThanOrEqual(measurements.viewportWidth);
  expect(
    measurements.bodyWidth,
    `${context}: body scroll width exceeds its ${measurements.viewportWidth}px viewport`,
  ).toBeLessThanOrEqual(measurements.viewportWidth);
  expect(
    measurements.visibleOverflowingElements,
    `${context}: visible content extends beyond the viewport: ${measurements.visibleOverflowingElements.join('; ')}`,
  ).toEqual([]);
}

async function openAndCheck(page: Page, path: string, width: number, context: string) {
  await page.setViewportSize({ width, height: 850 });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  if (path === '/') {
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => page.locator('a[href="/sign-in"]').count()).toBeGreaterThan(0);
    await expect.poll(() => page.locator('a[href="/sign-up"]').count()).toBeGreaterThan(0);
  } else {
    await expect(page.locator('.gb-auth-shell')).toBeVisible();
  }
  if (path === '/sign-in') {
    await expect(page.locator('#gb-signin-username')).toBeVisible();
    await expect(page.locator('#gb-signin-password')).toBeVisible();
  }
  await expectNoHorizontalOverflow(page, `${context} at ${width}px (${path})`);
}

async function expectNoAuthLayoutOverlap(page: Page, context: string) {
  const overlaps = await page.evaluate(() => {
    const isVisible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' &&
        Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const containers = [
      '.gb-auth-content',
      '.gb-signup-form-wrap',
      'form.gb-signup-form',
      '.gb-signup-fields',
      '.gb-signup-fields .gb-field',
      '.gb-signin-form-wrap',
      'form.gb-auth-form',
      '.gb-login-recovery-actions',
      '.gb-verification-actions',
    ];
    const collisions: string[] = [];

    for (const selector of containers) {
      for (const container of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        const children = Array.from(container.children).filter(isVisible) as HTMLElement[];
        for (let first = 0; first < children.length; first += 1) {
          const firstRect = children[first].getBoundingClientRect();
          for (let second = first + 1; second < children.length; second += 1) {
            const secondRect = children[second].getBoundingClientRect();
            const intersects =
              Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left) > 1 &&
              Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top) > 1;
            if (intersects) {
              collisions.push(`${selector}: ${children[first].className || children[first].tagName} overlaps ${children[second].className || children[second].tagName}`);
            }
          }
        }
      }
    }

    return collisions;
  });

  expect(overlaps, `${context}: sign-up elements overlap: ${overlaps.join('; ')}`).toEqual([]);
}

test.describe('public and authentication pages at phone widths', () => {
  for (const width of viewportWidths) {
    test(`landing, sign-in, and sign-up fit at ${width}px`, async ({ page }) => {
      for (const path of ['/', '/sign-in', '/sign-up']) {
        await openAndCheck(page, path, width, 'Public/authentication page');
        if (path === '/') {
          await expect(page.getByRole('link', { name: 'Help', exact: true })).toHaveCount(0);
        }
      }
    });
  }

});

test('the removed Help Center route no longer renders support content', async ({ page }) => {
  await page.goto('/help', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('404 Page Not Found')).toBeVisible();
});

test('short Vault URL redirects to the canonical Private Vault page', async ({ page }) => {
  await page.goto('/vault', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.gb-auth-shell')).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByText('404 Page Not Found')).toHaveCount(0);
});

test('admin Vault access URLs resolve through the registered admin route', async ({ page }) => {
  for (const path of ['/admin/vault-access', '/admin/vault-acces']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.gb-auth-shell')).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByText('404 Page Not Found')).toHaveCount(0);
  }
});

test.describe('landing feature layout after removing wallet-funding copy', () => {
  for (const viewport of authViewports) {
    test(`keeps the remaining features gap-free at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        localStorage.setItem('globus:pwa-prompt-shown-at', String(Date.now()));
      });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const grid = page.getByTestId('landing-feature-grid');
      await expect(grid).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Add wallet funds' })).toHaveCount(0);
      await expect(page.getByText('Verified customers with an active Private Vault subscription can add funds to eligible wallets immediately.')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Keep a clear record' })).toBeVisible();

      const layout = await grid.evaluate((element) => {
        const container = element.getBoundingClientRect();
        const items = Array.from(element.children).map((child) => {
          const rect = child.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width };
        });
        return { x: container.x, width: container.width, items };
      });
      expect(layout.items).toHaveLength(3);
      if (viewport.width >= 1024) {
        expect(Math.max(...layout.items.map((item) => item.y)) - Math.min(...layout.items.map((item) => item.y))).toBeLessThanOrEqual(1);
      } else if (viewport.width >= 640) {
        expect(layout.items[0].y).toBeCloseTo(layout.items[1].y, 0);
        expect(layout.items[2].y).toBeGreaterThan(layout.items[0].y);
        expect(layout.items[2].x).toBeCloseTo(layout.x, 0);
        expect(layout.items[2].width).toBeCloseTo(layout.width, 0);
      } else {
        expect(layout.items[1].y).toBeGreaterThan(layout.items[0].y);
        expect(layout.items[2].y).toBeGreaterThan(layout.items[1].y);
      }
      await expectNoHorizontalOverflow(page, `Landing feature layout at ${viewport.width}px`);
    });
  }
});

test.describe('Globus sign-up design', () => {
  for (const viewport of authViewports) {
    test(`shows the requested account fields and layout on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });

      const shell = page.locator('.gb-auth-signup-shell');
      await expect(shell).toBeVisible();
      await expect(page.getByRole('img', { name: 'Globus Bank' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
      await expect(page.getByText('Enter your details to get started.')).toBeVisible();
      await expect(page.getByText('6–12 characters with a letter; letters, numbers, hyphens, underscores.')).toBeVisible();
      await expect(page.getByText('8+ characters; Clerk checks additional requirements.')).toBeVisible();

      await expect(page.locator('.gb-signup-fields .gb-field-label')).toHaveText([
        'First name',
        'Last name',
        'Username',
        'Email address',
        'Password',
      ]);
      await expect(page.getByTestId('input-signup-first-name')).toHaveAttribute('required', '');
      await expect(page.getByTestId('input-signup-last-name')).toHaveAttribute('required', '');
      await expect(page.getByTestId('input-signup-username')).toHaveAttribute('required', '');
      await expect(page.getByTestId('input-signup-username')).toHaveAttribute('minlength', '6');
      await expect(page.getByTestId('input-signup-username')).toHaveAttribute('maxlength', '12');
      await expect(page.getByTestId('input-signup-username')).toHaveAttribute('pattern', '(?=.*[A-Za-z])[A-Za-z0-9_-]{6,12}');
      await expect(page.getByTestId('input-signup-email')).toHaveAttribute('required', '');
      await expect(page.getByTestId('input-signup-password')).toHaveAttribute('required', '');
      await expect(page.getByTestId('input-signup-password')).toHaveAttribute('minlength', '8');

      const form = page.locator('form.gb-signup-form');
      const button = form.getByRole('button', { name: 'Continue' });
      await expect(button).toBeVisible();
      await expect(button).toHaveCSS('background-image', /linear-gradient/);
      await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)');
      const [formBox, buttonBox, inputStyle, shellStyle] = await Promise.all([
        form.boundingBox(),
        button.boundingBox(),
        page.locator('#gb-signup-first-name').evaluate((element) => {
          const style = getComputedStyle(element);
          return { height: Number.parseFloat(style.height), borderRadius: style.borderRadius };
        }),
        shell.evaluate((element) => getComputedStyle(element).backgroundColor),
      ]);

      expect(formBox).not.toBeNull();
      expect(buttonBox).not.toBeNull();
      expect(buttonBox!.width).toBeGreaterThanOrEqual(formBox!.width - 1);
      expect(inputStyle.height).toBeGreaterThanOrEqual(44);
      expect(inputStyle.height).toBeLessThanOrEqual(50);
      expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
      expect(buttonBox!.height).toBeLessThanOrEqual(52);
      expect(inputStyle.borderRadius).toBe('10px');
      expect(shellStyle).toBe('rgb(255, 255, 255)');
      await expect(page.getByText('Already have an account?')).toBeVisible();
      await expect(page.getByTestId('link-signup-sign-in')).toHaveText('Sign in');
      await expectNoAuthLayoutOverlap(page, `Sign-up at ${viewport.width}px`);
      const footer = page.getByText('Secured by Clerk');
      await footer.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
      await expect(footer).toBeVisible();
      const footerBox = await footer.boundingBox();
      expect(footerBox).not.toBeNull();
      expect(footerBox!.y).toBeGreaterThanOrEqual(0);
      expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(viewport.height);
      await expectNoHorizontalOverflow(page, `Sign-up at ${viewport.width}px`);
    });
  }

  test('keeps sign-up content reachable by natural scrolling on a short phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 400 });
    await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });

    const scrollState = await page.evaluate(() => ({
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      overflowY: getComputedStyle(document.querySelector('.gb-auth-signup-shell')!).overflowY,
    }));
    expect(scrollState.documentHeight).toBeGreaterThan(scrollState.viewportHeight);
    expect(scrollState.overflowY).not.toBe('hidden');

    const footer = page.getByText('Secured by Clerk');
    await footer.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
    const footerBox = await footer.boundingBox();
    expect(footerBox).not.toBeNull();
    expect(footerBox!.y).toBeGreaterThanOrEqual(0);
    expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(400);
    await expectNoHorizontalOverflow(page, 'Sign-up at 320px with a short viewport');
  });

  test('keeps long validation feedback clear of the continue button', async ({ page }) => {
    for (const viewport of authViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });

      await page.locator('form.gb-signup-form').evaluate((form) => {
        const message = document.createElement('p');
        message.setAttribute('role', 'alert');
        message.className = 'gb-auth-error';
        message.textContent = `We could not finish creating the account. ${'A'.repeat(90)} Please review the details and try again.`;
        form.querySelector('button')?.before(message);
      });

      const message = page.locator('form.gb-signup-form [role="alert"]');
      const button = page.locator('form.gb-signup-form button');
      await expect(message).toBeVisible();
      const [messageBox, buttonBox] = await Promise.all([
        message.boundingBox(),
        button.boundingBox(),
      ]);
      expect(messageBox).not.toBeNull();
      expect(buttonBox).not.toBeNull();
      expect(messageBox!.y + messageBox!.height).toBeLessThanOrEqual(buttonBox!.y + 1);
      await expectNoAuthLayoutOverlap(page, `Sign-up validation at ${viewport.width}px`);
      await expectNoHorizontalOverflow(page, `Sign-up validation at ${viewport.width}px`);
    }
  });

  test('matches the sign-up shell with username-and-password sign-in', async ({ page }) => {
    for (const viewport of authViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });

      const shell = page.locator('.gb-auth-signin-shell');
      await expect(shell).toBeVisible();
      await expect(page.locator('.gb-auth-signup-shell')).toHaveCount(0);
      await expect(page.locator('#gb-signin-username')).toBeVisible();
      await expect(page.locator('#gb-signin-password')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Forgot username or password?' })).toBeVisible();
      const signInLogo = page.locator('.gb-signin-brand');
      await expect(signInLogo).toBeVisible();
      const signInLogoBox = await signInLogo.boundingBox();
      expect(signInLogoBox).not.toBeNull();
      await expect(shell).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      const [button, input] = await Promise.all([
        page.locator('.gb-signin-form-wrap .gb-primary-button').evaluate(element => getComputedStyle(element).backgroundImage),
        page.locator('#gb-signin-username').evaluate(element => getComputedStyle(element).borderRadius),
      ]);
      expect(button).toContain('linear-gradient');
      expect(input).toBe('10px');
      await expectNoHorizontalOverflow(page, `Sign-in at ${viewport.width}px`);
      await expectNoAuthLayoutOverlap(page, `Sign-in at ${viewport.width}px`);
      await expect(page.locator('#gb-signup-first-name, #gb-signup-last-name, #gb-signup-phone, #gb-signup-country, #gb-signup-dob, [data-testid="checkbox-signup-terms"]')).toHaveCount(0);
      await expect(page.locator('#gb-customer-id, #gb-signin-email, #gb-signin-phone')).toHaveCount(0);
      if (viewport.width <= 760) {
        await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });
        const signUpLogoBox = await page.getByRole('img', { name: 'Globus Bank' }).boundingBox();
        expect(signUpLogoBox).not.toBeNull();
        expect(Math.abs(signInLogoBox!.y - signUpLogoBox!.y)).toBeLessThan(36);
      }
    }
  });

  test('accepts email or Customer ID for password and username recovery', async ({ page }) => {
    for (const viewport of authViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/sign-in/email', { waitUntil: 'domcontentloaded' });

      await expect(page.locator('.gb-auth-signin-shell')).toBeVisible();
      await expect(page.locator('.gb-auth-signup-shell')).toHaveCount(0);
      await expect(page.getByLabel('Email or Customer ID')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Password' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Username' })).toBeVisible();
      await expectNoHorizontalOverflow(page, `Recovery at ${viewport.width}px`);
      await expectNoAuthLayoutOverlap(page, `Recovery at ${viewport.width}px`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/sign-in/email', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email or Customer ID').fill('not-an-email');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('alert')).toHaveText('Enter an email address or a seven-character Customer ID.');
    await expect(page.locator('#gb-recovered-username')).toHaveCount(0);

    await page.route('**/api/bank/customer-id/lookup', route => route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Customer not found' }),
    }));
    await page.getByRole('button', { name: 'Username' }).click();
    await page.getByLabel('Email or Customer ID').fill('ABC1234');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.getByRole('status')).toHaveText(
      'If the details match an account, a verification code was sent to its email.',
    );
    await expect(page.locator('#gb-recovered-username')).toHaveCount(0);
    await page.getByLabel('Recovery code').fill('123456');
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'No code request is active. Enter your email or Customer ID and request a new code.',
    );
  });

  test('shows username and password validation errors without calling Clerk', async ({ page }) => {
    for (const viewport of authViewports) {
      await page.setViewportSize(viewport);
      await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });

      const submit = page.getByRole('button', { name: 'Sign in' });
      const username = page.locator('#gb-signin-username');
      await expect(username).toBeVisible();
      await expect(username).toHaveAttribute('required', '');
      await expect(page.locator('#gb-signin-password')).toHaveAttribute('required', '');
      await expect(page.locator('#gb-signup-first-name, #gb-signup-last-name, #gb-signup-phone, #gb-signup-country, #gb-signup-dob, [data-testid="checkbox-signup-terms"]')).toHaveCount(0);

      await submit.click();
      await expect(page.getByRole('alert')).toHaveText('Enter your username.');
      await expect(username).toHaveAttribute('aria-invalid', 'true');
      await expectNoAuthLayoutOverlap(page, `Missing username at ${viewport.width}px`);
      await expectNoHorizontalOverflow(page, `Missing username at ${viewport.width}px`);

      await username.fill('abc');
      await submit.click();
      const minLength = Number(await username.getAttribute('minlength'));
      const maxLength = Number(await username.getAttribute('maxlength'));
      await expect(username).toHaveAttribute('minlength', String(minLength));
      await expect(username).toHaveAttribute('maxlength', String(maxLength));
      await expect(page.getByRole('alert')).toHaveText(
        `Username must be between ${minLength} and ${maxLength} characters.`,
      );

      await username.fill('u'.repeat(minLength));
      await submit.click();
      await expect(page.getByRole('alert')).toHaveText('Enter your password.');
      await expect(page.locator('#gb-signin-password')).toHaveAttribute('aria-invalid', 'true');
      await expectNoAuthLayoutOverlap(page, `Missing password at ${viewport.width}px`);
      await expectNoHorizontalOverflow(page, `Missing password at ${viewport.width}px`);
    }
  });
});

test.describe('optional sign-up details responsive layout', () => {
  const optionalFieldsMarkup = renderToStaticMarkup(
    createElement(SignupOptionalProfileFields, {
      values: {},
      onChange: () => undefined,
    }),
  );
  const authStyles = readFileSync(
    new URL('../src/components/auth-pages.css', import.meta.url),
    'utf8',
  );

  for (const viewport of authViewports) {
    test(`optional profile fields fit without overlap at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.setContent(`
        <main class="gb-auth-shell gb-auth-signup-shell">
          <aside class="gb-brand-panel"></aside>
          <section class="gb-form-side">
            <div class="gb-auth-content gb-signup-content">
              <div class="gb-signup-brand">Globus Bank</div>
              <div class="gb-signup-form-wrap">
                <div class="gb-form-heading gb-signup-heading">
                  <span class="gb-step-label">STEP 2 OF 2</span>
                  <h1>Optional profile details</h1>
                  <p>Add any details you want to share. You can skip every field.</p>
                </div>
                <form class="gb-auth-form gb-signup-form">
                  <div class="gb-signup-fields gb-signup-optional-fields">${optionalFieldsMarkup}</div>
                  <button class="gb-primary-button gb-signup-continue">Continue to email verification</button>
                  <button class="gb-optional-skip">Skip for now</button>
                </form>
              </div>
              <div class="gb-signup-footer">Secured by Clerk</div>
            </div>
          </section>
        </main>
      `);
      await page.addStyleTag({
        content: `*,*::before,*::after{box-sizing:border-box}body{margin:0}${authStyles}`,
      });

      await expect(page.getByRole('heading', { name: 'Optional profile details' })).toBeVisible();
      await expect(page.locator('.gb-signup-optional-fields .gb-field-label')).toHaveText([
        'Country of origin',
        'City of origin',
        'Date of birth',
        'Occupation / employment status',
        'Phone number',
      ]);
      for (const field of [
        'input-signup-country',
        'input-signup-city',
        'input-signup-date-of-birth',
        'input-signup-occupation',
        'input-signup-phone',
      ]) {
        await expect(page.getByTestId(field)).not.toHaveAttribute('required', '');
      }
      await expect(page.getByRole('button', { name: 'Continue to email verification' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible();
      await expectNoAuthLayoutOverlap(page, `Optional sign-up step at ${viewport.width}px`);
      await expectNoHorizontalOverflow(page, `Optional sign-up step at ${viewport.width}px`);
    });
  }
});

test.describe('signed-in member pages at phone widths', () => {
  if (validAuthenticatedState) {
    test.use({ storageState: validAuthenticatedState });
  }

  test.skip(
    !validAuthenticatedState,
    'Set GLOBUS_VIEWPORT_STORAGE_STATE to a valid Playwright storage-state file to run signed-in viewport checks.',
  );

  const memberPaths = [
    '/dashboard',
    '/home',
    '/wallets',
    '/transactions',
    '/send',
    '/receive',
    '/add-money',
    '/private-vault',
    '/calculator',
    '/withdraw',
    '/profile',
    '/settings',
  ];

  for (const width of memberViewportWidths) {
    test(`all member pages fit at ${width}px`, async ({ page }) => {
      for (const path of memberPaths) {
        if (path === '/withdraw') {
          await page.route('**/bank/saved-payment-methods', async (route) => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
          });
        }
        await page.setViewportSize({ width, height: 850 });
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        if (path === '/home') {
          await expect(page.locator('.public-viewport-scroll')).toBeVisible();
        } else {
          await expect(page.locator('.app-shell')).toBeVisible();
        }
        await expectNoHorizontalOverflow(page, `Signed-in member page at ${width}px (${path})`);
        const documentHeight = await page.evaluate(() => ({
          viewport: window.innerHeight,
          document: document.documentElement.scrollHeight,
        }));
        expect(
          documentHeight.document,
          `Member page at ${width}px (${path}) should keep scrolling inside its content panel`,
        ).toBeLessThanOrEqual(documentHeight.viewport + 1);
        if (path === '/add-money') {
          await expect(page).toHaveURL(/\/private-vault$/);
          await expect(page.getByTestId('private-vault-panel')).toBeVisible();
          await expect(page.getByTestId('deposit-workflow')).toHaveCount(0);
        }
        if (path === '/dashboard') {
          await expect(page.getByTestId('dashboard-account-tier-badge')).toBeVisible();
          await expect(page.getByText('Your details, in order')).toHaveCount(0);
        }
        if (path === '/profile') {
          await expect(page.getByText('Member since', { exact: true })).toHaveCount(0);
          await expect(page.getByTestId('profile-account-tier-badge')).toBeVisible();
        }
        if (path === '/private-vault') {
          await expect(page.getByTestId('private-vault-panel')).toBeVisible();
          await expect(page.getByTestId('vault-subscription-card')).toBeVisible();
          const fundingForm = page.getByTestId('vault-wallet-funding');
          if (await fundingForm.isVisible()) {
            await expect(page.getByTestId('input-funding-description')).toBeVisible();
            await expect(page.getByTestId('input-funding-amount')).not.toHaveAttribute('max');
          }
          const workspaceMenu = page.getByTestId('button-vault-navigation');
          if (await workspaceMenu.isVisible()) {
            await workspaceMenu.click();
            const drawer = page.getByTestId('vault-workspace-drawer');
            await expect(drawer).toBeVisible();
            await expect(drawer.getByRole('navigation', { name: 'Vault workspace sections' })).toBeVisible();
            await expectNoHorizontalOverflow(page, `Vault workspace drawer at ${width}px`);
            await drawer.getByRole('link', { name: 'Wallet policies' }).click();
            await expect(page.locator('#vault-workspace-wallets')).toBeInViewport();
            await expect(drawer).toHaveCount(0);
          }
        }
        if (path === '/withdraw') {
          await expect(page.getByTestId('withdrawal-workflow')).toBeVisible();
          await expect(page.getByTestId('withdrawal-wallet-picker')).toBeVisible();
          const firstWallet = page.locator('[data-testid^="button-select-withdrawal-wallet-"]').first();
          if (await firstWallet.count()) {
            await firstWallet.click();
            await expect(page.getByTestId('withdrawal-wallet-details')).toBeVisible();
            await expect(page.getByTestId('button-withdrawal-bank-card')).toBeVisible();
            await page.getByTestId('button-withdrawal-bank-card').click();
            await expect(page.getByTestId('withdrawal-destination-form')).toBeVisible();
          }
        }
        if (path === '/calculator') {
          await expect(page.getByTestId('currency-calculator')).toBeVisible();
          await expect(page.getByTestId('select-source-currency')).toBeVisible();
          await expect(page.getByTestId('select-destination-currency')).toBeVisible();
          await expect(page.getByTestId('input-conversion-amount')).toBeVisible();
        }
        if (path === '/dashboard') {
          const toolbar = page.getByTestId('dashboard-bottom-toolbar');
          const quickActions = page.getByTestId('dashboard-action-toolbar');
          await expect(toolbar).toBeVisible();
          await expect(page.getByText('Your details, in order')).toHaveCount(0);
          await expect(quickActions.locator('[data-testid^="dashboard-quick-"]')).toHaveCount(5);
          await expect(quickActions.getByTestId('dashboard-quick-profile')).toHaveAttribute('href', '/profile');
          const columnCount = await quickActions.locator('[role="toolbar"]').evaluate(element =>
            getComputedStyle(element).gridTemplateColumns.split(' ').length,
          );
          const expectedColumns = width < 640 ? 2 : width < 1280 ? 3 : 5;
          expect(columnCount, 'Dashboard quick actions should fit the viewport').toBe(expectedColumns);
          await expect(page.getByTestId('dashboard-header-greeting')).toBeVisible();
          await page.getByTestId('link-header-profile').click();
          await expect(page).toHaveURL(/\/profile$/);
          await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
          await page.getByTestId('profile-tab-button-details').click();
          await expect(page.getByTestId('profile-details-readonly')).toBeVisible();
          await page.getByTestId('link-app-home').click();
          await expect(page).toHaveURL(/\/home$/);
          await expect(page.locator('.public-viewport-scroll')).toBeVisible();
          await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
        }
      }
    });
  }

  test('member access statuses and reasoned controls render and submit', async ({ page }) => {
    let submitted: Record<string, unknown> | null = null;
    let testingModeDisabled = false;
    let transferAccessGranted = false;
    const member = {
      id: 'viewport-member',
      email: 'viewport-member@example.test',
      customerId: 'ABC1234',
      firstName: 'Viewport',
      lastName: 'Member',
      country: 'US',
      verificationStatus: 'approved',
      verificationNote: null,
      accountStatus: 'active',
      accountRestrictionReason: null,
      accountRestrictionNotes: null,
      accountRestrictedAt: null,
      profileSetupCompletedAt: '2026-11-19T10:00:00.000Z',
      testingModeDisabled,
      transferAccessGranted,
      vaultSubscriptionStatus: 'inactive',
      vaultSubscriptionRequestedAt: null,
      vaultSubscriptionExpiresAt: null,
      vaultSubscriptionReason: null,
      vaultSubscriptionPlan: null,
      vaultSubscriptionAmountMinor: null,
      vaultSubscriptionAutoRenew: false,
      walletCount: 1,
      createdAt: '2026-11-18T10:00:00.000Z',
    };
    await page.route('**/api/bank/admin/**', async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith('/access')) {
        await route.fulfill({ json: { allowed: true, roles: ['operations'] } });
      } else if (pathname.endsWith('/access-controls') && request.method() === 'PATCH') {
        submitted = request.postDataJSON() as Record<string, unknown>;
        testingModeDisabled = submitted.testingModeDisabled === true;
        transferAccessGranted = submitted.transferAccessGranted === true;
        await route.fulfill({
          json: { userId: member.id, testingModeDisabled, transferAccessGranted },
        });
      } else if (pathname.endsWith('/users/viewport-member')) {
        await route.fulfill({
          json: {
            user: { ...member, testingModeDisabled, transferAccessGranted },
            phone: null,
            dateOfBirth: null,
            profileSetupCompletedAt: member.profileSetupCompletedAt,
            transactionPinConfigured: true,
            transactionCount: 0,
            wallets: [],
            transactions: [],
            administrativeHistory: [],
          },
        });
      } else if (pathname.endsWith('/users')) {
        await route.fulfill({
          json: {
            items: [{ ...member, testingModeDisabled, transferAccessGranted }],
            total: 1,
            page: 1,
            pageSize: 25,
          },
        });
      } else if (pathname.endsWith('/summary')) {
        await route.fulfill({
          json: {
            registeredUsers: 1,
            activeAccounts: 1,
            restrictedAccounts: 0,
            suspendedAccounts: 0,
            pendingOperations: 2,
            ledgerTransactions: 1,
            creditsByCurrency: [],
            debitsByCurrency: [],
            recentActions: [],
          },
        });
      } else if (pathname.endsWith('/transactions')) {
        await route.fulfill({
          json: {
            items: [{
              id: 'viewport-transaction',
              reference: 'TX-VIEWPORT',
              type: 'admin_funding',
              status: 'completed',
              currency: 'USD',
              amount: '25.00',
              fee: '0.00',
              counterparty: 'Viewport Member',
              description: 'Internal wallet credit',
              mode: 'internal_ledger',
              createdAt: '2026-11-19T10:00:00.000Z',
            }],
            total: 1,
            page: 1,
            pageSize: 4,
          },
        });
      } else {
        await route.fulfill({ json: [] });
      }
    });

    await page.setViewportSize({ width: 390, height: 850 });
    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('admin-metric-total-members')).toContainText('1');
    await expect(page.getByTestId('admin-metric-pending-operations')).toContainText('2');
    await expect(page.getByTestId('recent-ledger-viewport-transaction')).toContainText('TX-VIEWPORT');
    await expect(page.getByTestId('link-open-admin-funding')).toHaveAttribute('href', '/admin/funding');
    const row = page.locator('tr').filter({ hasText: 'viewport-member@example.test' });
    await expect(row).toBeVisible();
    await expect(page.getByTestId('member-profile-setup-viewport-member')).toContainText('Complete');
    await expect(row).toContainText('On');
    await expect(row).toContainText('Not granted');
    await row.getByRole('link', { name: 'Open record' }).click();
    await expect(page).toHaveURL(/\/admin\/users\/viewport-member$/);
    await expect(page.getByText('Profile setup')).toBeVisible();
    await expect(page.getByTestId('admin-access-control-form')).toBeVisible();

    await page.getByTestId('checkbox-testing-mode-disabled').check();
    await page.getByTestId('checkbox-transfer-access-granted').check();
    await page.getByLabel('Reason for this change').fill('Approved transfer access for this customer.');
    await page.getByLabel('Your six-digit transaction PIN').fill('482731');
    await page.getByTestId('checkbox-access-controls-confirmed').check();
    await page.getByRole('button', { name: 'Save access controls' }).click();
    await expect.poll(() => submitted).toMatchObject({
      testingModeDisabled: true,
      transferAccessGranted: true,
      reason: 'Approved transfer access for this customer.',
      transactionPin: '482731',
      confirmed: true,
    });
    await expect(page.getByRole('status')).toContainText('saved and recorded');
  });
});

test.describe('Private Vault workspace at phone, tablet, and desktop widths', () => {
  if (validAuthenticatedState) {
    test.use({ storageState: validAuthenticatedState });
  }

  test.skip(
    !validAuthenticatedState,
    'Set GLOBUS_VIEWPORT_STORAGE_STATE to a valid Playwright storage-state file to run signed-in Vault checks.',
  );

  for (const width of [320, 360, 390, 768, 1280]) {
    test(`Vault navigation and receipt preferences fit at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 850 });
      await page.goto('/private-vault', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.app-shell')).toBeVisible();
      await expect(page.getByTestId('private-vault-panel')).toBeVisible();
      await expect(page.getByTestId('vault-subscription-card')).toBeVisible();
      await expect(page.getByTestId('vault-receipt-preferences')).toBeVisible();
      await expect(page.locator('[data-testid^="button-receipt-layout-"]')).toHaveCount(5);
      await expect(page.getByTestId('button-preview-selected-receipt')).toBeEnabled();
      await expect(page.getByTestId('button-save-receipt-preference')).toBeDisabled();
      await page.getByTestId('button-preview-selected-receipt').click();
      const preview = page.getByRole('dialog');
      await expect(preview).toBeVisible();
      await expect(preview.getByText('Illustrative preview only. This sample is not a real transaction; exports and printing are disabled.')).toBeVisible();
      for (const testId of ['button-save-receipt-png', 'button-download-receipt-pdf', 'button-print-receipt']) {
        await expect(preview.getByTestId(testId)).toBeDisabled();
      }
      await expectNoHorizontalOverflow(page, `Vault receipt preview at ${width}px`);
      const previewBounds = await preview.boundingBox();
      expect(previewBounds, `Receipt preview should be measurable at ${width}px`).not.toBeNull();
      expect(previewBounds!.x).toBeGreaterThanOrEqual(0);
      expect(previewBounds!.x + previewBounds!.width).toBeLessThanOrEqual(width + 1);
      const actionBounds = await preview.locator('.receipt-actions button').evaluateAll((buttons) =>
        buttons.map((button) => {
          const { x, y, width: buttonWidth, height } = button.getBoundingClientRect();
          return { x, y, width: buttonWidth, height };
        }),
      );
      for (let first = 0; first < actionBounds.length; first += 1) {
        for (let second = first + 1; second < actionBounds.length; second += 1) {
          const a = actionBounds[first];
          const b = actionBounds[second];
          const overlaps = a.x < b.x + b.width && a.x + a.width > b.x &&
            a.y < b.y + b.height && a.y + a.height > b.y;
          expect(overlaps, `Receipt action buttons overlap at ${width}px`).toBe(false);
        }
      }
      await preview.getByRole('button', { name: 'Close receipt' }).click();

      if (width < 1024) {
        await page.getByTestId('button-vault-navigation').click();
        await expect(page.getByRole('dialog', { name: 'Vault workspace' })).toBeVisible();
        await page.getByRole('dialog').getByRole('button', { name: 'Receipt style' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
      } else {
        await expect(page.getByRole('navigation', { name: 'Vault workspace navigation' }).first()).toBeVisible();
      }

      await expectNoHorizontalOverflow(page, `Private Vault workspace at ${width}px`);
    });
  }
});

test.describe('admin pages and wide tables at phone widths', () => {
  if (validAuthenticatedState) {
    test.use({ storageState: validAuthenticatedState });
  }

  test.skip(
    !validAuthenticatedState,
    'Set GLOBUS_VIEWPORT_STORAGE_STATE to a valid Playwright storage-state file to run admin viewport checks.',
  );

  for (const width of viewportWidths) {
    test(`admin view fits and confines wide-table scrolling at ${width}px`, async ({ page }) => {
      await page.route('**/api/bank/admin/**', async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname.endsWith('/access')) {
          await route.fulfill({ json: { allowed: true, roles: ['operations'] } });
        } else if (pathname.endsWith('/summary')) {
          await route.fulfill({
            json: {
              registeredUsers: 1,
              activeWallets: 1,
              pendingLedgerRequests: 0,
              ledgerTransactions: 0,
            },
          });
        } else if (pathname.endsWith('/users')) {
          await route.fulfill({
            json: [
              {
                id: 'viewport-member',
                email: 'viewport-member@example.test',
                firstName: 'Viewport',
                lastName: 'Member',
                country: 'US',
                verificationStatus: 'approved',
                verificationNote: null,
                accountStatus: 'active',
                walletCount: 1,
              },
            ],
          });
        } else {
          await route.fulfill({ json: [] });
        }
      });

      await page.setViewportSize({ width, height: 850 });
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await expect(
        page.locator('main h1').filter({ hasText: 'Operations overview' }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page, `Admin page at ${width}px`);

      const wideTableContainers = await page.locator('table').evaluateAll((tables) =>
        tables
          .filter((table) => table.scrollWidth > table.clientWidth)
          .map((table) => {
            let container = table.parentElement;
            while (container) {
              const overflowX = window.getComputedStyle(container).overflowX;
              if (overflowX === 'auto' || overflowX === 'scroll') break;
              container = container.parentElement;
            }
            return container
              ? {
                  containerScrollWidth: container.scrollWidth,
                  containerClientWidth: container.clientWidth,
                  overflowX: window.getComputedStyle(container).overflowX,
                }
              : null;
          }),
      );

      expect(wideTableContainers.length, 'The admin fixture should render a wide member table').toBeGreaterThan(0);
      expect(wideTableContainers.every(Boolean), 'Every wide table must have its own scroll container').toBe(true);
      expect(
        wideTableContainers.every(
          (container) =>
            container!.overflowX === 'auto' &&
            container!.containerScrollWidth > container!.containerClientWidth,
        ),
        'Wide tables should scroll within their own containers',
      ).toBe(true);
    });
  }

  test('member directory and detail show access state and require reasoned confirmation', async ({ page }) => {
    let savedPayload: Record<string, unknown> | null = null;
    let testingModeDisabled = false;
    let transferAccessGranted = false;
    const member = {
      id: 'viewport-member',
      email: 'viewport-member@example.test',
      accountTierName: 'Standard 🏦',
      customerId: 'ABC1234',
      firstName: 'Viewport',
      lastName: 'Member',
      country: 'US',
      verificationStatus: 'approved',
      verificationNote: null,
      accountStatus: 'active',
      accountRestrictionReason: null,
      accountRestrictionNotes: null,
      accountRestrictedAt: null,
      profileSetupCompletedAt: '2026-11-19T10:00:00.000Z',
      testingModeDisabled,
      transferAccessGranted,
      vaultSubscriptionStatus: 'inactive',
      vaultSubscriptionRequestedAt: null,
      vaultSubscriptionExpiresAt: null,
      vaultSubscriptionReason: null,
      vaultSubscriptionPlan: null,
      vaultSubscriptionAmountMinor: null,
      vaultSubscriptionAutoRenew: false,
      walletCount: 1,
      createdAt: '2026-11-18T10:00:00.000Z',
    };
    const detail = () => ({
      user: { ...member, testingModeDisabled, transferAccessGranted },
      phone: null,
      dateOfBirth: null,
      cityOfOrigin: null,
      occupation: null,
      profileSetupCompletedAt: member.profileSetupCompletedAt,
      testingModeDisabled,
      transferAccessGranted,
      transactionPinConfigured: true,
      transactionCount: 0,
      wallets: [],
      transactions: [],
      administrativeHistory: [],
    });

    await page.route('**/api/bank/admin/**', async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith('/access')) {
        await route.fulfill({ json: { allowed: true, roles: ['operations'] } });
      } else if (pathname.endsWith('/access-controls') && request.method() === 'PATCH') {
        savedPayload = request.postDataJSON() as Record<string, unknown>;
        testingModeDisabled = savedPayload.testingModeDisabled === true;
        transferAccessGranted = savedPayload.transferAccessGranted === true;
        await route.fulfill({
          json: {
            userId: member.id,
            testingModeDisabled,
            transferAccessGranted,
          },
        });
      } else if (pathname.endsWith('/users/viewport-member')) {
        await route.fulfill({ json: detail() });
      } else if (pathname.endsWith('/users')) {
        await route.fulfill({
          json: { items: [{ ...member, testingModeDisabled, transferAccessGranted }], total: 1, page: 1, pageSize: 25 },
        });
      } else {
        await route.fulfill({ json: [] });
      }
    });

    await page.setViewportSize({ width: 390, height: 850 });
    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
    const row = page.locator('tr').filter({ hasText: 'viewport-member@example.test' });
    await expect(row).toBeVisible();
    await expect(page.getByTestId('member-profile-setup-viewport-member')).toContainText('Complete');
    await expect(row).toContainText('On');
    await expect(row).toContainText('Not granted');
    await row.getByRole('link', { name: 'Open' }).click();

    await expect(page).toHaveURL(/\/admin\/users\/viewport-member$/);
    await expect(page.getByText('Profile setup')).toBeVisible();
    await expect(page.getByTestId('admin-access-control-form')).toBeVisible();
    await expect(page.getByTestId('checkbox-testing-mode-disabled')).not.toBeChecked();
    await expect(page.getByTestId('checkbox-transfer-access-granted')).not.toBeChecked();
    await expect(page.getByTestId('input-access-control-reason')).toHaveAttribute('required', '');

    await page.getByTestId('checkbox-testing-mode-disabled').check();
    await page.getByTestId('checkbox-transfer-access-granted').check();
    await page.getByLabel('Reason for this change').fill('Approved transfer access for this customer.');
    await page.getByLabel('Your six-digit transaction PIN').fill('482731');
    await page.getByTestId('checkbox-access-controls-confirmed').check();
    await page.getByRole('button', { name: 'Save access controls' }).click();

    await expect.poll(() => savedPayload).toMatchObject({
      testingModeDisabled: true,
      transferAccessGranted: true,
      reason: 'Approved transfer access for this customer.',
      transactionPin: '482731',
      confirmed: true,
    });
    await expect(page.getByRole('status')).toContainText('saved and recorded');
  });
});
