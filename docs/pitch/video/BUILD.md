# Video build status

The composition is assembled from the real compiled application and API
responses captured after the satellite archive build. Local-file capture is used
because HyperFrames rejects direct localhost captures. This preserves the real
UI; it is not a recreated product mockup.

No HeyGen login is available. The final file uses readable on-screen text and
is silent; the accompanying 90-second script is ready for human narration.

Rebuild supporting pitch text with:

```
python docs/pitch/build_pitch.py --report data/processed/harmonization_report.json --manifest data/processed/manifest.json
```

Freeze the compiled app only when the API reports `source=parquet`:

```
python docs/pitch/capture_app.py --output /tmp/firebros-real-app
hyperframes capture --local-file /tmp/firebros-real-app/index.html --output /tmp/firebros-real-capture --skip-assets --skip-vision --max-screenshots 8 --capture-budget 45000
```

The screen assets are taken from those real captures. The movie is an explanatory walkthrough of captured states, not a recording of live user input. `build_video.py` then
binds measured report values into six scenes. Run `hyperframes check`, inspect
`snapshot --review`, and render the 90-second MP4 only after those checks pass.

Studio preview: http://localhost:3002/#project/video (local only). It allows direct
editing of text and timeline; the Edit with Framey button opens the HyperFrames
desktop app. Final file: `demo.mp4` (90 seconds, 1920×1080, 30fps, silent).

The `crop_capture.mjs` helper requires `sharp` in Node's module search path;
`FIREBROS_SHARP_MODULE` can point to an installed Sharp module without modifying
project dependencies. Crop coordinates are checked against the final capture,
not inferred from file names. The saved capture manifest hashes every media
plate and the report used for numeric callouts.

Verified delivery: `demo.mp4`, H.264,1920×1080,30fps,90.000seconds,4,781,489bytes.
The final frame inspection is `review/encoded-at-52.5s.png`; `delivery.json`
records the SHA-256. This version is silent; record the accompanying narration
or add a licensed track to the editable project when a sound source is available.
