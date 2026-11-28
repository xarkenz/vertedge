import type { GraphDrawingContext } from "./util";

export const SVG_NS = "http://www.w3.org/2000/svg";

export function svgNew(x: number, y: number, w: number, h: number): SVGSVGElement {
    let svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("xmlns", SVG_NS);
    svg.setAttribute("version", "1.1");
    svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
    svg.setAttribute("width", w.toString());
    svg.setAttribute("height", h.toString());
    return svg;
}

export function svgCreateChild<K extends keyof SVGElementTagNameMap>(parent: SVGElement, type: K): SVGElementTagNameMap[K] {
    let child = document.createElementNS(SVG_NS, type);
    parent.appendChild(child);
    return child;
}

export function svgToDataURL(svg: SVGSVGElement): string {
    return "data:image/svg+xml," + encodeURIComponent(svg.outerHTML);
}

type PathCommand = {
    type: "move",
    x: number, y: number,
} | {
    type: "line",
    x: number, y: number,
} | {
    type: "quadratic",
    cpx: number, cpy: number,
    x: number, y: number,
} | {
    type: "cubic",
    cp1x: number, cp1y: number,
    cp2x: number, cp2y: number,
    x: number, y: number,
} | {
    type: "close",
} | {
    type: "rect",
    x: number, y: number,
    w: number, h: number,
} | {
    type: "arc",
    cx: number, cy: number,
    rx: number, ry: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise: boolean,
};

const TWO_PI = 2 * Math.PI;

function modTwoPi(angle: number): number {
    let modulo = angle % TWO_PI;
    return modulo < 0 ? modulo + TWO_PI : modulo;
}

function serializePath(path: PathCommand[]): string {
    let emptySubpath = true;
    return path.map(command => {
        switch (command.type) {
            case "move": {
                let { x, y } = command;
                emptySubpath = false;
                return `M ${x},${y}`;
            }
            case "line": {
                let { x, y } = command;
                emptySubpath = false;
                return `L ${x},${y}`;
            }
            case "quadratic": {
                let { cpx, cpy, x, y } = command;
                emptySubpath = false;
                return `Q ${cpx},${cpy} ${x},${y}`;
            }
            case "cubic": {
                let { cp1x, cp1y, cp2x, cp2y, x, y } = command;
                emptySubpath = false;
                return `C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x},${y}`;
            }
            case "close": {
                emptySubpath = true;
                return "Z";
            }
            case "rect": {
                let { x, y, w, h } = command;
                emptySubpath = false;
                return `M ${x},${y} h ${w} v ${h} H ${x} Z`;
            }
            case "arc": {
                // Unfortunately, it takes a decent amount of work to convert
                // canvas arcs/ellipses to SVG arc commands.
                let { cx, cy, rx, ry, rotation, startAngle, endAngle, counterclockwise } = command;

                let cosRotation = Math.cos(rotation);
                let sinRotation = -Math.sin(rotation);
                const ellipseOffset = (angle: number) => {
                    let angleX = rx * Math.cos(angle);
                    let angleY = ry * -Math.sin(angle);
                    return {
                        x: angleX * cosRotation - angleY * sinRotation,
                        y: angleX * sinRotation + angleY * cosRotation,
                    };
                };

                let startOffset = ellipseOffset(startAngle);
                let startX = cx + startOffset.x;
                let startY = cy + startOffset.y;
                let prefix = `${emptySubpath ? "M" : "L"} ${startX},${startY}`;
                emptySubpath = false;

                // This check is lifted straight from the HTML Canvas spec.
                let angleSpan = counterclockwise ? startAngle - endAngle : endAngle - startAngle;
                if (angleSpan >= 2 * Math.PI) {
                    // Whole ellipse. This has to be represented in SVG as two
                    // half arcs due to limitations of the arc command.
                    let midX = cx - startOffset.x;
                    let midY = cy - startOffset.y;
                    return `${prefix} A ${rx},${ry} ${rotation} 0 0 ${midX},${midY} A ${rx},${ry} ${rotation} 0 0 ${startX},${startY}`;
                } else {
                    // Elliptical arc. This can be represented in SVG without
                    // much trouble, but we have to calculate the arc flags.
                    let endOffset = ellipseOffset(endAngle);
                    let endX = cx + endOffset.x;
                    let endY = cy + endOffset.y;
                    let largeArcFlag = modTwoPi(angleSpan) > Math.PI ? "1" : "0";
                    let sweepFlag = counterclockwise ? "1" : "0";
                    return `${prefix} A ${rx},${ry} ${rotation} ${largeArcFlag} ${sweepFlag} ${endX},${endY}`;
                }
            }
        }
    }).join(" ");
}

