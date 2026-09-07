import { useCallback, useRef, useState } from "react";

/**
 * Drag-to-reorder for a grid of tiles.
 *
 * **Pointer Events, not the HTML5 drag-and-drop API.** `draggable` + dragstart
 * does not fire on touch at all, so a native-drag implementation simply has no
 * reordering on a tablet - not degraded, absent. Pointer events are one API for
 * mouse, touch and pen.
 *
 * The tiles reorder *live* as the pointer crosses them, rather than showing a
 * drop indicator and moving once on release. It means the arrangement on screen
 * is always the arrangement that will be saved, so there is nothing to predict.
 *
 * Deliberately not the only way to reorder. There is no keyboard gesture for
 * "pick this up and move it two places left", so the arrow buttons stay - this
 * is the comfortable path, not the sole one.
 */
export interface DragReorder {
  /** Index currently being dragged, for styling. */
  draggingIndex: number | null;
  /** Spread onto each tile. */
  tileProps: (index: number) => {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
    "data-drag-index": number;
  };
}

/** Below this, a press is a click on whatever is under it, not a drag. */
const DRAG_THRESHOLD_PX = 4;

export function useDragReorder(
  onReorder: (from: number, to: number) => void,
  // Supplied by the caller rather than created here: the grid already carries a
  // ref for returning focus after an arrow press, and two refs on one element
  // means one of them silently wins.
  containerRef: React.RefObject<HTMLDivElement | null>,
): DragReorder {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // Refs rather than state: these change during a pointer move and must not
  // each cost a render while the pointer is down.
  const current = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const armed = useRef(false);

  /** Which tile is under the pointer, by its own recorded index. */
  const indexUnder = useCallback((x: number, y: number): number | null => {
    const container = containerRef.current;
    if (!container) return null;

    for (const el of container.querySelectorAll<HTMLElement>("[data-drag-index]")) {
      const box = el.getBoundingClientRect();
      if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
        const index = Number(el.dataset.dragIndex);
        return Number.isNaN(index) ? null : index;
      }
    }
    return null;
    // containerRef is listed even though a ref identity never changes: the
    // React Compiler refuses to optimise a component whose inferred and stated
    // dependencies disagree, and being right by accident is not worth the
    // warning.
  }, [containerRef]);

  const tileProps = useCallback(
    (index: number) => ({
      "data-drag-index": index,

      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        // Never from a control. The delete, primary and arrow buttons live
        // inside the tile, and starting a drag from them would swallow the
        // click that was actually intended.
        if ((e.target as HTMLElement).closest("button")) return;
        if (e.button !== 0 && e.pointerType === "mouse") return;

        current.current = index;
        origin.current = { x: e.clientX, y: e.clientY };
        armed.current = false;
        e.currentTarget.setPointerCapture(e.pointerId);
      },

      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        if (current.current === null || origin.current === null) return;

        if (!armed.current) {
          const moved =
            Math.abs(e.clientX - origin.current.x) +
            Math.abs(e.clientY - origin.current.y);
          if (moved < DRAG_THRESHOLD_PX) return;
          armed.current = true;
          setDraggingIndex(current.current);
        }

        const over = indexUnder(e.clientX, e.clientY);
        if (over === null || over === current.current) return;

        onReorder(current.current, over);
        // The dragged tile now lives where it was dropped, so subsequent moves
        // are measured from there.
        current.current = over;
        setDraggingIndex(over);
      },

      onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        current.current = null;
        origin.current = null;
        armed.current = false;
        setDraggingIndex(null);
      },

      onPointerCancel: (e: React.PointerEvent<HTMLElement>) => {
        // A cancelled pointer - the browser taking over for a scroll, a call
        // arriving - must not leave a tile stuck in its dragging state.
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        current.current = null;
        origin.current = null;
        armed.current = false;
        setDraggingIndex(null);
      },
    }),
    [indexUnder, onReorder],
  );

  return { draggingIndex, tileProps };
}
