"""Image validation and normalisation.

Everything an untrusted upload is checked against lives here, and nothing here
touches a database, a filesystem or the network. It takes bytes and returns
bytes plus the metadata the caller will store, so the rules can be tested
exhaustively without standing up the application.

The order of the checks is the point
------------------------------------
Bytes are validated, re-encoded, and the *result* is what gets stored. That
single decision disposes of most of what image upload is famous for:

- **Content, not claim.** A file is identified by what Pillow decodes from its
  header, never by the `Content-Type` the client sent and never by the
  extension on its filename. Both are attacker-controlled strings.
- **No polyglots survive re-encoding.** A file that is a valid JPEG with a PHP
  payload appended, or with an embedded profile, is decoded and written back out
  as a fresh image. Whatever was hiding past the image data is not in the output.
- **No EXIF survives.** `exif_transpose` applies the rotation and
  `save()` is called without an `exif` argument, so GPS coordinates, camera
  serial numbers and a home address are dropped rather than published.
- **Dimensions are read after the rotation is applied.** A phone photo tagged
  orientation 6 is stored 4032x3024, not 3024x4032. The frontend reserves
  layout boxes from these numbers, and a swapped pair is a visibly broken card.

Why not just check the header
----------------------------
Because a header is 12 bytes that an attacker also writes. `Image.verify()`
forces a structural walk of the file, and re-encoding forces a full decode, so
neither trusts anything the client asserted.

What is deliberately not configurable
-------------------------------------
The allowed format set. `IMAGE_STORAGE_*` settings can change the size and
pixel budget - a deployment with different constraints can tune those - but the
format allow-list is a module constant. An environment variable that can add a
format is an environment variable that can add SVG, and SVG is a script
execution vector, not a picture.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass
from io import BytesIO
from typing import Final

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings
from app.core.errors import ValidationError

#: Formats this application will accept, mapped to the extension used in the
#: storage key.
ALLOWED_IMAGE_FORMATS: Final[dict[str, str]] = {
    "JPEG": "jpg",
    "PNG": "png",
    "WEBP": "webp",
}

#: The MIME type each accepted format is served as. Distinct from the declared
#: type: this one is ours, and it is written from the format we actually stored.
ALLOWED_MIME_TYPES: Final[dict[str, str]] = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}

#: Content types a client may declare. `application/octet-stream` is accepted
#: because some clients send it for everything and refusing it would break an
#: honest upload over a policy that would not have helped. Note what is *not*
#: here: no `image/svg+xml`, no `text/html`, no `application/x-msdownload`.
ALLOWED_DECLARED_CONTENT_TYPES: Final[frozenset[str]] = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/octet-stream",
        "",
    }
)

#: Pillow's own decompression-bomb ceiling, replaced with one derived from this
#: project's pixel budget so the two can never disagree.
_MAX_DECODED_PIXELS: Final[int] = settings.image_max_width * settings.image_max_height


@dataclass(frozen=True, slots=True)
class NormalisedImage:
    """A validated, re-encoded image ready to be stored."""

    data: bytes
    content_type: str
    width: int
    height: int
    #: The extension for the storage key, from the *detected* format.
    extension: str

    @property
    def byte_size(self) -> int:
        return len(self.data)


def validate_image(
    data: bytes,
    *,
    declared_content_type: str | None = None,
) -> NormalisedImage:
    """Validate and re-encode one uploaded image, or raise `ValidationError`.

    Raises `ValidationError` (HTTP 422) for every rejection, with a message that
    says which rule was broken and what the value was - but never echoes the
    bytes, and never names a filesystem path.
    """
    _reject_oversized(data)
    _reject_undeclared_content_type(declared_content_type)

    source = _decode(data)
    detected_format = (source.format or "").upper()
    if detected_format not in ALLOWED_IMAGE_FORMATS:
        raise ValidationError(
            "Only JPEG, PNG and WebP images are accepted. "
            f"This file appears to be {detected_format or 'an unrecognised format'}."
        )

    # `verify()` consumes the file object, so the image must be decoded again to
    # be usable. Reopening from the buffer is cheap next to having trusted the
    # first pass.
    image = _open_for_decode(data)
    image = _apply_orientation(image)
    image = _normalise_mode(image, detected_format)

    width, height = image.size
    _check_dimensions(width, height)

    encoded = _reencode(image, detected_format)
    return NormalisedImage(
        data=encoded,
        content_type=ALLOWED_MIME_TYPES[detected_format],
        width=width,
        height=height,
        extension=ALLOWED_IMAGE_FORMATS[detected_format],
    )


def _reject_oversized(data: bytes) -> None:
    """Refuse a file above the configured ceiling.

    Checked against the bytes actually received rather than a declared
    `Content-Length`, which is a claim by the same client whose upload is being
    checked.
    """
    limit = settings.image_max_bytes
    if len(data) > limit:
        raise ValidationError(f"Image is {len(data) // 1024} KB. The limit is {limit // 1024} KB.")
    if not data:
        raise ValidationError("Image file is empty.")


def _reject_undeclared_content_type(declared: str | None) -> None:
    """Refuse a declared content type that is not plausible for this API.

    Not a security control on its own - the format is detected from the bytes
    regardless - but a `text/html` part usually means a wrong client, and
    failing loudly beats storing it and wondering.
    """
    if declared is None:
        return
    normalised = declared.split(";", 1)[0].strip().lower()
    if normalised not in ALLOWED_DECLARED_CONTENT_TYPES:
        raise ValidationError(
            f"Content type '{normalised}' is not accepted. Upload a JPEG, PNG or WebP image."
        )


def _decode(data: bytes) -> Image.Image:
    """Structurally verify the bytes and return the header-bearing image."""
    try:
        with Image.open(BytesIO(data)) as probe:
            probe.verify()
            return probe
    except UnidentifiedImageError as exc:
        raise ValidationError("That file is not a readable image.") from exc
    except Image.DecompressionBombError as exc:
        raise ValidationError("Image dimensions exceed the maximum allowed.") from exc
    except (OSError, ValueError, SyntaxError) as exc:
        # Pillow raises a wide and version-dependent family here. All of them
        # mean the same thing to a caller: these are not usable image bytes.
        raise ValidationError("That file is not a readable image.") from exc


def _open_for_decode(data: bytes) -> Image.Image:
    """Reopen for a full decode, with decompression bombs treated as fatal."""
    with warnings.catch_warnings():
        # Above 89M pixels Pillow warns; above the ceiling it raises. This
        # project's own pixel budget is lower than both, so the warning is
        # escalated to an error to guarantee a large image is refused rather
        # than merely noted.
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            image = Image.open(BytesIO(data))
            image.load()
        except Image.DecompressionBombWarning as exc:
            raise ValidationError("Image dimensions exceed the maximum allowed.") from exc
        except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as exc:
            raise ValidationError("That file is a damaged or unsupported image.") from exc
    return image


#: Re-exported so the two Pillow import styles do not diverge across modules.
def _apply_orientation(image: Image.Image) -> Image.Image:
    """Apply the EXIF orientation and drop the tag.

    Isolated in its own function because it is the one step whose output
    dimensions can differ from its input dimensions, which is exactly the detail
    that gets missed when it is inlined - and a swapped width/height pair is a
    visibly broken card on the public site. Returns a new image; a corrupt EXIF
    block is not a reason to reject an otherwise readable photograph, so a
    failure here falls back to the untransposed original.
    """
    try:
        return ImageOps.exif_transpose(image) or image
    except (OSError, ValueError):
        return image


def _normalise_mode(image: Image.Image, detected_format: str) -> Image.Image:
    """Give the image a mode the target format can actually store.

    JPEG has no alpha channel, so an RGBA or palette source is flattened onto
    white rather than written as JPEG with the alpha discarded somewhere
    undefined. Anything else keeps transparency where it exists.
    """
    if detected_format == "JPEG":
        if image.mode in {"RGBA", "LA", "P"}:
            converted = image.convert("RGB")
            if converted is not image:
                image.close()
            return converted
        if image.mode not in {"RGB", "L", "CMYK"}:
            converted = image.convert("RGB")
            if converted is not image:
                image.close()
            return converted
        return image

    if image.mode == "P":
        converted = image.convert("RGBA" if "transparency" in image.info else "RGB")
        if converted is not image:
            image.close()
        return converted
    return image


def _check_dimensions(width: int, height: int) -> None:
    """Enforce the configured pixel bounds."""
    if width < settings.image_min_width or height < settings.image_min_height:
        raise ValidationError(
            "Image is too small. It must be at least "
            f"{settings.image_min_width}x{settings.image_min_height} pixels."
        )
    if width > settings.image_max_width or height > settings.image_max_height:
        raise ValidationError(
            "Image is too large. It must be no more than "
            f"{settings.image_max_width}x{settings.image_max_height} pixels."
        )


def _reencode(image: Image.Image, detected_format: str) -> bytes:
    """Write the image back out from scratch, with no metadata attached."""
    buffer = BytesIO()
    try:
        if detected_format == "JPEG":
            image.save(
                buffer,
                format="JPEG",
                quality=85,
                optimize=True,
                progressive=True,
            )
        elif detected_format == "PNG":
            image.save(buffer, format="PNG", optimize=True, compress_level=9)
        else:
            image.save(buffer, format="WEBP", quality=85, method=4)
    except (OSError, ValueError) as exc:
        raise ValidationError("That image could not be processed.") from exc
    finally:
        image.close()

    encoded = buffer.getvalue()
    # Re-encoding can only shrink or modestly grow a legitimate photo, but a
    # pathological input should not be allowed to exceed the ceiling by growing.
    if len(encoded) > settings.image_max_bytes:
        raise ValidationError(
            f"Processed image is {len(encoded) // 1024} KB. "
            f"The limit is {settings.image_max_bytes // 1024} KB."
        )
    return encoded


def configure_pillow_limits() -> None:
    """Install this project's decompression-bomb ceiling into Pillow.

    Called once at application start-up. `MAX_IMAGE_PIXELS = None` would disable
    the protection entirely, so it is never set to that here.
    """
    Image.MAX_IMAGE_PIXELS = _MAX_DECODED_PIXELS


def content_type_for_extension(extension: str) -> str | None:
    """Reverse lookup, for serving a stored file by key."""
    for image_format, ext in ALLOWED_IMAGE_FORMATS.items():
        if ext == extension:
            return ALLOWED_MIME_TYPES[image_format]
    return None
