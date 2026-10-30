# Playlist store: deploy steps

The playlist store is a Google Sheet plus a small Apps Script web app, both in the
school Google account. It holds only playlist codes, who picks, and each program's
settings. No names, scores, or history.

This takes about 10 minutes, once.

## 1. Make the Sheet

1. Signed in to your **school** Google account, go to <https://sheets.new>.
2. Name it **ASD Programs playlists**.

## 2. Add the script

1. In the Sheet, open **Extensions › Apps Script**.
2. Delete what's in `Code.gs`, then paste in all of [`Code.gs`](Code.gs) from this folder.
3. Click **Save** (the disk icon). Name the project **ASD Programs playlists**.
4. In the function menu next to **Run**, pick `setup`, then click **Run**.
   Google asks you to authorize it. Click **Review permissions**, pick your school account,
   and allow it. (It only asks to use this one spreadsheet.) A tab called **Playlists** appears in the Sheet.

## 3. Set the staff passcode

1. In Apps Script, click **Project Settings** (the gear on the left).
2. Under **Script Properties**, click **Add script property**.
3. Property: `STAFF_PASSCODE`. Value: the passcode staff will use. Click **Save script properties**.

To change the passcode later, edit this value. Nothing else changes, and nothing needs redeploying.

## 4. Deploy the web app

1. Click **Deploy › New deployment**.
2. Click the gear next to **Select type** and pick **Web app**.
3. Description: `Playlists`. **Execute as: Me**. **Who has access: Anyone**.
4. Click **Deploy**, and copy the **Web app URL** (it ends in `/exec`).

To check it, open the URL in a browser. You should see
`{"ok":true,"service":"ASD Programs playlists"}`.

## 5. Point the site at it

Open [`shared/config.js`](../shared/config.js) and paste the URL in:

```js
window.ASD_CONFIG = {
  storeUrl: "https://script.google.com/macros/s/.../exec"
};
```

Commit the change. (Or send the URL to Claude and it will make the change.) The demo
banner goes away, and playlists now save to the Sheet.

## Updating the script later

If `Code.gs` changes, paste the new version, then **Deploy › Manage deployments ›
(pencil) Edit › Version: New version › Deploy**. This keeps the same URL.
Using **New deployment** instead makes a new URL, and `config.js` would need it.

## What's in the Sheet

One row per playlist: the code (e.g. `B7`), the playlist as text, and when it was last
saved. You can read it, but edit playlists in the builder, not the Sheet, so the format
stays right. Deleting a row deletes that playlist.
