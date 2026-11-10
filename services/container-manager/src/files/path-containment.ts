import * as path from 'path';

/**
 * The parts of Node's path module the containment checks use. Tests pass
 * path.posix or path.win32 to check both platforms' rules on any host.
 */
export type PathModule = Pick<typeof path, 'resolve' | 'relative' | 'isAbsolute' | 'sep'>;

/**
 * True when `candidate` is `root` itself or strictly inside it, after both
 * are resolved (CM-PATH-01).
 *
 * Uses path.relative instead of a string prefix, so `/workspaces/abc` does
 * not contain the sibling `/workspaces/abcX`. A candidate on another drive
 * (Windows) gives an absolute relative path and is refused. A name that only
 * begins with two dots, such as `..config`, stays inside.
 *
 * Lexical only: symlinks are not followed.
 */
export function isPathInside(
  root: string,
  candidate: string,
  pathImpl: PathModule = path,
): boolean {
  const relative = pathImpl.relative(pathImpl.resolve(root), pathImpl.resolve(candidate));
  if (relative === '') {
    return true;
  }
  if (pathImpl.isAbsolute(relative)) {
    return false;
  }
  return relative !== '..' && !relative.startsWith(`..${pathImpl.sep}`);
}

/**
 * True when `name` is one plain path segment: not empty, not `.` or `..`,
 * and without `/`, `\` or NUL. Joining such a name onto a directory always
 * gives a direct child of that directory (CM-PATH-01).
 */
export function isSinglePathSegment(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name !== '.' &&
    name !== '..' &&
    !/[\\/\u0000]/.test(name)
  );
}
