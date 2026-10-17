# StudyQuest — Android-friendly starter website

## What's included
- Premium responsive dashboard
- Focus timer with start, pause, and reset
- XP and levels
- Daily quests and custom missions
- Streaks and weekly focus chart
- Achievements and recent session history
- Browser-local saving (localStorage)
- Basic PWA manifest, icon, and service worker
- Mock tests with score, answer review, and XP rewards
- Long-form question and model-answer section
- Custom MCQ builder with correct answers and explanations

## Quick test on your phone
1. Extract this ZIP.
2. Open `index.html` in a browser if your file manager supports it. Some browser features such as offline installation require hosting over HTTPS.
3. Test the timer, quests, custom mission, and refresh the page to check that progress persists.

## Publish free with GitHub Pages
1. Sign in to GitHub and create a new public repository, e.g. `studyquest`.
2. Upload all four files from this folder: `index.html`, `manifest.json`, `sw.js`, `icon.svg`.
3. Open the repository's Settings → Pages.
4. Under Build and deployment, choose Deploy from a branch, select `main` and `/ (root)`, then Save.
5. Wait for GitHub Pages to publish the website. Open the published URL in Chrome on Android.
6. Use Chrome's menu → Add to Home screen / Install app if the option appears.

## Learning sections
- **Mock Test:** choose a subject and test length, submit, then review correct answers and explanations.
- **Long Q&A:** search sample exam-style questions and reveal model answers.
- **My Questions:** create MCQs with four options, select the correct answer, add an explanation, and run a custom test.
- Sample content is illustrative and not guaranteed to match a specific board syllabus.

## Important notes
- This first version saves progress only in the current browser on the current device. It does not yet sync across devices or include accounts, friends, or a real leaderboard.
- Clearing browser/site data can erase local progress. Avoid using a private/incognito tab for long-term progress.
- XP is a motivation feature, not proof of learning. Students should use the timer honestly.
- The service worker and PWA install behavior work best on HTTPS hosting.
