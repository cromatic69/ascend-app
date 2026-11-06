# Ascend (upload version)

This is the small version of the Ascend project, made for uploading to GitHub in a web browser.
It has about 50 files. The Android part is created automatically by the build robot, so you do not upload it.

## Get the APK

1. Make a free account at github.com, click **+** then **New repository**, name it `ascend-app`, click **Create repository**.
2. Click **uploading an existing file**. Open this folder on your computer, select everything inside it and drag it onto the page. Click **Commit changes**.
   If the `.github` folder is missing afterwards, click **Add file, Create new file**, type `.github/workflows/build-apk.yml` as the name, paste in the text of `BUILD-APK-WORKFLOW.yml` and commit.
3. Click **Actions**, then **Build Android APK**, then **Run workflow**.
4. After 5 to 10 minutes open the finished run, scroll to **Artifacts** and download **ascend-apk**. Unzip it for `app-debug.apk`.
5. Send it to your phone, tap it and allow **Install unknown apps**.

## Folders

- `www/`  the app (page, styles, logic, pictures, fonts)
- `tools/apply_branding.py`  adds the icon and splash screen to the Android project
- `.github/workflows/build-apk.yml`  the build robot
