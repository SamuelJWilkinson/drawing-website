# ==========================================
# SOURCES
# Each image source (pixabay.py, later openverse.py ...) offers the same two things:
#   candidates(exclude)  -> yields Candidate objects, best matches first
#   download(candidate)  -> image bytes
# collect.py works with any source that does this.
# ==========================================
from dataclasses import dataclass


@dataclass
class Candidate:
    id: str         # unique across sources, e.g. "pixabay-123456"
    source: str     # e.g. "pixabay"
    image_url: str  # where to download it (never shown to the person drawing)
    page_url: str   # the artwork's page, for credits
    tags: str
    artist: str
    credit: str     # shown at Reveal, e.g. "Image by Someone on Pixabay"


class Blocked(Exception):
    """The source refused us (blocked, rate limited, or unreachable). Never contains the API key."""
