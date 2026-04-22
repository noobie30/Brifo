/**
 * Brifo Beta Form — Auto-Setup Script
 * ───────────────────────────────────────────────────────────────
 *
 * HOW TO RUN (one-time, ~60 seconds):
 *   1. Open https://script.google.com → click "New project"
 *   2. Delete the empty `function myFunction()` stub
 *   3. Paste THIS ENTIRE FILE into the Code.gs editor
 *   4. Rename the project (top-left) to "Brifo Beta Form Setup" — optional
 *   5. Save (Cmd+S / Ctrl+S)
 *   6. In the function picker (top toolbar), choose `setupBrifoBetaForm`
 *   7. Click ▶ Run
 *   8. When prompted: "Authorization required" → Review permissions → pick your Google
 *      account → click "Advanced" → "Go to Brifo Beta Form Setup (unsafe)" → "Allow"
 *      (This is normal. The script only modifies your own form. Source is above you.)
 *   9. Watch the Execution Log → you'll see "✅ Form setup complete" + the shareable URL
 *  10. Re-open your form in Google Forms — all 11 questions will be live
 *
 * IMPORTANT: This script WIPES every existing question on the form before
 * adding the 11 new ones. If you had any answers you wanted to keep, back
 * them up first (Responses tab → Download CSV).
 *
 * Re-running this script is safe — it'll wipe + rebuild every time.
 * ───────────────────────────────────────────────────────────────
 */

const FORM_ID = '1aN5AtLQMVWH6x8SMoaOxFgExZ-hUHv5E-lt4oNZ8_yY';

