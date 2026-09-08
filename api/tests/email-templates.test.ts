import { describe, it, expect } from 'vitest';
import { renderEmail, type EmailContent, type TemplateName } from '../src/lib/email-templates.js';

const base: EmailContent = {
  subject: 'Subject',
  preheader: 'Preheader',
  hero: 'code',
  codeLabel: 'One-time code',
  code: '123456',
  codeCaption: 'Expires in 10 min',
  heading: 'Heading',
  intro: 'Intro line.',
  specs: [
    { label: 'Valid for', value: '10 minutes' },
    { label: 'Uses', value: 'once' },
  ],
  note: 'A closing note.',
};

const invite: EmailContent = {
  ...base,
  hero: 'invite',
  orgName: 'Acme Engineering',
  role: 'admin',
  code: 'k3Jm9QpZ2xW7bR1nT5vY8cH4dL6sA0gF2eU9iO3pK1w',
  paragraphs: ['A paragraph.'],
};

const NAMES: TemplateName[] = ['otp', 'verify', 'recovery', 'invitation'];

describe('email templates', () => {
  it.each(NAMES)('renders %s with no placeholders left behind', (name) => {
    const html = renderEmail(name, name === 'invitation' ? invite : base);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Heading');
    // An unresolved {{token}} means a template and its data have drifted apart.
    expect(html).not.toMatch(/\{\{/);
  });

  it('leads with the code, before the heading', () => {
    const html = renderEmail('verify', { ...base, code: '944261' });
    // Hierarchy is the point of this layout: the reason the email was opened
    // has to come before the prose explaining it.
    expect(html.indexOf('One-time code')).toBeLessThan(html.indexOf('Heading'));
  });

  it('renders the code as one contiguous string, not per-digit cells', () => {
    const html = renderEmail('verify', { ...base, code: '944261' });
    // Selecting across table cells drags tab characters into the paste, which
    // breaks the one thing this code is for.
    expect(html).toContain('>944261<');
  });

  it('renders spec rows as label/value pairs', () => {
    const html = renderEmail('otp', base);
    expect(html).toContain('Valid for');
    expect(html).toContain('10 minutes');
    expect(html).toContain('Uses');
  });

  it('leads an invitation with the org and role, token beneath', () => {
    const html = renderEmail('invitation', invite);
    expect(html.indexOf('Acme Engineering')).toBeLessThan(html.indexOf(invite.code!));
    expect(html).toContain('admin');
    expect(html).toContain(invite.code!);
  });

  it('escapes interpolated values so user input cannot inject markup', () => {
    const html = renderEmail('invitation', {
      ...invite,
      orgName: 'Acme <img src=x onerror="alert(1)">',
    });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('neutralises braces so escaped values cannot reach a placeholder pass', () => {
    const html = renderEmail('invitation', { ...invite, orgName: '{{code}}' });
    expect(html).toContain('&#123;&#123;code}}');
    expect(html).not.toMatch(/>\s*S3CRET/);
  });

  it('omits optional blocks that were not supplied', () => {
    const html = renderEmail('otp', {
      subject: 'S',
      preheader: 'P',
      hero: 'code',
      codeLabel: 'L',
      code: '111111',
      codeCaption: 'soon',
      heading: 'H',
      intro: 'I',
    });
    expect(html).not.toContain('A closing note.');
    expect(html).not.toMatch(/\{\{/);
  });
});
