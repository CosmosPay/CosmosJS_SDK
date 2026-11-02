/**
 * One segment of a request path, built from a caller's value (an id, a name). It is percent-encoded,
 * so `/`, `?` and `#` cannot add segments, a query or a fragment, and a value of `.` or `..` is
 * refused: encoding leaves dots as they are, and the URL parser would resolve them to another route
 * (`/transfers/../submit`).
 */
export function pathSegment(value: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('A path segment must be a non-empty string.');
  }
  if (value === '.' || value === '..') {
    throw new TypeError(`"${value}" is not a valid id.`);
  }
  return encodeURIComponent(value);
}
