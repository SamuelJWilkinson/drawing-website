# ==========================================
# PIXABAY SOURCE
# Searches the Pixabay API for illustrations and vectors, politely (about one
# request a second; Pixabay allows 100 a minute). The API key comes from the
# PIXABAY_API_KEY environment variable and is never printed or saved.
# ==========================================
import itertools
import time
from urllib.parse import urlparse

import requests

from . import Blocked, Candidate

API_URL = 'https://pixabay.com/api/'

# Add or remove search terms here
TERMS = [
    'continuous line drawing',
    'one line drawing',
    'one line face',
    'single line portrait',
    'line art portrait',
    'line art figure',
    'continuous line hands',
    'minimalist line art woman',
]
IMAGE_TYPES = ['illustration', 'vector']  # never "photo"
COLOURS = 'grayscale,black,white'         # Pixabay filters out coloured images before we download
PER_PAGE = 50
MAX_PAGES = 4                             # Pixabay only returns the first 500 hits per search
PAUSE = 1.0                               # seconds between requests
HEADERS = {'User-Agent': 'drawing-practice-site/1.0 (personal hobby project; https://github.com/SamuelJWilkinson/drawing-website)'}


class Pixabay:
    def __init__(self, key):
        self.key = key
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.requests_made = 0
        self._last = 0.0

    # One polite request. Errors say what happened but never include the URL (it holds the key).
    def _get(self, url, params=None):
        for attempt in range(2):
            pause = PAUSE - (time.time() - self._last)
            if pause > 0:
                time.sleep(pause)
            try:
                response = self.session.get(url, params=params, timeout=60)
            except requests.RequestException as error:
                raise Blocked(f'network error ({type(error).__name__})') from None
            self._last = time.time()
            self.requests_made += 1
            if response.status_code == 429 and attempt == 0:  # rate limited: wait for the window to reset, once
                time.sleep(min(int(response.headers.get('X-RateLimit-Reset', 60)) + 1, 65))
                continue
            if response.status_code != 200:
                raise Blocked(f'HTTP {response.status_code} from {urlparse(url).netloc}')
            return response
        raise Blocked('rate limited twice in a row')

    def _search(self, term, image_type, page):
        response = self._get(API_URL, {
            'key': self.key, 'q': term, 'image_type': image_type, 'colors': COLOURS,
            'safesearch': 'true', 'per_page': PER_PAGE, 'page': page,
        })
        return response.json().get('hits', [])

    def candidates(self, exclude=()):
        """Yield candidates page by page, mixing the search terms so one term can't dominate."""
        seen = set(exclude)
        done = set()  # (term, image_type) pairs with no more results
        for page in range(1, MAX_PAGES + 1):
            batches = []
            for term, image_type in itertools.product(TERMS, IMAGE_TYPES):
                if (term, image_type) in done:
                    continue
                hits = self._search(term, image_type, page)
                if len(hits) < PER_PAGE:
                    done.add((term, image_type))
                batches.append(hits)
            for hits in itertools.zip_longest(*batches):
                for hit in hits:
                    if hit is None:
                        continue
                    candidate_id = f"pixabay-{hit['id']}"
                    if candidate_id in seen:
                        continue
                    seen.add(candidate_id)
                    yield Candidate(
                        id=candidate_id, source='pixabay', image_url=hit['largeImageURL'],
                        page_url=hit['pageURL'], tags=hit.get('tags', ''), artist=hit.get('user', ''),
                        credit=f"Image by {hit.get('user', 'unknown')} on Pixabay",
                    )

    def download(self, candidate):
        return self._get(candidate.image_url).content
