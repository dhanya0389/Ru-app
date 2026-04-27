"""
Lotus bloom SVG path generator.
Pure Python, no deps. Emits SVG <path> markup for properly-shaped teardrop petals.

A petal is a closed Bezier shape:
- Base at the bloom center.
- Tip at distance `length` from center, at angle `theta` (radians, 0 = up, +CW).
- Two side-arcs bulge perpendicular to the base-tip axis by `width` units at midpoint.
- Inner-curl factor controls how much the curves pull back toward the axis at base/tip.
"""
from __future__ import annotations
import math


def petal_path(cx: float, cy: float, theta_deg: float, length: float, width: float,
               f_near_base: float = 0.30, f_near_tip: float = 0.70) -> str:
    """
    Produce an SVG `d` attribute for a single teardrop petal.

    cx, cy        — bloom center (base of petal)
    theta_deg     — petal direction in degrees, 0 = straight up, positive = clockwise
    length        — distance from base to tip
    width         — half-width of petal at its widest (midpoint)
    f_near_base   — fraction along axis (0..1) for the first Bezier control point
    f_near_tip    — fraction along axis (0..1) for the second Bezier control point
                    Together these two control points (both pulled perpendicular to axis by
                    `width`) produce the petal's mid-axis bulge. With defaults 0.30 and 0.70
                    the widest point of the petal sits around 50% of length.
    """
    theta = math.radians(theta_deg)
    # Axis direction (base -> tip). 0° = up = (0, -1).
    ax = math.sin(theta)
    ay = -math.cos(theta)
    # Perpendicular (rotated +90° CCW from axis): for left-of-axis bulge.
    px = -ay
    py = ax

    # Tip position
    tx = cx + length * ax
    ty = cy + length * ay

    # Outer edge of petal — both control points bulged perpendicular by +width
    c1x = cx + (length * f_near_base) * ax + width * px
    c1y = cy + (length * f_near_base) * ay + width * py
    c2x = cx + (length * f_near_tip) * ax + width * px
    c2y = cy + (length * f_near_tip) * ay + width * py

    # Inner edge of petal — control points bulged the other direction by -width (mirror)
    # Returning from tip back to base.
    c3x = cx + (length * f_near_tip) * ax - width * px
    c3y = cy + (length * f_near_tip) * ay - width * py
    c4x = cx + (length * f_near_base) * ax - width * px
    c4y = cy + (length * f_near_base) * ay - width * py

    return (
        f"M {cx:.1f} {cy:.1f} "
        f"C {c1x:.1f} {c1y:.1f}, {c2x:.1f} {c2y:.1f}, {tx:.1f} {ty:.1f} "
        f"C {c3x:.1f} {c3y:.1f}, {c4x:.1f} {c4y:.1f}, {cx:.1f} {cy:.1f} Z"
    )


