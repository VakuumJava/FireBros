"""Assemble a deterministic 90-second film from captured application screens."""

from __future__ import annotations

import argparse
import html
import json
from pathlib import Path


def create_scene(name: str, duration: int, title: str, statements: list[str], image: str) -> str:
    variables = [
        {
            "id": f"{name}_line_{index}",
            "type": "string",
            "label": f"Statement {index + 1}",
            "default": text,
        }
        for index, text in enumerate(statements)
    ]
    variable_json = html.escape(json.dumps(variables), quote=True)
    lines = "\n".join(
        f'<p id="{name}-line-{index}" class="statement" data-hold="true" data-var-text="{name}_line_{index}">{html.escape(text)}</p>'
        for index, text in enumerate(statements)
    )
    timeline = "\n".join(
        f'tl.fromTo("#{name}-line-{index}", {{opacity:0, x:24}}, '
        f'{{opacity:1, x:0, duration:.45, ease:"power3.out"}}, {2 + index * (duration - 5) / max(1, len(statements) - 1):.2f});'
        for index in range(len(statements))
    )
    words = " ".join(f"<span>{html.escape(word)}</span>" for word in title.split())
    return f'''<template>
<style>
#root {{ position:absolute; inset:0; background:#0e1218; color:#e6e9ee; font-family:Inter,sans-serif; }}
.scene {{ display:grid; grid-template-columns:500px 1fr; gap:50px; padding:108px 150px 108px 192px; height:100%; }}
.copy {{ display:flex; flex-direction:column; justify-content:center; gap:32px; }}
h1 {{ display:flex; flex-wrap:wrap; gap:0 .24em; margin:0; font-size:72px; line-height:1.03; letter-spacing:-.03em; }}
p {{ margin:0; font-size:32px; line-height:1.3; color:#c1ccd9; }}
.screen {{ align-self:center; width:1000px; height:760px; overflow:hidden; border:2px solid #6d7b8e; border-radius:8px; background:#151b23; }}
img {{ width:100%; height:100%; object-fit:contain; display:block; }}
</style>
<div id="root" data-composition-variables="{variable_json}" data-composition-id="{name}" data-width="1920" data-height="1080" data-duration="{duration + (0.45 if name != "close" else 0)}">
 <div class="scene"><div class="copy"><h1 id="{name}-title">{words}</h1>{lines}</div>
 <div class="screen" id="{name}-screen"><img id="{name}-image" src="assets/{image}" alt="Captured Ala-Too Fire Calendar application" /></div></div>
</div>
<script>
 const tl=gsap.timeline({{paused:true}});
 tl.fromTo("#{name}-title span",{{opacity:{1 if name == "question" else 0},y:{0 if name == "question" else 8},filter:"blur({0 if name == "question" else 10}px)"}},{{opacity:1,y:0,filter:"blur(0px)",duration:.36,stagger:.04,ease:"power3.out"}},0);
 tl.fromTo("#{name}-screen",{{x:40,opacity:1}},{{x:0,opacity:1,duration:.6,ease:"expo.out"}},0);
 {timeline}
 window.__timelines["{name}"]=tl;
</script>
</template>'''


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--project", type=Path, default=Path("docs/pitch/video"))
    parser.add_argument("--screen", default="application.png")
    args = parser.parse_args()
    report = json.loads(args.report.read_text())
    holdout = report.get("holdout", {})

    def fmt(number):
        return f"{number:.2f}" if isinstance(number, (int, float)) else "unavailable"

    shots = [
        (
            "question",
            12,
            "Is this month unusual?",
            [
                "Start with your own area.",
                "Compare activity across satellite history.",
            ],
            args.screen,
        ),
        (
            "area",
            15,
            "Define your area.",
            [
                "Choose an area and a month range.",
                "A common grid makes the record comparable.",
                "Missing observations stay visibly missing.",
            ],
            "area.png",
        ),
        (
            "baseline",
            15,
            "Give the month context.",
            [
                "Median. Robust spread. Historical percentile.",
                "The same day window, when available.",
                "Hotspots are thermal anomalies, not confirmed fires.",
            ],
            "anomaly.png",
        ),
        (
            "calibration",
            21,
            "A fairer comparison.",
            [
                "Resolution alignment before regression.",
                f"Paired raw-to-MODIS ratio: {fmt(report.get('overlap', {}).get('raw_to_modis'))}.",
                f"Calibrated-to-MODIS ratio: {fmt(report.get('overlap', {}).get('harmonized_to_modis'))}.",
                "The band shows calibration uncertainty.",
            ],
            "calibration.png",
        ),
        (
            "validation",
            14,
            "Inspect the residual error.",
            [
                "Coefficients exclude 2024-2025.",
                "Diagnostics informed a model revision.",
                f"Cell MAPE {fmt(100 * holdout.get('mape', 0))}%; chart MAPE is AOI-total.",
                "Local prediction error remains substantial.",
            ],
            "calibration.png",
        ),
        (
            "close",
            13,
            "Take the evidence with you.",
            [
                "Export monthly values or original detections.",
                "NASA FIRMS data. Reproducible source hashes.",
                "github.com/VakuumJava/FireBros",
            ],
            "export.png",
        ),
    ]
    scene_dir = args.project / "compositions"
    scene_dir.mkdir(exist_ok=True)
    hosts = []
    start = 0
    for name, duration, title, lines, image in shots:
        (scene_dir / f"{name}.html").write_text(create_scene(name, duration, title, lines, image))
        hosts.append(
            f'<div class="clip" id="{name}" data-composition-id="{name}" data-composition-src="compositions/{name}.html" data-start="{start}" data-duration="{duration + (0.45 if name != "close" else 0)}" data-width="1920" data-height="1080" data-track-index="1" data-track-kind="graphics"></div>'
        )
        start += duration
    root = """<!doctype html><html lang="en"><head><meta charset="UTF-8"><script src="assets/gsap.min.js"></script><style>*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;background:#0e1218;overflow:hidden}#root{width:100%;height:100%}</style></head><body><div id="root" data-composition-id="main" data-width="1920" data-height="1080" data-duration="90" data-fps="30">HOSTS</div><script>window.__timelines["main"]=gsap.timeline({paused:true});</script></body></html>""".replace(
        "HOSTS", "\n".join(hosts)
    )
    (args.project / "index.html").write_text(root)


if __name__ == "__main__":
    main()
