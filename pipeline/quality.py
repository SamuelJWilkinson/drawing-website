# ==========================================
# QUALITY CHECKS
# Pixel checks that decide whether an image looks like a clean line drawing.
# Nothing here shows an image: every check returns numbers, and decide() turns
# them into reasons, so the report explains each rejection.
# ==========================================
import io

import numpy as np
from PIL import Image
from scipy import ndimage

# Tune these from the numbers in the report (pipeline/reports/*.csv)
LIMITS = {
    'colour_share_max': 0.02,     # share of ink pixels that are visibly coloured
    'background_tint_max': 0.08,  # how coloured the background is (0 = white or grey)
    'background_min': 215,        # typical background brightness (0-255); lower means dark or textured
    'flat_grey_max': 0.01,        # share of the picture covered by flat mid-grey (shading)
    'dark_min': 0.004,            # share of dark pixels; lower means nearly blank
    'dark_max': 0.15,             # share of dark pixels; higher means heavy fills or silhouettes
    'components_max': 30,         # separate dark shapes; a continuous line has few, text and clip art have many
    'width_spread_max': 3.0,      # thick parts of the line divided by thin parts (1 = perfectly even)
}

MIN_SHAPE_PIXELS = 30  # ignore specks smaller than this when counting shapes


# ==========================================
# LOADING
# ==========================================
def load_on_white(data):
    """Open image bytes; transparent areas become white."""
    image = Image.open(io.BytesIO(data))
    if image.mode in ('RGBA', 'LA') or 'transparency' in image.info:
        image = image.convert('RGBA')
        page = Image.new('RGBA', image.size, (255, 255, 255, 255))
        page.alpha_composite(image)
        image = page
    return image.convert('RGB')


# ==========================================
# MEASURING
# ==========================================
def measure(rgb):
    grey = np.asarray(rgb.convert('L')).astype(float)
    saturation = np.asarray(rgb.convert('HSV'))[..., 1] / 255.0

    ink = grey < 200
    colour_share = float((saturation[ink] > 0.25).mean()) if ink.any() else 0.0

    dark = grey < 128
    dark_share = float(dark.mean())

    # Mid-grey that is not just the soft edge of a dark line is shading or a textured background
    mid = (grey >= 70) & (grey <= 200)
    near_line = ndimage.binary_dilation(grey < 100, iterations=3)
    flat_grey = float((mid & ~near_line).mean())

    # Separate dark shapes (8-way connected), ignoring tiny specks
    shapes, count = ndimage.label(grey < 160, structure=np.ones((3, 3)))
    sizes = ndimage.sum(np.ones_like(shapes), shapes, index=range(1, count + 1)) if count else []
    components = int(sum(1 for size in sizes if size >= MIN_SHAPE_PIXELS))

    # Line thickness along the middle of each stroke (ridge of the distance map)
    distance = ndimage.distance_transform_edt(dark)
    ridge = (distance > 0) & (distance >= ndimage.maximum_filter(distance, size=3))
    widths = 2 * distance[ridge]
    if len(widths) >= 50:
        low, middle, high = np.percentile(widths, [10, 50, 90])
        width_median, width_spread = float(middle), float(high / max(low, 1.0))
    else:
        width_median, width_spread = 0.0, 0.0

    return {
        'width_px': rgb.width,
        'height_px': rgb.height,
        'colour_share': round(colour_share, 4),
        'background_tint': round(float(np.median(saturation)), 4),
        'background': round(float(np.median(grey)), 1),
        'flat_grey': round(flat_grey, 4),
        'dark_share': round(dark_share, 4),
        'components': components,
        'line_width': round(width_median, 2),
        'width_spread': round(width_spread, 2),
    }


# ==========================================
# DECIDING
# Returns a list of reasons; an empty list means the image passes.
# ==========================================
def decide(m):
    limit = LIMITS
    reasons = []
    if m['colour_share'] > limit['colour_share_max']:
        reasons.append('colour')
    if m['background_tint'] > limit['background_tint_max']:
        reasons.append('tinted_background')
    if m['background'] < limit['background_min']:
        reasons.append('dark_background')
    if m['flat_grey'] > limit['flat_grey_max']:
        reasons.append('shading')
    if m['dark_share'] < limit['dark_min']:
        reasons.append('nearly_blank')
    if m['dark_share'] > limit['dark_max']:
        reasons.append('heavy_fill')
    if m['components'] > limit['components_max']:
        reasons.append('too_many_shapes')
    if m['width_spread'] > limit['width_spread_max']:
        reasons.append('uneven_line')
    return reasons