function anyInvalid(...values: number[]): boolean {
    return values.some(value => isNaN(value) || !isFinite(value));
}

export class SVGGraphDrawingContext implements GraphDrawingContext {
    fillStyle: string | CanvasGradient | CanvasPattern = "#000000";
    strokeStyle: string | CanvasGradient | CanvasPattern = "#000000";
    globalAlpha: number = 1;
    lineWidth: number = 1;
    lineCap: CanvasLineCap = "butt";
    lineJoin: CanvasLineJoin = "miter";
    miterLimit: number = 10;
    #lineDash: number[] = [];
    lineDashOffset: number = 0;

    #svg: SVGSVGElement;
    #path: PathCommand[] = [];

    constructor(x: number, y: number, w: number, h: number) {
        this.#svg = svgNew(x, y, w, h);
    }

    getLineDash(): number[] {
        return this.#lineDash.slice();
    }

    setLineDash(segments: number[]): void {
        this.#lineDash = segments.slice();
    }

    toDataURL(): string {
        return svgToDataURL(this.#svg);
    }

    beginPath(): void {
        this.#path = [];
    }

    fill(): void {
        let svgPath = svgCreateChild(this.#svg, "path");
        if (typeof this.fillStyle !== "string") {
            throw new Error("Gradients/Patterns not yet implemented.");
        }
        svgPath.setAttribute("fill", this.fillStyle);
        svgPath.setAttribute("stroke", "none");
        if (this.globalAlpha < 1) {
            svgPath.setAttribute("fill-opacity", this.globalAlpha.toString());
        }
        svgPath.setAttribute("d", serializePath(this.#path));
    }

    stroke(): void {
        let svgPath = svgCreateChild(this.#svg, "path");
        svgPath.setAttribute("fill", "none");
        if (typeof this.strokeStyle !== "string") {
            throw new Error("Gradients/Patterns not yet implemented.");
        }
        svgPath.setAttribute("stroke", this.strokeStyle);
        if (this.globalAlpha < 1) {
            svgPath.setAttribute("stroke-opacity", this.globalAlpha.toString());
        }
        svgPath.setAttribute("stroke-width", this.lineWidth.toString());
        svgPath.setAttribute("stroke-linecap", this.lineCap);
        svgPath.setAttribute("stroke-linejoin", this.lineJoin);
        if (this.lineJoin === "miter") {
            svgPath.setAttribute("stroke-miterlimit", this.miterLimit.toString());
        }
        svgPath.setAttribute("stroke-dasharray", this.#lineDash.join(" "));
        if (this.#lineDash.length > 0) {
            svgPath.setAttribute("stroke-dashoffset", this.lineDashOffset.toString());
        }
        svgPath.setAttribute("d", serializePath(this.#path));
    }

    moveTo(x: number, y: number): void {
        if (anyInvalid(x, y)) return;
        this.#path.push({
            type: "move",
            x, y,
        });
    }

    lineTo(x: number, y: number): void {
        if (anyInvalid(x, y)) return;
        this.#path.push({
            type: "line",
            x, y,
        });
    }

    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
        if (anyInvalid(cpx, cpy, x, y)) return;
        this.#path.push({
            type: "quadratic",
            cpx, cpy,
            x, y,
        });
    }

    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
        if (anyInvalid(cp1x, cp1y, cp2x, cp2y, x, y)) return;
        this.#path.push({
            type: "cubic",
            cp1x, cp1y,
            cp2x, cp2y,
            x, y,
        });
    }

    closePath(): void {
        this.#path.push({
            type: "close",
        });
    }

    rect(x: number, y: number, w: number, h: number): void {
        if (anyInvalid(x, y, w, h)) return;
        this.#path.push({
            type: "rect",
            x, y,
            w, h,
        });
    }

    ellipse(cx: number, cy: number, rx: number, ry: number, rotation: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
        if (anyInvalid(cx, cy, rx, ry, rotation, startAngle, endAngle)) return;
        if (rx < 0 || ry < 0) {
            throw new RangeError("Negative radius");
        }
        this.#path.push({
            type: "arc",
            cx, cy,
            rx, ry,
            rotation,
            startAngle,
            endAngle,
            counterclockwise: !!counterclockwise,
        });
    }

    arc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
        this.ellipse(cx, cy, r, r, 0, startAngle, endAngle, counterclockwise);
    }
}
