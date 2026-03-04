# Browser Extension Release Checklist

Use this checklist before publishing any DSG extension update.

## 1) Branch and versioning

- [ ] Start from latest stable baseline tag (`ext-v1.3.28`).
- [ ] Update `browser-extension/manifest.json` version (must be higher than current published).
- [ ] Keep one logical change per release when possible.

## 2) Required local validation

- [ ] `node --check browser-extension/content.js`
- [ ] `node --check browser-extension/background.js`
- [ ] `python3 -m json.tool browser-extension/manifest.json > /dev/null`

## 3) Regression matrix (must pass)

Test with **Super Admin** and **assigned User** roles:

- [ ] RMIS: username + password autofill, submit works.
- [ ] Ascend: username + password autofill, submit works.
- [ ] Zoho Assist: multi-step flow works (username page -> password page -> submit).

For each test:

- [ ] No credentials shown to user.
- [ ] Overlay behavior is correct.
- [ ] No stuck "processing" state.

## 4) User access checks

- [ ] Tool is assigned in `allowed_tools` for target user.
- [ ] User account is Active.
- [ ] User has extension installed in their own Chrome profile.
- [ ] Saved extension ID in Profile points to the correct installed extension.

## 5) Packaging

- [ ] Run one-click packager: `./scripts/build-extension-release.sh`
- [ ] Build root-level ZIP where `manifest.json` is at ZIP root (not nested).
- [ ] Verify ZIP can be extracted and loaded via `chrome://extensions` -> "Load unpacked".
- [ ] Confirm extension version shown in Chrome matches the new release.

## 6) Git release flow

- [ ] Commit code changes.
- [ ] Commit release ZIP (if sharing via repo artifact).
- [ ] Push branch.
- [ ] Create and push stable tag after validation:
  - `git tag -a ext-vX.Y.Z -m "Stable extension baseline vX.Y.Z"`
  - `git push origin ext-vX.Y.Z`

## 7) Post-release sanity

- [ ] Verify at least one real user machine after install/update.
- [ ] Clear old duplicate extension installs in Chrome if behavior is inconsistent.
- [ ] If portal still calls wrong extension, clear/re-save Extension ID in Profile.

