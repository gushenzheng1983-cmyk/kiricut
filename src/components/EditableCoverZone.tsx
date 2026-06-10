"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  clampCoverZoneRect,
  type CoverZoneRect,
} from "@/lib/coverZoneRect";

type Handle = "move" | "n" | "s" | "e" | "w";

interface EditableCoverZoneProps {
  rect: CoverZoneRect;
  displayWidth: number;
  displayHeight: number;
  coverColor: string;
  workspaceRef: RefObject<HTMLElement | null>;
  onRectChange: (rect: CoverZoneRect) => void;
}

interface DisplayState {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotationDeg: number;
}

function rectToDisplay(
  rect: CoverZoneRect,
  dw: number,
  dh: number
): DisplayState {
  const w = rect.widthPercent * dw;
  const h = rect.heightPercent * dh;
  return {
    centerX: (rect.xPercent + rect.widthPercent / 2) * dw,
    centerY: (rect.yPercent + rect.heightPercent / 2) * dh,
    width: w,
    height: h,
    rotationDeg: rect.rotationDeg ?? 0,
  };
}

function displayToRect(
  state: DisplayState,
  dw: number,
  dh: number
): CoverZoneRect {
  return clampCoverZoneRect({
    xPercent: (state.centerX - state.width / 2) / dw,
    yPercent: (state.centerY - state.height / 2) / dh,
    widthPercent: state.width / dw,
    heightPercent: state.height / dh,
    rotationDeg: state.rotationDeg,
  });
}

const MIN_DISPLAY = 24;
const NUDGE_PX = 6;
const SIZE_STEP_PX = 8;
const ROTATE_STEP = 3;
const PAD_MARGIN = 8;
const PAD_EST_HEIGHT = 220;
const PAD_EST_WIDTH = 200;

function clampPadPos(
  x: number,
  y: number,
  bounds: DOMRect,
  padW: number,
  padH: number
) {
  const minX = bounds.left + PAD_MARGIN;
  const minY = bounds.top + PAD_MARGIN;
  const maxX = bounds.right - padW - PAD_MARGIN;
  const maxY = bounds.bottom - padH - PAD_MARGIN;
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}

function defaultPadPos(bounds: DOMRect, padW: number, padH: number) {
  return clampPadPos(
    bounds.left + PAD_MARGIN,
    bounds.bottom - padH - PAD_MARGIN,
    bounds,
    padW,
    padH
  );
}

function padBtnCls(active = false) {
  return `flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border text-[11px] font-bold shadow-sm touch-none select-none ${
    active
      ? "border-amber-300/60 bg-amber-500/90 text-white"
      : "border-white/25 bg-black/70 text-white/90 hover:bg-black/85 active:scale-95"
  }`;
}