function setupBrifoBetaForm() {
  const form = FormApp.openById(FORM_ID);

  // ─── Title + description ───
  form.setTitle('Brifo Beta — Register Your Interest');
  form.setDescription(
    'Thanks for your interest in the Brifo beta 👋\n\n' +
    'Brifo is a macOS app that auto-writes your meeting notes and pushes action items into Jira — without a bot joining the call.\n\n' +
    'This takes 60 seconds. We\'ll email invites to the first cohort next week.'
  );

  // ─── Form-wide settings ───
  // Note: `setAcceptingResponses` and `setPublishedUrl` only work on PUBLISHED forms.
  // Google Forms' new UI requires you to click "Publish" (top-right) once before the
  // form is live. These settings are wrapped in try/catch so the script still succeeds
  // even if the form isn't published yet.
  form.setProgressBar(true);
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(false);
  try {
    form.setAcceptingResponses(true);
  } catch (e) {
    Logger.log('⚠️  Skipped setAcceptingResponses — form is not yet published. ' +
               'Click "Publish" in the top-right of your form after this script finishes.');
  }
  form.setConfirmationMessage(
    'You\'re on the list ✅\n\n' +
    'We\'ll email you from hello@brifo.in when your invite is ready. In the meantime, follow @brifo_app for launch updates.\n\n' +
    '— Team Brifo'
  );

  // ─── Wipe existing questions ───
  const existingItems = form.getItems();
  for (let i = existingItems.length - 1; i >= 0; i--) {
    form.deleteItem(existingItems[i]);
  }

  // ─── Q1. Full name ───
  form.addTextItem()
    .setTitle('Your name')
    .setHelpText('So we know what to call you in the invite email.')
    .setRequired(true);

  // ─── Q2. Work email ───
  const emailItem = form.addTextItem()
    .setTitle('Work email')
    .setHelpText('We\'ll send your beta invite here. Personal emails are fine too — work emails get priority access.')
    .setRequired(true);
  emailItem.setValidation(
    FormApp.createTextValidation()
      .setHelpText('Please enter a valid email address.')
      .requireTextMatchesPattern('^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$')
      .build()
  );

  // ─── Q3. Role ───
  const roleItem = form.addMultipleChoiceItem()
    .setTitle('What\'s your role?')
    .setHelpText('Pick the closest fit.')
    .setRequired(true);
  roleItem.setChoiceValues([
    'Product / Project Manager',
    'Engineer / Engineering Manager',
    'Founder / CEO / Operator',
    'Designer',
    'Sales / Customer Success',
    'Consultant / Agency'
  ]);
  roleItem.showOtherOption(true);

  // ─── Q4. Company name ───
  form.addTextItem()
    .setTitle('Where do you work?')
    .setHelpText('Company or team name. "Solo / freelance" is a valid answer.')
    .setRequired(true);

  // ─── Q5. Team size ───
  form.addMultipleChoiceItem()
    .setTitle('How big is your team?')
    .setRequired(true)
    .setChoiceValues([
      'Just me / solo',
      '2–10',
      '11–50',
      '51–200',
      '201–1,000',
      '1,000+'
    ]);

  // ─── Q6. Meetings per week ───
  form.addMultipleChoiceItem()
    .setTitle('Roughly how many work meetings do you attend per week?')
    .setRequired(true)
    .setChoiceValues([
      '0–5',
      '6–15',
      '16–25',
      '26+'
    ]);

  // ─── Q7. Jira usage ───
  form.addMultipleChoiceItem()
    .setTitle('Do you (or your team) use Jira?')
    .setRequired(true)
    .setChoiceValues([
      'Yes, daily',
      'Yes, occasionally',
      'No, we use something else (Linear, Asana, ClickUp, etc.)',
      'No, we don\'t use a task tracker'
    ]);

  // ─── Q8. Mobile number (optional) ───
  const mobileItem = form.addTextItem()
    .setTitle('Mobile number (optional)')
    .setHelpText('Only if you\'d like a quick call when we onboard your cohort. We won\'t use it for marketing.')
    .setRequired(false);
  mobileItem.setValidation(
    FormApp.createTextValidation()
      .setHelpText('Please enter a valid phone number.')
      .requireTextMatchesPattern('^[0-9+\\-\\s()]{7,20}$')
      .build()
  );

  // ─── Q9. Gender (optional) ───
  const genderItem = form.addMultipleChoiceItem()
    .setTitle('Gender (optional)')
    .setRequired(false);
  genderItem.setChoiceValues([
    'Woman',
    'Man',
    'Non-binary',
    'Prefer not to say'
  ]);
  genderItem.showOtherOption(true);  // "Prefer to self-describe"

  // ─── Q10. Anything we should know? ───
  form.addParagraphTextItem()
    .setTitle('Anything you\'d like us to know? (optional)')
    .setHelpText('What you\'re hoping Brifo will help with, what you\'ve tried before, anything useful.')
    .setRequired(false);

  // ─── Q11. Attribution ───
  const attrItem = form.addMultipleChoiceItem()
    .setTitle('How did you hear about us?')
    .setRequired(false);
  attrItem.setChoiceValues([
    'Instagram',
    'LinkedIn',
    'Twitter / X',
    'A friend or colleague',
    'Google / search',
    'Product Hunt'
  ]);
  attrItem.showOtherOption(true);

  // ─── Done ───
  Logger.log('✅ Form questions & settings applied successfully!');
  Logger.log('Editor URL:   https://docs.google.com/forms/d/' + FORM_ID + '/edit');
  try {
    const publicUrl = form.getPublishedUrl();
    Logger.log('Public URL:   ' + publicUrl);
    Logger.log('Short URL:    ' + form.shortenFormUrl(publicUrl));
    Logger.log('');
    Logger.log('Next: copy the Short URL and replace [GOOGLE FORM LINK] in:');
    Logger.log('  - marketing/instagram-beta-launch.md');
    Logger.log('  - marketing/linkedin-beta-launch.md');
  } catch (e) {
    Logger.log('');
    Logger.log('⚠️  Form is not yet published — public URLs unavailable.');
    Logger.log('To get your shareable link:');
    Logger.log('   1. Open https://docs.google.com/forms/d/' + FORM_ID + '/edit');
    Logger.log('   2. Click the blue "Publish" button in the top-right');
    Logger.log('   3. Click "Send" → copy the short link');
    Logger.log('');
    Logger.log('(Optional) Re-run this script after publishing to log URLs here.');
  }
}
