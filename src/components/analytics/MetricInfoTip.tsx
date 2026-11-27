"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type MetricInfoContent = {
  measures: string;
  formula: string;
  variables: string;
  premise: string;
  /** Explicação por coluna (tabelas). */
  columns?: ReadonlyArray<{ name: string; detail: string }>;
};

type Props = {
  content: MetricInfoContent;
  /** Título curto para a11y */
  label: string;
};

/**
 * ⓘ com hover + clique para fixar (pitch). Renderiza em portal
 * para não ser cortado por overflow dos cards.
 */
export function MetricInfoTip({ content, label }: Props) {
  const tipId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  const wide = Boolean(content.columns?.length);

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(window.innerWidth - 16, wide ? 420 : 320);
    let left = r.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    let top = r.bottom + 8;
    const tipH = wide ? 360 : 220;
    if (top + tipH > window.innerHeight) {
      top = Math.max(8, r.top - 8 - tipH);
    }
    setCoords({ top, left });
  }, [wide]);

  const show = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

  const hide = useCallback(() => {
    if (!pinned) setOpen(false);
  }, [pinned]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinned(false);
        setOpen(false);
      }
    };
    const onDoc = (e: MouseEvent) => {
      if (!pinned) return;
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      const tip = document.getElementById(tipId);
      if (tip?.contains(t)) return;
      setPinned(false);
      setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open, pinned, place, tipId]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-extrabold leading-none transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ifood ${
          open || pinned
            ? "border-ifood bg-ifood text-white"
            : "border-ifood/70 bg-ifood-soft text-ifood hover:border-ifood hover:bg-ifood hover:text-white"
        }`}
        aria-label={`Info: ${label}`}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={() => {
          if (!pinned) setOpen(false);
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          place();
          setPinned((p) => {
            const next = !p;
            setOpen(next);
            return next;
          });
        }}
      >
        i
      </button>
      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={tipId}
            role="tooltip"
            className={`fixed z-[9999] max-h-[min(70vh,28rem)] overflow-y-auto rounded-if border border-[var(--ifdl-color-border)] bg-white p-3 text-left text-[11px] leading-relaxed text-ink shadow-if ${
              wide ? "w-[min(92vw,26rem)]" : "w-[min(92vw,20rem)]"
            }`}
            style={{ top: coords.top, left: coords.left }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={hide}
          >
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-ifood">
              O que mede
            </p>
            <p className="mt-0.5 text-muted">{content.measures}</p>
            <p className="mt-2 text-[10px] font-extrabold uppercase tracking-wide text-ifood">
              Como foi calculado
            </p>
            <p className="mt-0.5 font-semibold text-ink">{content.formula}</p>
            {content.columns && content.columns.length > 0 ? (
              <>
                <p className="mt-2 text-[10px] font-extrabold uppercase tracking-wide text-ifood">
                  Métricas / colunas
                </p>
                <p className="mt-0.5 text-[10px] text-muted">
                  O que é · como é gerada
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {content.columns.map((col) => (
                    <li key={col.name}>
                      <span className="font-extrabold text-ink">
                        {col.name}.
                      </span>{" "}
                      <span className="text-muted">{col.detail}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="mt-2 text-[10px] font-extrabold uppercase tracking-wide text-ifood">
                  Variáveis
                </p>
                <p className="mt-0.5 break-words font-mono text-[10px] text-muted">
                  {content.variables}
                </p>
              </>
            )}
            <p className="mt-2 text-[10px] font-extrabold uppercase tracking-wide text-ifood">
              Premissa
            </p>
            <p className="mt-0.5 text-muted">{content.premise}</p>
            {pinned && (
              <p className="mt-2 text-[10px] font-semibold text-muted">
                Fixado · clique fora ou Esc para fechar
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

export function ChartTitle({
  title,
  info,
}: {
  title: string;
  info: MetricInfoContent;
}) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="font-title text-lg font-extrabold leading-tight text-ink">
        {title}
      </h2>
      <MetricInfoTip label={title} content={info} />
    </div>
  );
}
