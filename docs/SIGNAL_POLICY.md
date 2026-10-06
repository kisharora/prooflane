# Signal policy v1.0.0

The score is a prioritization heuristic, not a probability or verification.

Start at 10. Add 25 for paid-work language, 20 for project-shaped scope, 20 for a provider-displayed age of at most 30 days when it is not a lower bound, 10 for remote language without a detected restriction, and 10 for a matched follow-up. Subtract 15 for a displayed age over 60 days, 25 for remote-location restrictions, 15 for employment-only language, 30 for an evergreen talent roster, 20 for a broad directory, and 60 for matched closure language. Clamp between 0 and 95.

Promising requires payment language, scope, a recent non-lower-bound displayed date, a score of at least 65, and no caution condition. Broad directory pages cannot be promising. Closure language, evergreen rosters, detected location restrictions, and employment-only signals go to caution. Remaining candidates need checking.

The evidence drawer preserves source excerpts and identifies discovery versus corroboration. A displayed result date can reflect a later update or reply. Provider search timestamps identify when the provider searched, not when a role was published. An unknown date remains unknown. A lower-bound date such as “30+ days ago” does not earn a freshness bonus.

Canonicalization removes common tracking parameters and fragments, normalizes `www`, and preserves meaningful query parameters. Duplicates retain their excerpts. Exact canonical identity can match follow-up results. For forums and common job platforms, no weaker path-only or title match is accepted. For other sites, the host must match and at least three distinctive title tokens must overlap at 85% or more. These heuristics reduce, but do not eliminate, false matches.

Limitations include English-only keyword rules, imperfect negation handling, incomplete snippets, changing content, and imperfect title matching. A missing match does not establish closure. A positive match does not establish availability. Users must inspect original sources.
