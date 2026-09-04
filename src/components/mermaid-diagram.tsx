import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Download, Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  code: string;
  isIncomplete?: boolean;
  language?: string;
  meta?: string;
};

let idCounter = 0;

async function renderMermaid(source: string): Promise<string> {
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    securityLevel: "strict",
    fontFamily: "'DotGothic16', monospace",
    suppressErrorRendering: true,
    themeVariables: {
      primaryColor: "#ffffff",
      primaryTextColor: "#1e3a8a",
      primaryBorderColor: "#1e3a8a",
      lineColor: "#1e3a8a",
      secondaryColor: "#fde68a",
      tertiaryColor: "#ffffff",
      fontSize: "13px",
    },
  });
  idCounter += 1;
  const { svg } = await mermaid.render(`mermaid-diagram-${idCounter}`, source);
  return svg;
}

/** Copy that still works when the async clipboard API is blocked (iframes, no focus). */
async function copyText(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch {
    window.open(url, "_blank", "noopener");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function svgDimensions(svg: string) {
  const width = Number(svg.match(/width="([\d.]+)"/)?.[1] ?? 0);
  const height = Number(svg.match(/height="([\d.]+)"/)?.[1] ?? 0);
  const viewBox = svg.match(/viewBox="([\d.\-\s]+)"/)?.[1]?.trim().split(/\s+/).map(Number);
  return {
    width: width || viewBox?.[2] || 1200,
    height: height || viewBox?.[3] || 800,
  };
}

async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const { width, height } = svgDimensions(svg);
  const source = svg.includes("xmlns=")
    ? svg
    : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not rasterise the diagram"));
    image.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))), "image/png");
  });
}

export function MermaidDiagram({ code, isIncomplete }: Props) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const lastRendered = useRef("");

  useEffect(() => {
    if (isIncomplete || !code.trim()) return;
    if (lastRendered.current === code) return;
    let cancelled = false;
    lastRendered.current = code;
    renderMermaid(code)
      .then((result) => {
        if (!cancelled) {
          setSvg(result);
          setError(null);
        }
      })
      .catch((renderError: Error) => {
        if (!cancelled) setError(renderError.message);
      });
    return () => {
      cancelled = true;
    };
  }, [code, isIncomplete]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const copy = useCallback(async () => {
    const ok = await copyText(code);
    if (ok) toast.success("Diagram source copied");
    else toast.error("Copy blocked by the browser — select the text manually");
  }, [code]);

  const downloadSvg = useCallback(() => {
    if (!svg) return;
    saveBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), "diagram.svg");
    toast.success("Downloading diagram.svg");
  }, [svg]);

  const downloadPng = useCallback(async () => {
    if (!svg) return;
    try {
      const blob = await svgToPng(svg);
      saveBlob(blob, "diagram.png");
      toast.success("Downloading diagram.png");
    } catch (pngError) {
      toast.error((pngError as Error).message);
    }
  }, [svg]);

  const downloadSource = useCallback(() => {
    saveBlob(new Blob([code], { type: "text/plain;charset=utf-8" }), "diagram.mmd");
    toast.success("Downloading diagram.mmd");
  }, [code]);

  const toolbar = (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={() => void copy()} title="Copy diagram source">
        <Copy className="size-3.5" /> Copy
      </Button>
      <Button variant="ghost" size="sm" onClick={downloadSvg} disabled={!svg} title="Download SVG">
        <Download className="size-3.5" /> SVG
      </Button>
      <Button variant="ghost" size="sm" onClick={() => void downloadPng()} disabled={!svg} title="Download PNG">
        <Download className="size-3.5" /> PNG
      </Button>
      <Button variant="ghost" size="sm" onClick={downloadSource} title="Download Mermaid source">
        <Download className="size-3.5" /> .mmd
      </Button>
      {!open && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setZoom(1);
            setOpen(true);
          }}
          disabled={!svg}
          title="Maximise"
        >
          <Maximize2 className="size-3.5" />
        </Button>
      )}
    </div>
  );

  return (
    <>
      <figure className="panel my-4 w-full overflow-hidden">
        <figcaption className="flex items-center justify-between gap-2 border-b-2 border-border bg-secondary px-2 py-1">
          <span className="label-mono text-muted-foreground">diagram</span>
          {toolbar}
        </figcaption>
        <div className="overflow-x-auto bg-background p-3">
          {error && <p className="text-sm text-destructive">Diagram error: {error}</p>}
          {!error && !svg && (
            <p className="label-mono text-muted-foreground">
              {isIncomplete ? "Drawing…" : "Rendering…"}
            </p>
          )}
          {!error && svg && (
            <div
              className="[&_svg]:h-auto [&_svg]:max-w-full"
              // Mermaid output is generated from the model's own fenced block and
              // rendered with securityLevel "strict", which strips scripts.
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
        </div>
      </figure>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Diagram fullscreen"
          className="fixed inset-0 z-[100] flex flex-col bg-background"
        >
          <div className="flex items-center justify-between gap-2 border-b-2 border-border bg-secondary px-3 py-2">
            <span className="label-mono text-muted-foreground">diagram — fullscreen</span>
            <div className="flex items-center gap-1">
              {toolbar}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom((value) => Math.max(0.25, value - 0.25))}
                title="Zoom out"
              >
                <Minus className="size-3.5" />
              </Button>
              <span className="label-mono w-10 text-center text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom((value) => Math.min(4, value + 0.25))}
                title="Zoom in"
              >
                <Plus className="size-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setZoom(1)} title="Reset zoom">
                <RotateCcw className="size-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} title="Close">
                <X className="size-4" />
              </Button>
            </div>
          </div>
          <div className={cn("min-h-0 flex-1 overflow-auto bg-background p-6")}>
            <div
              style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
              className="[&_svg]:h-auto [&_svg]:max-w-none"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      )}
    </>
  );
}
