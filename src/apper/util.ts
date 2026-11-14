export enum BoxRegion {
    NONE = 0b0000,
    POSITIVE_X = 0b0001,
    NEGATIVE_X = 0b0010,
    POSITIVE_Y = 0b0100,
    NEGATIVE_Y = 0b1000,
    INTERNAL = 0b010000,
    EXTERNAL = 0b100000,
    POSITIVE_X_POSITIVE_Y = 0b0101,
    POSITIVE_X_NEGATIVE_Y = 0b1001,
    NEGATIVE_X_POSITIVE_Y = 0b0110,
    NEGATIVE_X_NEGATIVE_Y = 0b1010,
    ALL_X = 0b0011,
    ALL_Y = 0b1100,
    INTERNAL_ALL = 0b011111,
    EXTERNAL_ALL = 0b101111,
}

export const resizeCursors: Record<number, string> = {
    [BoxRegion.POSITIVE_X]: "e-resize",
    [BoxRegion.NEGATIVE_X]: "w-resize",
    [BoxRegion.POSITIVE_Y]: "s-resize",
    [BoxRegion.NEGATIVE_Y]: "n-resize",
    [BoxRegion.POSITIVE_X_POSITIVE_Y]: "se-resize",
    [BoxRegion.POSITIVE_X_NEGATIVE_Y]: "ne-resize",
    [BoxRegion.NEGATIVE_X_POSITIVE_Y]: "sw-resize",
    [BoxRegion.NEGATIVE_X_NEGATIVE_Y]: "nw-resize",
};

export function getResizeCursor(boxRegion: BoxRegion): string | undefined {
    return resizeCursors[boxRegion];
}

let dummyCanvas: HTMLCanvasElement | null = null;

export function getTextMetrics(text: string, source: Element | string): TextMetrics {
    dummyCanvas ||= document.createElement("canvas");
    let ctx = dummyCanvas.getContext("2d");
    if (ctx === null) {
        throw new Error("2d rendering context not supported.");
    }

    if (source instanceof Element) {
        let style = window.getComputedStyle(source);
        ctx.font = `\
            ${style.getPropertyValue("font-weight") || "normal"} \
            ${style.getPropertyValue("font-size") || "14px"} \
            ${style.getPropertyValue("font-family") || "Nunito"}`;
    } else {
        ctx.font = source;
    }

    return ctx.measureText(text);
}

export function beforeUnloadHandler(event: BeforeUnloadEvent) {
    // Show the built-in "changes you made may not be saved" dialog
    event.preventDefault();
    event.returnValue = true; // Legacy support
}
