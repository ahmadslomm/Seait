# Animated profile header (`infoBgImg`) — findings

Status: **investigated and specified, NOT implemented.**

## What the API returns

`user.getUserinfo` → `infoBgImg` is **not an image**. For account 1278472 it is:

```
https://ufile.zaffalive.com/uc/zip/goods_bd794c83b7cedba063356b15d417ff22.zip?srcType=2
```

The original CDN is **still live** (HTTP 200, `application/zip`, 2.23 MB). The
same pattern applies to the other decoration fields:

| field | srcType | payload |
|---|---|---|
| `infoBgImg` | 2 | zip → **`.mp4`** (animated profile background) |
| `avatarFrame` | 3 | zip → **`.pag`** (avatar decoration) |
| `chatBubble` | 1 | zip → decoration bundle |

## The video format (measured)

The zip contains a single file, e.g. `66c2c58d993e82bd54736a53446d6994.mp4`,
`1136x1680`. It is an **RGB + alpha side-by-side** encoding — MP4 has no alpha
channel, so the mask is carried in the same frame:

```
x = 0 .......... 757 .......... 1136
|<--- RGB 757 --->|<-- ALPHA 379 -->|
```

Verified by sampling saturation of the right-hand region:

- split at 568 (naive half) → saturation **0.138** (still coloured — wrong)
- split at 757                → saturation **0.0027** (pure greyscale — correct)

So the alpha is stored at **half the horizontal resolution** of the colour
region (379 ≈ 757 / 2) and must be upscaled 2× horizontally before use.

The decoded artwork for this account is the **VIP V palace** (violet, winged
horses, gold crown, "VIP V" crest) — it is the *profile* background, and is
distinct from the mosque artwork on the Me tab header.

## Implementation plan

1. `archive` package → unzip the CDN payload in memory, pick the `.mp4`.
2. Cache to app documents keyed by the URL hash (the bundle is ~2 MB).
3. `video_player` → looping, muted `VideoPlayerController.file`.
4. Composite with a `FragmentProgram` (Flutter shader):
   - sample colour from `uv.x * 0.666` (the 757/1136 region)
   - sample alpha from `0.666 + uv.x * 0.334` (the 379/1136 region), taking any
     channel since it is greyscale
   - output `vec4(rgb, alphaSample.r)`
5. Render behind the Me header, sized to the header box, with the existing
   gradient as the fallback while the bundle downloads or if decoding fails.

## Why it is not done

This needs two new dependencies (`archive`, `video_player`), a GLSL shader
asset, a download/cache layer and its own emulator verification pass. It was
scoped but deliberately left unimplemented rather than half-landed — the
current header keeps the flat gradient, which is visually wrong but stable.

---

# Implementation attempt (r-t4) — BLOCKED, and why

Status: **module built and proven to download/unpack, but the compositing step
cannot work with `video_player`. Disabled by default.**

## What works (verified on device, run r-t4)

`DecorationCache` fetches the CDN zip, unpacks the mp4 and caches it. Confirmed
in logcat on the emulator:

```
I flutter : [decoration] unpacked 66c2c58d993e82bd54736a53446d6994.mp4
            -> /data/user/0/com.example.seait/files/decorations/4de44b0d…mp4
```

0 crashes. So download → unzip → cache → `VideoPlayerController.file` is sound.

## What does not work

Two compositing approaches were tried; **both fail for the same root cause**.

1. **FragmentShader sampling the video.** Impossible: `video_player` never
   exposes a `ui.Image`, so there is nothing to bind to a shader sampler.
2. **Two-layer draw + `ColorFilter` luminance→alpha + `BlendMode.dstIn`.**
   Compiles and runs, but renders a **black box**.

Root cause: on Android `video_player` draws through a **platform texture**. Those
pixels are composited by the platform, not by Skia, so Flutter cannot read them
back. Any operation needing readback — `saveLayer`, `BlendMode`, `ColorFiltered`,
shader sampling — silently fails to see the video content.

This is a property of textured platform views, not a bug in the code above.

## Viable routes (not attempted)

1. **Decode frames to `ui.Image` yourself** (ffmpeg-kit or a platform channel),
   then either shader-composite or `drawImage` per frame. Full control; heaviest.
2. **Convert the mp4 offline to SVGA or PAG** and reuse the renderers this app
   already has — both draw into Skia and support real alpha. Cheapest path to a
   correct result; needs an offline conversion step per decoration.
3. **Pre-multiply offline into an animated WebP/APNG** and play as an image
   sequence. Simple, but larger files and no hardware video decode.

Route 2 fits this codebase best: `SvgaRenderer`/`PagRenderer` are already wired,
tested and proven on device.

## Current state

`kAnimatedHeader = bool.fromEnvironment('ANIMATED_HEADER')` defaults **false**,
so the Me header keeps the static gradient. The module stays in
`lib/decoration/` because the download/cache half is correct and reusable; only
the compositing half is blocked.