def lotus_bloom(cx: float, cy: float, scale: float = 1.0,
                fill_color: str = "currentColor",
                stroke_color: str = "currentColor",
                show_receptacle: bool = True) -> str:
    """
    Generate a full lotus bloom centered at (cx, cy).
    scale=1.0 produces a bloom about 250 units wide and 160 units tall.
    Returns an SVG fragment (group with petal paths + vein lines + receptacle).
    """
    s = scale
    out = []
    out.append(f'<g class="lotus" data-cx="{cx}" data-cy="{cy}" data-scale="{scale}">')

    # OUTER ring — 5 widest, lowest petals, fanning out almost horizontal
    outer_petals = [
        (-90, 90 * s, 22 * s),   # far left (almost horizontal)
        (-65, 110 * s, 26 * s),  # mid-left
        (-30, 120 * s, 30 * s),  # near-left
        (30, 120 * s, 30 * s),   # near-right
        (65, 110 * s, 26 * s),   # mid-right
        (90, 90 * s, 22 * s),    # far right
    ]
    for theta, length, width in outer_petals:
        d = petal_path(cx, cy, theta, length, width, f_near_base=0.30, f_near_tip=0.65)
        out.append(
            f'  <path d="{d}" fill="{fill_color}" fill-opacity="0.06" '
            f'stroke="{stroke_color}" stroke-width="1.2" stroke-linejoin="round" />'
        )

    # MIDDLE ring — 4 petals, more upright, fuller body
    middle_petals = [
        (-50, 130 * s, 28 * s),
        (-22, 140 * s, 30 * s),
        (22, 140 * s, 30 * s),
        (50, 130 * s, 28 * s),
    ]
    for theta, length, width in middle_petals:
        d = petal_path(cx, cy, theta, length, width, f_near_base=0.30, f_near_tip=0.70)
        out.append(
            f'  <path d="{d}" fill="{fill_color}" fill-opacity="0.10" '
            f'stroke="{stroke_color}" stroke-width="1.3" stroke-linejoin="round" />'
        )

    # CENTER ring — 3 narrow upright petals
    center_petals = [
        (-12, 140 * s, 16 * s),
        (0, 150 * s, 16 * s),
        (12, 140 * s, 16 * s),
    ]
    for theta, length, width in center_petals:
        d = petal_path(cx, cy, theta, length, width, f_near_base=0.30, f_near_tip=0.70)
        out.append(
            f'  <path d="{d}" fill="{fill_color}" fill-opacity="0.14" '
            f'stroke="{stroke_color}" stroke-width="1.4" stroke-linejoin="round" />'
        )

    # Vein lines (light radiating)
    out.append('  <g stroke-width="0.6" stroke-opacity="0.4" fill="none">')
    for theta_deg, length in [(-65, 100), (-30, 130), (0, 140), (30, 130), (65, 100)]:
        theta = math.radians(theta_deg)
        ex = cx + (length * s) * math.sin(theta)
        ey = cy - (length * s) * math.cos(theta)
        out.append(f'    <path d="M {cx:.1f} {cy - 8 * s:.1f} L {ex:.1f} {ey:.1f}" stroke="{stroke_color}" />')
    out.append('  </g>')

    # Receptacle (seed pod) at the base
    if show_receptacle:
        rw = 18 * s
        rh = 14 * s
        out.append(
            f'  <path d="M {cx - rw:.1f} {cy + 2:.1f} '
            f'C {cx - rw:.1f} {cy + rh:.1f}, {cx + rw:.1f} {cy + rh:.1f}, {cx + rw:.1f} {cy + 2:.1f}" '
            f'stroke="{stroke_color}" stroke-width="1.0" fill="none" stroke-opacity="0.7" />'
        )
        for dot_x, dot_y in [(-10, 8), (-3, 10), (4, 10), (11, 8), (0, 12)]:
            out.append(
                f'  <circle cx="{cx + dot_x * s:.1f}" cy="{cy + dot_y * s:.1f}" '
                f'r="{1.6 * s:.1f}" fill="{stroke_color}" fill-opacity="0.55" />'
            )

    out.append('</g>')
    return '\n'.join(out)


def lotus_bud(cx: float, cy: float, scale: float = 1.0,
              fill_color: str = "currentColor", stroke_color: str = "currentColor") -> str:
    """A closed lotus bud — narrow teardrop shape with vein lines."""
    s = scale
    h = 38 * s
    w = 11 * s
    out = []
    out.append(f'<g class="lotus-bud" data-cx="{cx}" data-cy="{cy}">')
    # Main bud shape (closed teardrop, point up)
    out.append(
        f'  <path d="M {cx:.1f} {cy:.1f} '
        f'C {cx - w:.1f} {cy - h*0.2:.1f}, {cx - w:.1f} {cy - h*0.7:.1f}, {cx:.1f} {cy - h:.1f} '
        f'C {cx + w:.1f} {cy - h*0.7:.1f}, {cx + w:.1f} {cy - h*0.2:.1f}, {cx:.1f} {cy:.1f} Z" '
        f'fill="{fill_color}" fill-opacity="0.10" '
        f'stroke="{stroke_color}" stroke-width="1.0" stroke-linejoin="round" />'
    )
    # Center vein
    out.append(
        f'  <path d="M {cx:.1f} {cy - h*0.15:.1f} L {cx:.1f} {cy - h*0.9:.1f}" '
        f'stroke="{stroke_color}" stroke-width="0.4" stroke-opacity="0.5" fill="none" />'
    )
    # Side veins
    out.append(
        f'  <path d="M {cx - w*0.5:.1f} {cy - h*0.3:.1f} '
        f'C {cx - w*0.4:.1f} {cy - h*0.55:.1f}, {cx - w*0.2:.1f} {cy - h*0.78:.1f}, {cx - w*0.05:.1f} {cy - h*0.88:.1f}" '
        f'stroke="{stroke_color}" stroke-width="0.4" stroke-opacity="0.4" fill="none" />'
    )
    out.append(
        f'  <path d="M {cx + w*0.5:.1f} {cy - h*0.3:.1f} '
        f'C {cx + w*0.4:.1f} {cy - h*0.55:.1f}, {cx + w*0.2:.1f} {cy - h*0.78:.1f}, {cx + w*0.05:.1f} {cy - h*0.88:.1f}" '
        f'stroke="{stroke_color}" stroke-width="0.4" stroke-opacity="0.4" fill="none" />'
    )
    out.append('</g>')
    return '\n'.join(out)


if __name__ == "__main__":
    # Demo: print a single bloom centered at (200, 250) at scale 1.0
    print('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" '
          'fill="none" stroke="currentColor" stroke-linecap="round">')
    print(lotus_bloom(200, 250, scale=1.0))
    print('</svg>')
