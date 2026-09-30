"""Crop the hero photographs to 16:9, so they match the hero frame's ratio.

The problem this solves: the photographs are 1600x1200 (4:3) and the hero frame is
about 16:9. Any single fit mode is a compromise -

  object-cover  fills the width but scales the image to 133% of the frame's
                height, cutting a quarter of the photo off top and bottom. That
                is the over-cropped car.
  object-contain  shows the whole car but leaves the sides of the frame empty,
                because the photo is narrower than the frame.

Cropping the source to 1600x900 removes the ambiguity: the photo's ratio then
matches the frame's, so `object-cover` fills the width with *zero* cropping and
nothing is lost.

What the crop removes is 300px of height, taken as 120px off the top and 180px off
the bottom. Deliberately asymmetric, and not for a stylistic reason: in all three
photographs the car sits slightly high in the frame, with more empty asphalt
beneath it than sky above it. Taking more from the bottom than the top keeps every
roofline intact. The vertical band that survives is y=120..1020, and each car's
body falls inside it.

The aspect the crop is aiming for is 16:9 rather than a wider 2:1 on purpose. A
1600x900 image is an exact match for a 1440-wide viewport at 90vh, which is the
most common desktop case - the image fits the frame precisely, with no crop and
no empty space. On a wider or shorter viewport a little height is trimmed, which
is a far smaller loss than the current third.

Originals are not kept here: they are the dealership's own files and remain on the
previous website, so this is reproducible rather than a one-way loss.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

HERO = Path(__file__).resolve().parent.parent / "public" / "hero"
TARGET_RATIO = 16 / 9
#: Removed from the top and the bottom. See the note above - asymmetric on purpose.
TRIM_TOP = 120
TRIM_BOTTOM = 180


def crop_to_ratio(image: Image.Image) -> Image.Image:
    """Centre the surviving band, biased upward by the trim constants."""
    width, height = image.size
    target_height = round(width / TARGET_RATIO)

    if target_height >= height:
        # Wider than the target already: crop the sides instead.
        target_width = round(height * TARGET_RATIO)
        left = (width - target_width) // 2
        return image.crop((left, 0, left + target_width, height))

    # The window is the target height, positioned by the trim constants rather
    # than centred, then clamped so it can never run off the image.
    top = min(TRIM_TOP, height - target_height)
    return image.crop((0, top, width, top + target_height))


def main() -> int:
    paths = sorted(HERO.glob("hero-slide-*.jpg"))
    if not paths:
        print(f"FAIL no hero images found in {HERO}")
        return 1

    for path in paths:
        with Image.open(path) as original:
            before = original.size
            cropped = crop_to_ratio(original)
            # Re-encode at quality 82. These are display photographs shown at
            # up to 1920px wide and are re-encoded again to AVIF by Next's
            # optimiser, so storing them at maximum JPEG quality would add bytes
            # for nothing.
            cropped.save(path, "JPEG", quality=82, optimize=True, progressive=True)
            after = cropped.size
        with Image.open(path) as written:
            written_size = written.size
        print(
            f"{path.name}: {before[0]}x{before[1]} -> {after[0]}x{after[1]} "
            f"(ratio {after[0] / after[1]:.3f}, written {written_size[0]}x{written_size[1]})"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
