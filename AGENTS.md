# iMessage video rig — agent guide

This rig renders fake iMessage screen recordings (iOS 26, light mode, iPhone 16/17 Pro) for short-form marketing videos.
The contact is **Worth**, an AI that users text. Each video is one YAML script. The rig renders a **silent** 1080x2120 60fps MP4 (see `format`).
The caption is part of the script and is burned into the video. The human adds the sound in the app (or uploads the preview). Your job is to make the chat events land on the beats of that sound.

## Workflow

```sh
npm run rig -- new <slug>            # 1. scaffold videos/<slug>/ (script.yaml, photos/)
#                                      2. put the sound file in videos/<slug>/, set audio.file
npm run rig -- analyze <slug>        # 3. word timestamps + onsets -> analysis.json (prints them)
#                                      4. write the script; point marks at words/onsets
npm run rig -- check <slug>          # 5. validate + print the resolved timeline
npm run rig -- chart <slug>          # 6. LOOK at out/<slug>/chart.png: audio vs. events
npm run rig -- spectro <slug>        #    spectrogram, to find exactly where a word starts
npm run rig -- sheet <slug>          # 7. LOOK at out/<slug>/sheet.png: a frame 0.4s after each event
npm run rig -- still <slug> 6.9 f420 #    full-size frames for detail checks
npm run rig -- render <slug>         # 8. out/<slug>/<slug>.mp4 (silent) + .preview.mp4 (with audio) + .audio.m4a
#                                      With audio.speed != 1, upload the preview: the app's own sound won't line up.
npm run rig -- gen-images <slug>     #    generate missing photos that have a `prompt` (needs OPENAI_API_KEY)
npm run studio                       #    Remotion Studio: humans scrub all videos live, with audio
```

Always inspect `chart.png` and `sheet.png` with your image viewer before you render. Check that:
- each punchline lands on its beat (the event line sits on the word/onset in the chart);
- no text is cut off, and the newest message sits above the input bar;
- the video holds long enough at the end for the payoff to read.

To check motion, extract frames from the render: `ffmpeg -ss 6.4 -i out/<slug>/<slug>.mp4 -vf "select='not(mod(n,4))',scale=270:-1,tile=8x1" -frames:v 1 strip.png`.

## Script reference (`videos/<slug>/script.yaml`)

```yaml
audio: {file: audio.mp3, start: 0, speed: 1, volume: 1}  # start = where in the sound the video begins;
                      # speed 0.75 = 25% slower, pitch kept (cached in _cache/; re-run analyze after changing)
marks: {loss1: "word:dang#1", win: "word:winning-0.1", drop: 6.5}
status: {time: "11:27", battery: 64, network: 5G, signal: 3, charging: false}  # network: 5G | LTE | wifi
contact: {name: Worth, emoji: "🤑", colors: none}  # colors: none = the emoji alone is the photo
layout: {top: 0.33, bottom: 0.72}  # top: where a short thread starts (default: under the header; raise it to clear the caption)
                      # bottom: newest message sits at 72% of screen height (the video's focus), not at the input bar
unread: 0             # count on the back button (0 hides it)
end: win+4            # video length; default = last event + 2s
fps: 60
format: tiktok        # 1080x2120 (default, fits TikTok's video area on modern phones) | 9:16 (1080x1920) | iphone (1080x2348)
caption: checking if my old games can pay for my new iPhone   # TikTok-style caption, burned into the video
# or: caption: {text: "...", style: outline, y: 0.265, size: 64, maxWidth: 0.84, from: 0, to: 5.5}
#   style: outline (white + thick black outline, default) | box (black on white boxes) | plain
#   y = vertical center as a fraction of height; the default sits under the header, clear of TikTok's top tabs.
#   Keep it out of the bottom ~22% (TikTok's username/description) and the right edge (like/comment buttons).
history: [...]        # messages already in the thread (no animation)
events: [...]         # the timeline
```

