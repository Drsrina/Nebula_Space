/**
 * coordinates.ts — v2.7.5
 * 
 * Shared coordinate transformation functions between Viewport, 3D Canvas, and Minimap.
 * Provides bidirectional translation: Screen <-> World, bounding box conversions,
 * and cursor-anchored zoom calculations.
 */

export interface CameraTransform {
  x: number;
  y: number;
  z?: number;
  zoom: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface Rect2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Converts a screen point (pixels from viewport top-left)
 * to world coordinates on the canvas plane (Z=0).
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: CameraTransform,
  viewportWidth: number,
  viewportHeight: number
): Point2D {
  const centerX = viewportWidth / 2;
  const centerY = viewportHeight / 2;
  const zoom = camera.zoom || 1;

  return {
    x: (screenX - centerX) / zoom - camera.x,
    y: (screenY - centerY) / zoom - camera.y,
  };
}

/**
 * Converts a world point on the canvas plane (Z=0)
 * to screen coordinates (pixels from viewport top-left).
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: CameraTransform,
  viewportWidth: number,
  viewportHeight: number
): Point2D {
  const centerX = viewportWidth / 2;
  const centerY = viewportHeight / 2;
  const zoom = camera.zoom || 1;

  return {
    x: centerX + (worldX + camera.x) * zoom,
    y: centerY + (worldY + camera.y) * zoom,
  };
}

/**
 * Converts a world bounding box to screen coordinates.
 */
export function worldBoundsToScreen(
  bounds: Rect2D,
  camera: CameraTransform,
  viewportWidth: number,
  viewportHeight: number
): Rect2D {
  const topLeft = worldToScreen(bounds.x, bounds.y, camera, viewportWidth, viewportHeight);
  const zoom = camera.zoom || 1;
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bounds.width * zoom,
    height: bounds.height * zoom,
  };
}

/**
 * Calculates updated camera position and zoom maintaining the world point
 * under cursorScreenPos fixed on screen.
 */
export function calculateCursorZoom(
  currentCamera: { x: number; y: number; zoom: number },
  newZoom: number,
  cursorScreenPos: { x: number; y: number },
  viewportSize: { width: number; height: number }
): { x: number; y: number; zoom: number } {
  const oldZoom = currentCamera.zoom || 1;
  if (oldZoom === newZoom) {
    return { ...currentCamera, zoom: newZoom };
  }

  const centerX = viewportSize.width / 2;
  const centerY = viewportSize.height / 2;
  const offsetX = cursorScreenPos.x - centerX;
  const offsetY = cursorScreenPos.y - centerY;

  const factor = 1 / newZoom - 1 / oldZoom;
  const newX = currentCamera.x + offsetX * factor;
  const newY = currentCamera.y + offsetY * factor;

  return {
    x: Number(newX.toFixed(2)),
    y: Number(newY.toFixed(2)),
    zoom: newZoom,
  };
}
