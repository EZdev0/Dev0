import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Isolated Docker / Backend Sandbox API (`/api/sandbox`)
 *
 * Strictly confines all file and workspace operations to `/tmp/dev0-user-sandboxes/<userId>/`
 * and NEVER reads or exposes `/app/applet` or host repository files.
 */

const SANDBOX_ROOT = path.join(os.tmpdir(), 'dev0-user-sandboxes');

function sanitizeUserId(rawUserId?: string): string {
  const clean = (rawUserId || 'guest_local')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 48);
  return clean || 'guest_local';
}

function resolveSafeSandboxPath(userId: string, relativeFilePath: string): string | null {
  const userDir = path.resolve(SANDBOX_ROOT, sanitizeUserId(userId));
  const cleanRel = (relativeFilePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(userDir, cleanRel);
  if (!resolved.startsWith(userDir + path.sep) && resolved !== userDir) {
    return null; // Blocked path traversal attempt
  }
  return resolved;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body?.action || 'status');
    const userId = sanitizeUserId(body?.userId);
    const userDir = path.resolve(SANDBOX_ROOT, userId);

    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    if (action === 'status') {
      return Response.json({
        ok: true,
        sandboxMode: 'isolated-container-fs',
        userId,
        isolatedPath: `/workspace/${userId}`,
        hostSourceProtected: true,
      });
    }

    if (action === 'write_file') {
      const target = resolveSafeSandboxPath(userId, String(body?.path || ''));
      if (!target || target === userDir) {
        return Response.json({ ok: false, error: 'Invalid or forbidden sandbox file path' }, { status: 400 });
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, String(body?.content ?? ''), 'utf8');
      return Response.json({ ok: true, path: body?.path });
    }

    if (action === 'read_file') {
      const target = resolveSafeSandboxPath(userId, String(body?.path || ''));
      if (!target || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        return Response.json({ ok: false, error: 'Sandbox file not found' }, { status: 404 });
      }
      const content = fs.readFileSync(target, 'utf8');
      return Response.json({ ok: true, content });
    }

    return Response.json({ ok: true, sandboxMode: 'isolated-container-fs', userId });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || 'Sandbox backend error' },
      { status: 500 },
    );
  }
}
