# Live comparison and reference epoch

## Public Monkeytype fingerprint

Capture command:

```text
npm run audit:monkeytype-epoch
```

Observed:

```text
capturedAt: 2026-07-26T17:49:29.113Z
url: https://monkeytype.com/
visibleVersion: v26.28.0
browser: Chromium 151.0.7922.34
htmlBytes: 96372
htmlSha256: f93825397392351ec74415497f4b99cd9fe243571f311c52f197cf2753059c1c
mainAsset: https://monkeytype.com/js/monkeytype.BXyo3E1j.js
mainAssetBytes: 772779
mainAssetSha256: 2e8cf1a2fa9f734f433fbbf3700081e3222373ddad9e3e5fd75068dab8f7486b
```

The source oracle was pinned separately at commit
`7feea96c5df21a59af9553fa7c52eb33af5997b8`.

## Trusted browser observations

The in-app Browser was used, not Computer Use.

Monkeytype words/10:

```text
prompt: any but even which play call a how feel possible
controller delay: 65 ms/key
wpm: 35.08
raw: 35.08
accuracy: 100%
characters: 48/0/0/0
consistency: 0%
elapsed: 16.42 s
afk: 66.99%
```

The displayed elapsed/AFK values include pauses between tool calls and are not
performance measurements.

Rill words/10:

```text
prompt: act green play very though house talk other fire once
controller delay: 65 ms/key
wpm: 130
raw: 130
accuracy: 100%
characters: 53/0/0/0
consistency: 95.9%
duration: 4.9 s
```

Clean production-stack Rill run:

```text
prompt: against cut sea against tree food minute old still field
wpm: 170
raw: 170
accuracy: 100%
characters: 56/0/0/0
consistency: 96.3%
duration: 4.0 s
```

## Validity

These runs prove that trusted input and result extraction worked on both live
surfaces. They do not prove numerical parity because the prompts and actual
timestamps differ. An attempt to provision the same custom Monkeytype prompt
was not successfully validated and was discarded as invalid evidence.

No row requiring an identical live trace was marked `PASS` from these runs.

