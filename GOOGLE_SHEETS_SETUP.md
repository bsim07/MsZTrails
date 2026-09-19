# Connect Fraction Trails to Google Sheets

The game stays on GitHub Pages. A Google Apps Script web app writes to a private Google Sheet. No database or paid server is required. This implementation uses one class per deployment/Sheet; use a separate copy for another class.

## 1. Create the private results Sheet

1. In the Google account that will own the class results, create a blank Google Sheet named **Fraction Trails – Class Progress**.
2. Keep its sharing setting **Restricted**. Do not publish the Sheet or share it with students.
3. In the Sheet, choose **Extensions → Apps Script**.
4. Replace the contents of `Code.gs` with the repository file [`google-apps-script/Code.gs`](google-apps-script/Code.gs). Save the project as **Fraction Trails**.
5. Select **setupFractionTrails** in the function dropdown and click **Run**. Authorize your own script to access the spreadsheet when Google asks.
6. Return to the Sheet. It now has **Progress** and **Connection** tabs. Connection contains a generated **class code** and **teacher access key**. Keep the key private. Re-running setup preserves both credentials and existing data.

The script stores the working credentials in Script Properties. Editing their displayed copies on the Connection tab does not change them. To rotate credentials, update `CLASS_CODE` or `TEACHER_KEY` in Apps Script's Project Settings → Script Properties, then re-run setup to refresh the displayed copies.

## 2. Deploy the script

1. In Apps Script, choose **Deploy → New deployment**.
2. Select **Web app**.
3. Set **Execute as: Me** (the owner).
4. Set **Who has access: Anyone**. The students do not need Google accounts; the server checks the class code, and reading results additionally requires the teacher key.
5. Deploy and copy the **Web app URL** ending in `/exec`, not the editor/test URL ending in `/dev`.
6. Open that URL in a private/incognito window. A working deployment shows a small JSON message containing `"service":"Fraction Trails"`. It must not ask the student to sign in.

If a school Google Workspace account does not offer **Anyone**, its administrator may restrict public web apps. The current GitHub-to-Apps-Script connection needs that access setting; do not work around school restrictions. Use an approved owner account or ask the administrator about permitted deployment options.

## 3. Connect the GitHub game

Edit [`cloud-config.js`](cloud-config.js):

```javascript
window.FRACTION_TRAILS_CONFIG = {
  sheetsUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
};
```

This endpoint URL can be public. **Never put the teacher key in the repository, game URL, or this config file.** Leave `sheetsUrl` empty to keep the original local-only game/dashboard behavior.

Publish the updated game files to the existing GitHub Pages site. Include the three `cloud-*.js` files, updated `game.js`, `index.html`, `styles.css`, and `sw.js`. The cache version has been advanced to v6. The Apps Script source in this repo is only a template; Google runs the copy deployed in your account.

## 4. Use it in class

- **Student:** open the normal game URL, enter first name, class code, and the student ID/roll number assigned by the teacher. Use the same ID on later visits. An optional `?class=FT-…` on the game URL pre-fills the class code.
- **Teacher:** open the game URL with `?teacher=dashboard` (for example, `https://YOUR-NAME.github.io/YOUR-REPO/?teacher=dashboard`). Enter the class code and teacher key from the private Sheet.
- The dashboard refreshes every 30 seconds while visible and has a manual refresh button. **Lock dashboard** clears the displayed results and credentials from the page. Reloading also requires the key again.
- Student updates are sent at start, after wild answers/catches, after completed trainer challenges, on level changes, after the boss result, and when editing the exit reflection. Changes close together are combined before sending.
- **Synced with your teacher** appears only after a matching server acknowledgement. Offline/failed updates remain queued on that browser and retry while the game is open or when reopened online. Students should leave the game open until it confirms sync. A Retry sync button is available.
- The cloud dashboard shows the latest session per student ID. Each session has its own row in the Sheet; earlier sessions remain available there. Reloading the game starts a new session rather than resuming gameplay.
- Teacher keys are kept only in the dashboard tab's memory. Student queues use browser localStorage. On shared computers, treat that browser as containing student results; browser-data removal before sync loses unsent results.

## 5. Verify the actual deployment before a lesson

Local automated tests use a simulated Apps Script endpoint; they cannot prove your Google account permissions, Google's response redirects/CORS behavior, school network policy, or GitHub deployment.

1. Open the published game in one browser/device and the dashboard in another. Do not rely on two tabs sharing localStorage.
2. Start as student `TEST-01`. Confirm a row appears in Progress and then the teacher dashboard.
3. Complete a question, reflection, and catch. Check the received time and counts update **the same session row**.
4. Disconnect the student device from the internet, catch another creature, then reconnect. Confirm it changes from offline/waiting to synced and the latest counts reach the dashboard.
5. Try an incorrect teacher key. It must show an error and no class results.
6. Lock the dashboard, reconnect, and confirm results load again. Remove test rows directly from the private Sheet after testing and after those test sessions have stopped sending.

If the game cannot read Google's acknowledgement, it deliberately keeps the update queued. Do not replace the request with `mode: 'no-cors'`: an unreadable response cannot confirm a save. Verify **owner / Anyone / /exec**, the deployment version, and the browser network error first.

## What the columns mean

Progress contains class/student/session IDs, revision, first receipt and latest receipt times, name, level, caught counts, round progress, badges, streak, boss score, correct records, wrong attempts, hints, reflection, and full validated JSON for dashboard detail. Timestamps are server receipt times; they are not proof the student is currently playing.

The app's existing assessment model retains the latest record per wild question. Correct records include eventual correctness and trainer rewards, not first-attempt accuracy. Rematches replace an earlier record. Full trainer answer history is not stored. Boss scores update at completion. Student identity and results are self-reported, appropriate for classroom practice rather than verified examination records.

Concurrent saves use a script lock. Session IDs plus increasing revisions prevent duplicate rows and prevent late retries overwriting newer snapshots. Latest-session selection uses the server's first receipt time; a session played entirely offline is first known to the server when it eventually uploads. Requests are validated and student text is escaped before HTML display and protected against Sheet formula interpretation.

The cloud dashboard does not expose bulk deletion. To archive a term, copy the Sheet; manage rows in the private Sheet with normal Google permissions. Keep the Progress tab name and header layout intact. Avoid editing the Payload JSON column. Apps Script has service quotas, so this is intended for classroom use, not a large public service.

## Updating the server later

After editing Apps Script code, use **Deploy → Manage deployments → Edit → New version → Deploy**. Updating the existing deployment preserves its `/exec` URL. Saving code alone does not update the deployed version.

Local checks:

```text
npm.cmd ci
node tools/verify_cloud.js
node tools/verify_cloud_browser.js
```

Browser checks use installed Google Chrome through Playwright. The existing art/landing checks can also run with `channel: 'chrome'` as documented in PROJECT_TAKEOVER.md.

Official references: [Apps Script web apps and deployment](https://developers.google.com/apps-script/guides/web), [Content Service and redirects](https://developers.google.com/apps-script/guides/content), [LockService](https://developers.google.com/apps-script/reference/lock/lock-service).