export default function EditableCoverZone({
  rect,
  displayWidth,
  displayHeight,
  coverColor,
  workspaceRef,
  onRectChange,
}: EditableCoverZoneProps) {
  const dragRef = useRef<{
    mode: Handle;
    startX: number;
    startY: number;
    start: DisplayState;
    pointerId: number;
  } | null>(null);
  const padDragRef = useRef<{
    startX: number;
    startY: number;
    startPadX: number;
    startPadY: number;
    pointerId: number;
  } | null>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const [local, setLocal] = useState(() =>
    rectToDisplay(rect, displayWidth, displayHeight)
  );
  const [padPos, setPadPos] = useState<{ x: number; y: number } | null>(null);
  const [padReady, setPadReady] = useState(false);
  const localRef = useRef(local);
  localRef.current = local;

  const syncPadPos = useCallback(() => {
    const bounds = workspaceRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const padW = padRef.current?.offsetWidth ?? PAD_EST_WIDTH;
    const padH = padRef.current?.offsetHeight ?? PAD_EST_HEIGHT;
    setPadPos((prev) => {
      if (!prev) return defaultPadPos(bounds, padW, padH);
      return clampPadPos(prev.x, prev.y, bounds, padW, padH);
    });
    setPadReady(true);
  }, [workspaceRef]);

  useEffect(() => {
    if (dragRef.current) return;
    setLocal(rectToDisplay(rect, displayWidth, displayHeight));
  }, [rect, displayWidth, displayHeight]);

  useLayoutEffect(() => {
    syncPadPos();
  }, [syncPadPos, displayWidth, displayHeight, padReady]);

  useEffect(() => {
    const root = workspaceRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => syncPadPos());
    observer.observe(root);
    window.addEventListener("resize", syncPadPos);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncPadPos);
    };
  }, [workspaceRef, syncPadPos]);

  const commit = useCallback(
    (next: DisplayState) => {
      setLocal(next);
      onRectChange(displayToRect(next, displayWidth, displayHeight));
    },
    [displayWidth, displayHeight, onRectChange]
  );

  const applyDrag = useCallback(
    (clientX: number, clientY: number) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = clientX - d.startX;
      const dy = clientY - d.startY;
      const s = d.start;

      if (d.mode === "move") {
        const pad = 4;
        commit({
          ...s,
          centerX: Math.min(
            displayWidth - pad,
            Math.max(pad, s.centerX + dx)
          ),
          centerY: Math.min(
            displayHeight - pad,
            Math.max(pad, s.centerY + dy)
          ),
        });
        return;
      }

      let w = s.width;
      let h = s.height;
      let cx = s.centerX;
      let cy = s.centerY;

      if (d.mode === "n") {
        const newH = Math.max(MIN_DISPLAY, s.height - dy);
        cy = s.centerY + (s.height - newH) / 2;
        h = newH;
      }
      if (d.mode === "s") {
        h = Math.max(MIN_DISPLAY, s.height + dy);
        cy = s.centerY + (h - s.height) / 2;
      }
      if (d.mode === "w") {
        const newW = Math.max(MIN_DISPLAY, s.width - dx);
        cx = s.centerX + (s.width - newW) / 2;
        w = newW;
      }
      if (d.mode === "e") {
        w = Math.max(MIN_DISPLAY, s.width + dx);
        cx = s.centerX + (w - s.width) / 2;
      }

      commit({
        ...s,
        width: w,
        height: h,
        centerX: Math.min(displayWidth - 4, Math.max(4, cx)),
        centerY: Math.min(displayHeight - 4, Math.max(4, cy)),
      });
    },
    [commit, displayWidth, displayHeight]
  );

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    const pointerId = dragRef.current.pointerId;
    dragRef.current = null;
    try {
      document.body.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const applyPadDrag = useCallback(
    (clientX: number, clientY: number) => {
      const d = padDragRef.current;
      const bounds = workspaceRef.current?.getBoundingClientRect();
      if (!d || !bounds) return;
      const el = padRef.current;
      const padW = el?.offsetWidth ?? PAD_EST_WIDTH;
      const padH = el?.offsetHeight ?? PAD_EST_HEIGHT;
      const dx = clientX - d.startX;
      const dy = clientY - d.startY;
      setPadPos(
        clampPadPos(
          d.startPadX + dx,
          d.startPadY + dy,
          bounds,
          padW,
          padH
        )
      );
    },
    [workspaceRef]
  );

  const endPadDrag = useCallback(() => {
    if (!padDragRef.current) return;
    const pointerId = padDragRef.current.pointerId;
    padDragRef.current = null;
    try {
      document.body.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (padDragRef.current && e.pointerId === padDragRef.current.pointerId) {
        applyPadDrag(e.clientX, e.clientY);
        return;
      }
      if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
      applyDrag(e.clientX, e.clientY);
    };
    const onUp = (e: PointerEvent) => {
      if (padDragRef.current && e.pointerId === padDragRef.current.pointerId) {
        endPadDrag();
        return;
      }
      if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
      endDrag();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [applyDrag, applyPadDrag, endDrag, endPadDrag]);

  const startPadDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!padPos) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    padDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPadX: padPos.x,
      startPadY: padPos.y,
      pointerId: e.pointerId,
    };
  };

  const startDrag = (mode: Handle) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      start: { ...localRef.current },
      pointerId: e.pointerId,
    };
  };

  const nudge = (patch: Partial<DisplayState>) => {
    commit({ ...localRef.current, ...patch });
  };

  const moveBy = (dx: number, dy: number) => {
    const s = localRef.current;
    nudge({
      centerX: Math.min(displayWidth - 4, Math.max(4, s.centerX + dx)),
      centerY: Math.min(displayHeight - 4, Math.max(4, s.centerY + dy)),
    });
  };

  const resizeBy = (dw: number, dh: number) => {
    const s = localRef.current;
    nudge({
      width: Math.max(MIN_DISPLAY, s.width + dw),
      height: Math.max(MIN_DISPLAY, s.height + dh),
    });
  };

  const rotateBy = (delta: number) => {
    const s = localRef.current;
    nudge({
      rotationDeg: Math.min(
        75,
        Math.max(-75, s.rotationDeg + delta)
      ),
    });
  };

  return (
    <>
      <div
        className="absolute touch-none"
        style={{
          left: local.centerX,
          top: local.centerY,
          width: local.width,
          height: local.height,
          transform: `translate(-50%, -50%) rotate(${local.rotationDeg}deg)`,
          transformOrigin: "center center",
        }}
      >
        <div
          className="absolute inset-0 cursor-move border-2 border-dashed border-red-500"
          style={{ backgroundColor: `${coverColor}99` }}
          onPointerDown={startDrag("move")}
        />
      </div>

      {padReady &&
        padPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={padRef}
            className="fixed z-[240] flex flex-col gap-1.5 rounded-xl border border-white/15 bg-black/80 p-2 shadow-2xl backdrop-blur-md"
            style={{ left: padPos.x, top: padPos.y }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div
              className="flex cursor-grab items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 active:cursor-grabbing"
              onPointerDown={startPadDrag}
              title="拖动到界面任意位置"
            >
              <p className="text-[9px] font-semibold text-white/70">⋮⋮ 框控制</p>
              <span className="text-[8px] text-white/40">全界面拖动</span>
            </div>

            <div className="flex items-center gap-1">
              <span className="w-7 text-[9px] text-white/45">移动</span>
              <button type="button" className={padBtnCls()} onClick={() => moveBy(0, -NUDGE_PX)} title="上移">
                ↑
              </button>
              <button type="button" className={padBtnCls()} onClick={() => moveBy(-NUDGE_PX, 0)} title="左移">
                ←
              </button>
              <button type="button" className={padBtnCls()} onClick={() => moveBy(NUDGE_PX, 0)} title="右移">
                →
              </button>
              <button type="button" className={padBtnCls()} onClick={() => moveBy(0, NUDGE_PX)} title="下移">
                ↓
              </button>
            </div>

            <div className="flex items-center gap-1">
              <span className="w-7 text-[9px] text-white/45">大小</span>
              <button type="button" className={padBtnCls()} onClick={() => resizeBy(-SIZE_STEP_PX, 0)} title="变窄">
                宽−
              </button>
              <button type="button" className={padBtnCls()} onClick={() => resizeBy(SIZE_STEP_PX, 0)} title="变宽">
                宽+
              </button>
              <button type="button" className={padBtnCls()} onClick={() => resizeBy(0, -SIZE_STEP_PX)} title="变矮">
                高−
              </button>
              <button type="button" className={padBtnCls()} onClick={() => resizeBy(0, SIZE_STEP_PX)} title="变高">
                高+
              </button>
            </div>

            <div className="flex items-center gap-1">
              <span className="w-7 text-[9px] text-white/45">角度</span>
              <button type="button" className={padBtnCls()} onClick={() => rotateBy(-ROTATE_STEP)} title="逆时针">
                ↺
              </button>
              <span className="min-w-[2.5rem] text-center font-mono text-[10px] text-amber-200">
                {local.rotationDeg}°
              </span>
              <button type="button" className={padBtnCls()} onClick={() => rotateBy(ROTATE_STEP)} title="顺时针">
                ↻
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 border-t border-white/10 pt-1.5">
              <button
                type="button"
                className={`${padBtnCls()} !h-8 col-span-2 cursor-ns-resize`}
                onPointerDown={startDrag("n")}
                title="拖动调高度(上)"
              >
                拖上边 ↑
              </button>
              <button
                type="button"
                className={`${padBtnCls()} !h-8 cursor-ew-resize`}
                onPointerDown={startDrag("w")}
                title="拖动调宽度(左)"
              >
                拖左边 ←
              </button>
              <button
                type="button"
                className={`${padBtnCls()} !h-8 cursor-ew-resize`}
                onPointerDown={startDrag("e")}
                title="拖动调宽度(右)"
              >
                拖右边 →
              </button>
              <button
                type="button"
                className={`${padBtnCls()} !h-8 col-span-2 cursor-ns-resize`}
                onPointerDown={startDrag("s")}
                title="拖动调高度(下)"
              >
                拖下边 ↓
              </button>
            </div>

            <p className="text-[8px] leading-snug text-white/35">
              可拖到全界面任意位置 · 拖红框移框
            </p>
          </div>,
          document.body
        )}
    </>
  );
}
