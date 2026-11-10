import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isSinglePathSegment } from '../files/path-containment';

/**
 * CM-SYMLINK-01: refuses a session id route parameter that is not one plain
 * path segment, with 400 "Invalid session id", before the handler or any
 * service runs.
 *
 * Express decodes route parameters, so `%2E%2E` arrives as `..` and `a%2Fb`
 * as `a/b`. Services join the id onto the workspaces root, use it in docker
 * container names and in database rows; this check stops a bad id at the
 * controller instead of relying on each service. Real ids are UUIDs or base36
 * strings, which always pass.
 *
 * Pipes run after guards, so a request without the internal key still gets
 * 403 first.
 */
@Injectable()
export class SessionIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (!isSinglePathSegment(value)) {
      throw new BadRequestException('Invalid session id');
    }
    return value;
  }
}
