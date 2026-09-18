import { Router, Request, Response } from 'express';
import {
  getAllowedRoots,
  validateAndResolvePath,
  readOnlyGuard,
  rateLimitMiddleware,
} from '../lib/security';
import {
  listDirectory,
  readFile,
  writeFile,
  createDirectory,
  renamePath,
  deletePath,
  statPath,
  searchFiles,
  grepFiles,
} from '../lib/fsOperations';

export const fsRouter = Router();

// Apply rate limiting to all filesystem routes (autenticação centralizada em server.ts via requireAuth)
fsRouter.use(rateLimitMiddleware);

/**
 * GET /api/fs/roots
 * Lists all configured and permitted roots (from NEBULA_ROOTS)
 */
fsRouter.get('/roots', (req: Request, res: Response) => {
  try {
    const roots = getAllowedRoots();
    res.json({ roots });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list roots' });
  }
});

/**
 * GET /api/fs/list?path=/foo
 * Lists files and directories within a path
 */
fsRouter.get('/list', async (req: Request, res: Response) => {
  try {
    const rawPath = (req.query.path as string) || getAllowedRoots()[0]?.path;
    const check = validateAndResolvePath(rawPath);

    if (!check.valid) {
      res.status(403).json({ error: check.error });
      return;
    }

    const data = await listDirectory(check.resolvedPath);
    res.json(data);
  } catch (err: any) {
    res.status(err.code === 'ENOENT' ? 404 : 500).json({
      error: err.message || 'Failed to list directory',
    });
  }
});

/**
 * GET /api/fs/read?path=/foo/bar.txt
 * Reads text content (max 10MB)
 */
fsRouter.get('/read', async (req: Request, res: Response) => {
  try {
    const rawPath = req.query.path as string;
    const check = validateAndResolvePath(rawPath);

    if (!check.valid) {
      res.status(403).json({ error: check.error });
      return;
    }

    const data = await readFile(check.resolvedPath);
    res.json(data);
  } catch (err: any) {
    const status = err.statusCode || (err.code === 'ENOENT' ? 404 : 500);
    res.status(status).json({ error: err.message || 'Failed to read file' });
  }
});

/**
 * PUT /api/fs/write
 * Writes content to a file ({ path, content })
 */
fsRouter.put('/write', readOnlyGuard, async (req: Request, res: Response) => {
  try {
    const { path: rawPath, content } = req.body;
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'Body field "content" must be a string' });
      return;
    }

    const check = validateAndResolvePath(rawPath);
    if (!check.valid) {
      res.status(403).json({ error: check.error });
      return;
    }

    const result = await writeFile(check.resolvedPath, content);
    res.json({ ...result, path: check.resolvedPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to write file' });
  }
});

/**
 * POST /api/fs/mkdir
 * Creates a directory ({ path })
 */
fsRouter.post('/mkdir', readOnlyGuard, async (req: Request, res: Response) => {
  try {
    const { path: rawPath } = req.body;
    const check = validateAndResolvePath(rawPath);
    if (!check.valid) {
      res.status(403).json({ error: check.error });
      return;
    }

    const result = await createDirectory(check.resolvedPath);
    res.json({ ...result, path: check.resolvedPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create directory' });
  }
});

/**
 * POST /api/fs/rename
 * Renames / moves ({ from, to })
 */
fsRouter.post('/rename', readOnlyGuard, async (req: Request, res: Response) => {
  try {
    const { from: rawFrom, to: rawTo } = req.body;
    const checkFrom = validateAndResolvePath(rawFrom);
    const checkTo = validateAndResolvePath(rawTo);

    if (!checkFrom.valid) {
      res.status(403).json({ error: `Source: ${checkFrom.error}` });
      return;
    }
    if (!checkTo.valid) {
      res.status(403).json({ error: `Destination: ${checkTo.error}` });
      return;
    }

    const result = await renamePath(checkFrom.resolvedPath, checkTo.resolvedPath);
    res.json({ ...result, from: checkFrom.resolvedPath, to: checkTo.resolvedPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to rename path' });
  }
});

/**
 * DELETE /api/fs/delete?path=/foo/bar
 * Removes file or directory
 */
fsRouter.delete('/delete', readOnlyGuard, async (req: Request, res: Response) => {
  try {
    const rawPath = (req.query.path as string) || req.body?.path;
    const check = validateAndResolvePath(rawPath);

    if (!check.valid) {
      res.status(403).json({ error: check.error });
      return;
    }

    // Never allow deleting an allowed root itself
    const roots = getAllowedRoots();
    if (roots.some((r) => r.path === check.resolvedPath)) {
      res.status(403).json({ error: 'Deleting a configured root directory is strictly forbidden.' });
      return;
    }

    const result = await deletePath(check.resolvedPath);
    res.json({ ...result, path: check.resolvedPath });
  } catch (err: any) {
    res.status(err.code === 'ENOENT' ? 404 : 500).json({
      error: err.message || 'Failed to delete path',
    });
  }
});

/**
 * GET /api/fs/stat?path=/foo
 * Returns metadata (size, mtime, isDir, mode, etc.)
 */
fsRouter.get('/stat', async (req: Request, res: Response) => {
  try {
    const rawPath = req.query.path as string;
    const check = validateAndResolvePath(rawPath);

    if (!check.valid) {
      res.status(403).json({ error: check.error });
      return;
    }

    const data = await statPath(check.resolvedPath);
    res.json(data);
  } catch (err: any) {
    res.status(err.code === 'ENOENT' ? 404 : 500).json({
      error: err.message || 'Failed to stat path',
    });
  }
});

/**
 * GET /api/fs/search?path=/foo&q=bar
 * Recursive search by file/folder name
 */
fsRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const rawPath = (req.query.path as string) || getAllowedRoots()[0]?.path;
    const q = (req.query.q as string) || '';

    if (!q || q.trim() === '') {
      res.json({ basePath: rawPath, query: '', results: [], total: 0 });
      return;
    }

    const check = validateAndResolvePath(rawPath);
    if (!check.valid) {
      res.status(403).json({ error: check.error });
      return;
    }

    const data = await searchFiles(check.resolvedPath, q.trim());
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to search files' });
  }
});

/**
 * GET /api/fs/grep?path=/foo&q=bar
 * Searches text content across files in workspace
 */
fsRouter.get('/grep', async (req: Request, res: Response) => {
  try {
    const rawPath = (req.query.path as string) || getAllowedRoots()[0]?.path;
    const q = (req.query.q as string) || '';

    if (!q || q.trim() === '') {
      res.json({ basePath: rawPath, query: '', matches: [], totalFiles: 0, totalMatches: 0 });
      return;
    }

    const check = validateAndResolvePath(rawPath);
    if (!check.valid) {
      res.status(403).json({ error: check.error });
      return;
    }

    const data = await grepFiles(check.resolvedPath, q.trim());
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to grep files' });
  }
});