### Times (`at:`, `end:`, mark values)
All times are **video seconds**. Forms:
- `3.25` — absolute
- `+0.4` — after the previous event
- `win`, `win+0.35`, `win-0.2` — a named mark ± offset
- `word:gambling`, `word:dang#2`, `wordend:it` — a word start/end from `analysis.json` (`#n` = nth occurrence). Audio `start` is subtracted for you.
- `onset:5` — the 5th detected onset (numbers are printed by `analyze` and drawn on the chart)
- `snap:word:aw#1` — the onset nearest a word's start

**Whisper word times can be 0.1-0.5s off**, especially with music under the voice. For a beat that must land
exactly, run `npm run rig -- spectro <slug> --from a --to b`: a voice shows as stacked horizontal lines, so read
where they start and write that time as a number.

An event can also set `mark: name` to name its own time for later events.

### Events
```yaml
- stamp: Today 11:26 AM          # no `at`: appears with the next message
- at: 0.5
  me: what's this worth          # user (blue). Text markup below.
- at: +0.3
  me:
    photo: photos/a.jpg           # or {file: photos/a.jpg, prompt: "...", crop: "4:3"}
                                  # prompt = for gen-images; crop = show in that frame (center crop)
    text: optional caption        # a photo + text makes two bubbles (sent together)
    id: a                         # ids let tapbacks target a message (with a photo, `id` = the photo; `textId` = the text)
- at: hit
  typing: 0.8                     # typing dots for 0.8s BEFORE the message lands at `at` (0 = none)
  worth: "[shake]WAIT.[/shake]"   # Worth (gray). Omit typing for an auto length.
- at: +0.3
  tapback: {kind: emphasize, on: a, by: worth}   # heart | like | dislike | haha | emphasize | question | any emoji
- at: 4.0
  typing: 1.5                     # dots that stop with no message
```
- The event's `at` is when the **bubble appears**. For Worth, that is the hit point; typing is placed before it.
- Auto typing never starts before the previous event. Give `typing:` explicitly to control it.
- There are no Delivered/Read receipts (removed on purpose).

### Text markup
`**bold**`, `*italic*`, `__underline__`, `~~strike~~`, and iOS 18 animated effects on a span:
`[big]…[/big]`, `small`, `shake`, `nod`, `explode`, `ripple`, `bloom`, `jitter`.
A whole message: `worth: {text: "JACKPOT", fx: explode}`. Effects play once, when the message lands (`jitter` keeps going).
A message of only 1-3 emoji renders as big emoji with no bubble. Quote strings that start with `$`, `[`, `*`, or contain `: `.

## Writing good scripts
- Keep messages short and lowercase-casual, like real texts. Worth roasts on losses and loses it on the win.
- Put the punchline bubble exactly on the beat; put the setup (photo + "what's this worth") ~1s before it.
- The visible chat is short (the newest message sits at 72% height). A portrait photo nearly fills it, so its top
  corner (where reactions sit) goes under the header at once. For a photo that gets a reaction, use `crop: "4:3"`
  and check on the sheet that the badge is visible.
- Give the viewer ~1s to read a reply before the next message pushes it up.
- Photos: real photos (portrait, JPEG) look best. For AI photos, write a plain prompt; `gen-images` adds "casual iPhone photo" styling. Set `raw: true` on the photo to skip that.
  OpenAI's safety filter often rejects brand names (Pokémon, Nintendo). Describe the object generically, then
  **look at the result** and make Worth's text match what the photo actually shows.

## Code map
- `rig/cli.ts` — commands. `rig/script.ts` — YAML → `Resolved` (frames). `rig/audio.ts` — onsets, peaks, Whisper words.
- `src/chat/*` — the phone UI. `Screen.tsx` layout/scroll; `Bubbles.tsx`; `Chrome.tsx` (status bar, header, input); `FxText.tsx`; `theme.ts` (all sizes/colors, in iOS points).
- `src/tools/Sheet.tsx`, `SyncChart.tsx` — agent inspection stills.
- `videos/_compare/` — a scene laid out like a real iOS 26 screenshot. After UI changes, run `npm run rig -- still _compare 0.1` and check it still looks real.
- The screen renders from an explicit frame (not `useCurrentFrame`), so every visual must be a pure function of the frame.
