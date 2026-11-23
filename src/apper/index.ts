import "./assets/styles/style.css";

import icon_closeButton from "./assets/icons/close-button.svg";
import icon_toolbarToggler from "./assets/icons/toolbar-toggler.svg";

import { Vector2, Viewport, type Vector2Like } from "./math";
import { beforeUnloadHandler, getTextMetrics } from "./util";

export const config = {
    defaultMessageSeconds: 10,
    scrollZoomMultiplier: 0.0005,
    minPinchDistance: 4,
};

export interface ApperWidget {
    readonly element: HTMLElement;
}

export interface ApperApplication extends ApperWidget {
    toolbar: Toolbar | null;
    redraw(): void;
    focusCanvas(): void;
}

export interface ApperResizeEvent {
    width: number;
    height: number;
}

export interface ApperDragEvent {
    x: number;
    y: number;
    button: number;
}

export interface ApperWheelEvent {
    dx: number;
    dy: number;
}

export interface ApperKeyEvent {
    key: string;
}

interface ModifierKeys {
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
}

interface PointerState {
    id: number;
    x: number;
    y: number;
    button: number;
}

type Gesture = {
    type: "reset", // All input ignored until no more active pointers left.
} | {
    type: "none", // No active pointers, hovering is tracked.
} | {
    type: "drag", // One active pointer currently dragging.
    id: number,
    startState: Omit<PointerState, "id">,
} | {
    type: "view", // Two active pointers panning/zooming the viewport.
    id1: number,
    id2: number,
    startView: Viewport,
    startMidpoint: Vector2,
    startDistance: number,
};

const resetGesture = () => ({
    type: "reset" as const,
});
const noneGesture = () => ({
    type: "none" as const,
});
const dragGesture = (pointer: PointerState) => ({
    type: "drag" as const,
    id: pointer.id,
    startState: {
        x: pointer.x,
        y: pointer.y,
        button: pointer.button,
    },
});
const viewGesture = (pointer1: PointerState, pointer2: PointerState, view: Viewport) => ({
    type: "view" as const,
    id1: pointer1.id,
    id2: pointer2.id,
    startView: view.copy(),
    startMidpoint: Vector2.midpoint(pointer1, pointer2),
    startDistance: Math.max(config.minPinchDistance, Vector2.distance(pointer1, pointer2)) * view.zoom,
});

export class GraphicalEditor {
    #element: HTMLElement;
    #canvas: HTMLCanvasElement;
    #ctx: CanvasRenderingContext2D;
    #title: HTMLInputElement;
    #defaultTitle: string;
    #view: Viewport = new Viewport();
    #activePointers: Map<number, PointerState> = new Map();
    #currentGesture: Gesture = noneGesture();
    #hoverPos: Vector2 | null = null;
    #toolbar: Toolbar | null = null;
    #panels: Panel[] = [];
    #modals: Modal[] = [];
    #message: HTMLElement | null = null;
    #messageTimeout: number | null = null;
    #altKey: boolean = false;
    #ctrlKey: boolean = false;
    #shiftKey: boolean = false;
    #hasUnsavedChanges: boolean = false;

    redrawCallback?: () => void;
    resizeCallback?: (event: ApperResizeEvent) => void;
    hoverMoveCallback?: () => boolean;
    dragStartCallback?: (event: ApperDragEvent) => boolean;
    dragMoveCallback?: (event: ApperDragEvent) => boolean;
    dragFinishCallback?: (event: ApperDragEvent) => boolean;
    dragCancelCallback?: (event: ApperDragEvent) => boolean;
    wheelCallback?: (event: ApperWheelEvent) => boolean;
    keyDownCallback?: (event: ApperKeyEvent) => boolean;
    keyUpCallback?: (event: ApperKeyEvent) => boolean;

    constructor(element: HTMLElement) {
        this.#element = element;
        this.#element.classList.add("apper");

        this.#canvas = document.createElement("canvas");
        this.#canvas.tabIndex = -1; // Allows the canvas to have focus
        this.#canvas.width = 0;
        this.#canvas.height = 0;
        this.#element.appendChild(this.#canvas);

        this.#title = document.createElement("input");
        this.#title.className = "apper-title";
        this.#title.type = "text";
        this.#defaultTitle = "";
        this.#title.value = "";
        this.#title.spellcheck = false;
        this.#title.autocomplete = "off";
        this.#title.addEventListener("input", () => {
            this.#updateTitleWidth();
        }, { passive: true });
        this.#title.addEventListener("blur", () => {
            this.title ||= this.defaultTitle();
            this.#updateTitleWidth();
        }, { passive: true });
        this.#title.addEventListener("keypress", (event) => {
            if (event.key === "Enter") {
                this.focusCanvas();
            }
        }, { passive: true });
        this.#element.appendChild(this.#title);
        this.#updateTitleWidth();

        let ctx = this.#canvas.getContext("2d");
        if (!ctx) {
            throw new Error("2d rendering context not supported!");
        }
        this.#ctx = ctx;

        // TODO: is window resize really the right event to listen for?
        window.addEventListener("resize", this.#handleResize.bind(this), { passive: true });
        this.#canvas.addEventListener("pointerdown", this.#handlePointerDown.bind(this), { passive: false });
        this.#canvas.addEventListener("pointermove", this.#handlePointerMove.bind(this), { passive: true });
        this.#canvas.addEventListener("pointerup", this.#handlePointerUp.bind(this), { passive: true });
        this.#canvas.addEventListener("pointercancel", this.#handlePointerCancel.bind(this), { passive: true });
        this.#canvas.addEventListener("pointerleave", this.#handlePointerLeave.bind(this), { passive: true });
        this.#canvas.addEventListener("contextmenu", this.#handleContextMenu.bind(this), { passive: false });
        this.#canvas.addEventListener("wheel", this.#handleWheel.bind(this), { passive: false });
        document.addEventListener("keydown", this.#handleKeyDown.bind(this), { capture: true, passive: false });
        document.addEventListener("keyup", this.#handleKeyUp.bind(this), { capture: true, passive: true });
        document.fonts.addEventListener("loadingdone", this.#updateTitleWidth.bind(this), { passive: true });

        this.#handleResize();
    }

    get element(): HTMLElement {
        return this.#element;
    }

    get canvas(): HTMLCanvasElement {
        return this.#canvas;
    }

    get ctx(): CanvasRenderingContext2D {
        return this.#ctx;
    }

    get width(): number {
        return this.#element.clientWidth;
    }

    get height(): number {
        return this.#element.clientHeight;
    }

    get title(): string {
        return this.#title.value;
    }

    set title(text: string) {
        this.#title.value = text;
        this.#updateTitleWidth();
    }

    defaultTitle(): string {
        return this.#defaultTitle;
    }

    setDefaultTitle(text: string): this {
        this.title ||= text;
        this.#defaultTitle = text;
        return this;
    }

    get view(): Viewport {
        return this.#view;
    }

    get hoverPos(): Vector2 | null {
        return this.#hoverPos && this.#hoverPos.copy();
    }

    get toolbar(): Toolbar | null {
        return this.#toolbar;
    }

    get tool(): Tool | null {
        return this.#toolbar && this.#toolbar.tool;
    }

    set tool(tool: Tool | null) {
        if (this.#toolbar) {
            if (this.#toolbar.tool != tool) {
                this.invalidateDrag();
            }
            this.#toolbar.tool = tool;
        }
    }

    get altKey(): boolean {
        return this.#altKey;
    }

    get ctrlKey(): boolean {
        return this.#ctrlKey;
    }

    get shiftKey(): boolean {
        return this.#shiftKey;
    }

    get hasUnsavedChanges(): boolean {
        return this.#hasUnsavedChanges;
    }

    set hasUnsavedChanges(unsaved: boolean) {
        if (unsaved) {
            window.addEventListener("beforeunload", beforeUnloadHandler);
        } else {
            window.removeEventListener("beforeunload", beforeUnloadHandler);
        }
        this.#hasUnsavedChanges = unsaved;
    }

    onRedraw(callback: () => void): this {
        this.redrawCallback = callback;
        return this;
    }

    onResize(callback: (event: ApperResizeEvent) => void): this {
        this.resizeCallback = callback;
        return this;
    }

    onHoverMove(callback: () => boolean): this {
        this.hoverMoveCallback = callback;
        return this;
    }

    onDragStart(callback: (event: ApperDragEvent) => boolean): this {
        this.dragStartCallback = callback;
        return this;
    }

    onDragMove(callback: (event: ApperDragEvent) => boolean): this {
        this.dragMoveCallback = callback;
        return this;
    }

    onDragFinish(callback: (event: ApperDragEvent) => boolean): this {
        this.dragFinishCallback = callback;
        return this;
    }

    onDragCancel(callback: (event: ApperDragEvent) => boolean): this {
        this.dragCancelCallback = callback;
        return this;
    }

    onWheel(callback: (event: ApperWheelEvent) => boolean): this {
        this.wheelCallback = callback;
        return this;
    }

    onKeyDown(callback: (event: ApperKeyEvent) => boolean): this {
        this.keyDownCallback = callback;
        return this;
    }

    onKeyUp(callback: (event: ApperKeyEvent) => boolean): this {
        this.keyUpCallback = callback;
        return this;
    }

    addToolbar(): Toolbar {
        this.#toolbar ||= new Toolbar(this);
        return this.#toolbar;
    }

    addPanel(title: string = ""): Panel {
        let panel = new Panel(this, title);
        return this.#panels[panel.id] = panel;
    }

    addModal(title: string = ""): Modal {
        let modal = new Modal(this, title);
        return this.#modals[modal.id] = modal;
    }

    focusCanvas(): void {
        this.#canvas.focus();
    }

    invalidateDrag(): void {
        if (this.#currentGesture.type === "drag") {
            let { startState } = this.#currentGesture;
            this.#currentGesture = resetGesture();
            this.#hoverPos = null;
            if (this.dragCancelCallback?.(startState)) {
                this.redraw();
            }
        }
    }

    #updateTitleWidth(): void {
        this.#title.style.width = `${getTextMetrics(this.title, "normal 16px 'Nunito'").width + 12}px`;
    }

    showMessage(text: string, seconds: number | undefined = undefined, error: boolean = false): void {
        this.hideMessage();
        this.#message = document.createElement("div");
        this.#message.className = "apper-message apper-shown";
        if (error) {
            this.#message.classList.add("apper-error");
        }
        this.#message.textContent = text;
        this.#element.appendChild(this.#message);
        this.#messageTimeout = window.setTimeout(() => this.hideMessage(), (seconds ?? config.defaultMessageSeconds) * 1000);
    }

    showError(text: string, seconds: number | undefined = undefined): void {
        this.showMessage(text, seconds, true);
    }

    hideMessage(): void {
        if (this.#messageTimeout == null || this.#message == null) {
            return;
        }
        window.clearTimeout(this.#messageTimeout);
        this.#messageTimeout = null;
        let message = this.#message;
        this.#message = null;
        message.classList.remove("apper-shown");
        let failsafeTimeout = window.setTimeout(() => message.remove(), config.defaultMessageSeconds * 1000);
        message.addEventListener("transitionend", () => {
            window.clearTimeout(failsafeTimeout);
            message.remove();
        }, { once: true, passive: true });
    }

    transform(worldPos: Vector2Like): Vector2 {
        return this.#view.transform(worldPos);
    }

    transformX(worldX: number): number {
        return this.#view.transformX(worldX);
    }

    transformY(worldY: number): number {
        return this.#view.transformY(worldY);
    }

    locate(screenPos: Vector2Like): Vector2 {
        return this.#view.locate(screenPos);
    }

    locateX(screenX: number): number {
        return this.#view.locateX(screenX);
    }

    locateY(screenY: number): number {
        return this.#view.locateY(screenY);
    }

    redraw(): void {
        this.#ctx.clearRect(0, 0, this.width, this.height);

        this.redrawCallback?.();
    }

    #handleResize(): void {
        let scale = window.devicePixelRatio;
        this.#canvas.width = this.width * scale;
        this.#canvas.height = this.height * scale;
        this.#ctx.resetTransform();
        this.#ctx.scale(scale, scale);
        this.#view.size.set(this.width, this.height);
        this.#view.scale = scale;

        let info = {
            width: this.width,
            height: this.height,
        };

        this.resizeCallback?.(info);

        this.redraw();
    }

    #updateModifiers(mods: ModifierKeys): void {
        this.#altKey = mods.altKey;
        this.#ctrlKey = mods.ctrlKey || mods.metaKey;
        this.#shiftKey = mods.shiftKey;
    }

    #updateGesture(): void {
        let activePointers = [...this.#activePointers.values()];

        if (this.#currentGesture.type === "none") {
            if (activePointers.length === 1) {
                let pointer = activePointers[0]!;
                this.#currentGesture = dragGesture(pointer);
                this.#hoverPos = new Vector2(pointer);
                if (this.dragStartCallback?.(pointer)) {
                    this.redraw();
                }
            }
            else if (activePointers.length !== 0) {
                console.log("Programmer error: more than 1 new pointer at once in none gesture!");
            }
        }
        else if (this.#currentGesture.type === "drag") {
            if (activePointers.length === 0) {
                let { startState } = this.#currentGesture;
                this.#currentGesture = noneGesture();
                if (this.dragFinishCallback?.(startState)) {
                    this.redraw();
                }
            }
            else if (activePointers.length === 1) {
                let pointer = activePointers[0]!;
                if (pointer.id !== this.#currentGesture.id) {
                    console.error("Programmer error: pointer ID mismatch detected during drag gesture!");
                }
                this.#hoverPos = new Vector2(pointer);
                if (this.dragMoveCallback?.(pointer)) {
                    this.redraw();
                }
            }
            else if (activePointers.length === 2) {
                let pointer1 = activePointers[0]!;
                let pointer2 = activePointers[1]!;
                if (pointer1.id !== this.#currentGesture.id) {
                    [pointer1, pointer2] = [pointer2, pointer1];
                }
                if (pointer1.id !== this.#currentGesture.id) {
                    console.error("Programmer error: pointer ID mismatch detected during transition from drag to view gesture!");
                }
                let { startState } = this.#currentGesture;
                this.#currentGesture = viewGesture(pointer1, pointer2, this.#view);
                this.#hoverPos = null;
                if (this.dragCancelCallback?.(startState)) {
                    this.redraw();
                }
            }
            else {
                console.log("Programmer error: more than 1 new pointer at once in drag gesture!");
            }
        }
        else if (this.#currentGesture.type === "view") {
            if (activePointers.length === 2) {
                let pointer1 = activePointers[0]!;
                let pointer2 = activePointers[1]!;
                if (pointer1.id !== this.#currentGesture.id1) {
                    [pointer1, pointer2] = [pointer2, pointer1];
                }
                if (pointer1.id !== this.#currentGesture.id1 || pointer2.id !== this.#currentGesture.id2) {
                    console.error("Programmer error: pointer ID mismatch detected during view gesture!");
                }
                // Calculate the new viewport center and zoom level
                let midpoint = Vector2.midpoint(pointer1, pointer2);
                let distance = Math.max(config.minPinchDistance, Vector2.distance(pointer1, pointer2));
                let zoomChange = distance / this.#currentGesture.startDistance;
                this.#view.center.set(this.#currentGesture.startView.center.add(this.#currentGesture.startMidpoint.sub(midpoint).div(zoomChange)));
                this.#view.zoom = this.#currentGesture.startView.zoom * zoomChange;
            }
            else {
                this.#currentGesture = resetGesture();
            }
            this.redraw();
        }
        else { // reset
            if (activePointers.length === 0) {
                this.#currentGesture = noneGesture();
            }
        }
    }

    #handlePointerDown(event: PointerEvent): void {
        event.stopPropagation();
        event.preventDefault();

        let pointerX = event.pageX - this.#element.offsetLeft;
        let pointerY = event.pageY - this.#element.offsetTop;

        this.#canvas.setPointerCapture(event.pointerId);
        this.focusCanvas();

        this.#activePointers.set(event.pointerId, {
            id: event.pointerId,
            x: pointerX,
            y: pointerY,
            button: event.button,
        });
        this.#updateGesture();
    }

    #handlePointerMove(event: PointerEvent): void {
        let pointerX = event.pageX - this.#element.offsetLeft;
        let pointerY = event.pageY - this.#element.offsetTop;

        let activePointer = this.#activePointers.get(event.pointerId);
        if (activePointer) {
            activePointer.x = pointerX;
            activePointer.y = pointerY;
            this.#updateGesture();
        }
        else if (this.#activePointers.size === 0) {
            // TODO: This assumes at most one hovering pointer. Unlikely to have
            // TODO: more than that, but it's not guaranteed.
            this.#hoverPos = new Vector2(pointerX, pointerY);
            if (this.hoverMoveCallback?.()) {
                this.redraw();
            }
        }
    }

    #handlePointerUp(event: PointerEvent): void {
        this.#activePointers.delete(event.pointerId);
        this.#updateGesture();
    }

    #handlePointerCancel(event: PointerEvent): void {
        // FIXME: This should actually cancel the current gesture and reset.
        this.#activePointers.delete(event.pointerId);
        this.#updateGesture();
    }

    #handlePointerLeave(event: PointerEvent): void {
        // It's fine to check that there are no active pointers here. The spec
        // states that pointerleave is always fired after pointerup, so any
        // changes to the current gesture are already processed.
        if (this.#activePointers.size === 0) {
            this.#hoverPos = null;
            if (this.hoverMoveCallback?.()) {
                this.redraw();
            }
        }
    }

    #handleContextMenu(event: PointerEvent): void {
        event.preventDefault();
        event.stopPropagation();
    }

    #handleWheel(event: WheelEvent): void {
        event.preventDefault();
        event.stopPropagation();

        let info = {
            altKey: this.#altKey = event.altKey ?? this.#altKey,
            ctrlKey: this.#ctrlKey = (event.ctrlKey || event.metaKey) ?? this.#ctrlKey,
            shiftKey: this.#shiftKey = event.shiftKey ?? this.#shiftKey,
            dx: event.deltaX,
            dy: event.deltaY,
        };

        if (this.wheelCallback?.(info)) {
            this.redraw();
        }
    }

    #handleKeyDown(event: KeyboardEvent): void {
        this.#updateModifiers(event);
        if (event.target !== this.#canvas) {
            this.redraw();
            return;
        }

        let info = {
            altKey: this.#altKey = event.altKey ?? this.#altKey,
            ctrlKey: this.#ctrlKey = (event.ctrlKey || event.metaKey) ?? this.#ctrlKey,
            shiftKey: this.#shiftKey = event.shiftKey ?? this.#shiftKey,
            key: event.key,
        };

        if (this.keyDownCallback?.(info)) {
            event.preventDefault();
            event.stopPropagation();
        }

        this.redraw();
    }

    #handleKeyUp(event: KeyboardEvent): void {
        this.#updateModifiers(event);
        if (event.target !== this.#canvas) {
            this.redraw();
            return;
        }

        let info = {
            altKey: this.#altKey = event.altKey ?? this.#altKey,
            ctrlKey: this.#ctrlKey = (event.ctrlKey || event.metaKey) ?? this.#ctrlKey,
            shiftKey: this.#shiftKey = event.shiftKey ?? this.#shiftKey,
            key: event.key,
        };

        if (this.keyUpCallback?.(info)) {}

        this.redraw();
    }
}


// TODO: method for testing key state
export class Shortcut {
    #key: string;
    #ctrl: boolean;
    #alt: boolean;
    #shift: boolean;

    constructor(key: string, mods: { ctrl?: boolean, alt?: boolean, shift?: boolean } | undefined = undefined) {
        this.#key = key;
        this.#ctrl = !!mods?.ctrl;
        this.#alt = !!mods?.alt;
        this.#shift = !!mods?.shift;
    }

    toString(): string {
        let name = this.#key.toUpperCase();
        if (this.#shift) {
            name = "Shift+" + name;
        }
        if (this.#alt) {
            name = "Alt+" + name;
        }
        if (this.#ctrl) {
            name = "Ctrl+" + name;
        }
        return name;
    }
}


var nextToolID: number = 0;
var toolList: Tool[] = [];

export class Tool {
    #id: number;
    #name: string;
    #displayName: string;
    #icon: string;
    #shortcut: Shortcut | null;

    get id(): number { return this.#id; }
    get name(): string { return this.#name; }
    get displayName(): string { return this.#displayName; }
    get icon(): string { return this.#icon; }
    get shortcut(): Shortcut | null { return this.#shortcut; }

    constructor(name: string, displayName: string, icon: string, shortcut: Shortcut | null = null) {
        this.#id = nextToolID++;
        this.#name = name;
        this.#displayName = displayName;
        this.#icon = icon;
        this.#shortcut = shortcut;

        toolList.push(this);
    }
}


export class Toolbar {
    #app: ApperApplication;
    #element: HTMLElement;
    #buttons: HTMLElement[] = [];
    #tools: number[] = [];
    #tool: number = NaN;
    #defaultTool: number = NaN;

    get app(): ApperApplication { return this.#app; }
    get element(): HTMLElement { return this.#element; }
    get tools(): number[] { return this.#tools; }

    constructor(app: ApperApplication, shown: boolean = true) {
        this.#app = app;

        this.#element = document.createElement("div");
        this.#element.className = "apper-toolbar";
        this.#app.element.appendChild(this.#element);
        if (shown) {
            this.#element.classList.add("apper-shown");
        }

        let toggler = document.createElement("button");
        toggler.className = "apper-toolbar-toggler";
        toggler.ariaLabel = "Show/Hide Toolbar";
        toggler.addEventListener("click", this.toggleVisibility.bind(this));
        let togglerImg = document.createElement("img");
        togglerImg.src = icon_toolbarToggler;
        togglerImg.draggable = false;
        toggler.appendChild(togglerImg);
        this.#app.element.appendChild(toggler);
    }

    get tool(): Tool | null {
        return toolList[this.#tool] || null;
    }

    set tool(tool: Tool | null) {
        this.#tool = tool ? tool.id : NaN;
        this.#update();
    }

    get defaultTool(): Tool | null {
        return toolList[this.#defaultTool] || null;
    }

    set defaultTool(tool: Tool | null) {
        this.#defaultTool = tool ? tool.id: NaN;
    }

    #update(): void {
        this.#buttons.forEach(button => button.classList.remove("apper-button-selected"));
        let selectedButton = this.#buttons[this.#tool];
        if (selectedButton) {
            selectedButton.classList.add("apper-button-selected");
        }
        this.#app.redraw();
    }

    show(): this {
        this.#element.classList.add("apper-shown");
        return this;
    }

    hide(): this {
        this.#element.classList.remove("apper-shown");
        return this;
    }

    toggleVisibility(): this {
        this.#element.classList.toggle("apper-shown");
        return this;
    }

    addTool(tool: Tool, setDefault: boolean = false): this {
        this.#tools.push(tool.id);
        if (setDefault) {
            this.#tool = this.#defaultTool = tool.id;
        }

        let button = document.createElement("button");
        button.className = "apper-toolbutton";
        button.ariaLabel = tool.displayName;
        if (this.#tool === tool.id) {
            button.classList.add("apper-button-selected");
        }
        button.addEventListener("click", () => {
            this.#tool = this.#tool === tool.id ? this.#defaultTool : tool.id;
            button.blur();
            this.#app.focusCanvas();
            this.#update();
        }, { passive: true });
        this.#element.appendChild(button);
        this.#buttons[tool.id] = button;

        let icon = document.createElement("img");
        icon.src = tool.icon;
        icon.draggable = false;
        button.appendChild(icon);

        let tip = document.createElement("div");
        tip.className = "apper-toolbutton-tip";
        tip.role = "tooltip";
        button.ariaDescribedByElements = [tip];
        tip.textContent = tool.displayName;
        button.appendChild(tip);

        if (tool.shortcut) {
            let hint = document.createElement("span");
            hint.textContent = tool.shortcut.toString().toLowerCase();
            tip.appendChild(hint);
        }

        return this;
    }

    addSpacer(): this {
        let spacer = document.createElement("div");
        spacer.className = "apper-toolbar-spacer";
        this.#element.appendChild(spacer);
        return this;
    }
}


var nextPanelID: number = 0;

export class Panel {
    #id: number;
    #app: ApperApplication;
    #frame: HTMLElement;
    #element: HTMLElement;
    #title: HTMLElement;

    get id(): number { return this.#id; }
    get app(): ApperApplication { return this.#app; }
    get element(): HTMLElement { return this.#element; }
    get title(): string { return this.#title.textContent; }
    set title(text: string) { this.#title.textContent = text; }

    constructor(app: ApperApplication, title: string = "") {
        this.#id = nextPanelID++;
        this.#app = app;

        this.#frame = document.createElement("div");
        this.#frame.className = "apper-panel";
        this.#frame.style.visibility = "hidden";
        this.#frame.addEventListener("transitionend", () => {
            if (!this.#frame.classList.contains("apper-shown")) {
                this.#frame.style.visibility = "hidden";
            }
        }, { passive: true });
        this.#app.element.appendChild(this.#frame);

        this.#title = document.createElement("span");
        this.#title.className = "apper-panel-title";
        this.#title.textContent = title;
        this.#frame.appendChild(this.#title);

        this.#element = document.createElement("div");
        this.#frame.appendChild(this.#element);
    }

    show(): this {
        this.#frame.style.visibility = "visible";
        this.#frame.classList.add("apper-shown");
        return this;
    }

    hide(): this {
        this.#frame.classList.remove("apper-shown");
        return this;
    }

    add(widget: ApperWidget): this {
        this.#element.appendChild(widget.element);
        return this;
    }

    addSeparator(): this {
        let separator = document.createElement("span");
        separator.className = "apper-separator";
        this.#element.appendChild(separator);
        return this;
    }
}


var nextModalID: number = 0;

export class Modal {
    #id: number;
    #app: ApperApplication;
    #frame: HTMLElement;
    #element: HTMLElement;
    #title: HTMLElement;

    get id(): number { return this.#id; }
    get app(): ApperApplication { return this.#app; }
    get element(): HTMLElement { return this.#element; }
    get title(): string { return this.#title.textContent; }
    set title(text: string) { this.#title.textContent = text; }

    constructor(app: ApperApplication, title: string = "") {
        this.#id = nextModalID++;
        this.#app = app;

        this.#frame = document.createElement("div");
        this.#frame.className = "apper-modal";
        this.#frame.style.visibility = "hidden";
        this.#frame.addEventListener("transitionend", () => {
            if (!this.#frame.classList.contains("apper-shown")) {
                this.#frame.style.visibility = "hidden";
            }
        }, { passive: true });
        this.#app.element.appendChild(this.#frame);

        this.#title = document.createElement("span");
        this.#title.className = "apper-modal-title";
        this.#title.textContent = title;
        this.#frame.appendChild(this.#title);

        let closeButton = document.createElement("img");
        closeButton.className = "apper-close-button";
        closeButton.src = icon_closeButton;
        closeButton.draggable = false;
        closeButton.addEventListener("click", () => {
            this.hide();
            let toolbar = this.app.toolbar;
            if (toolbar) {
                toolbar.tool = toolbar.defaultTool;
            }
        });
        this.#frame.appendChild(closeButton);

        this.#element = document.createElement("div");
        this.#frame.appendChild(this.#element);
    }

    show(): this {
        this.#frame.style.visibility = "visible";
        this.#frame.classList.add("apper-shown");
        return this;
    }

    hide(): this {
        this.#frame.classList.remove("apper-shown");
        return this;
    }

    add(widget: ApperWidget): this {
        this.#element.appendChild(widget.element);
        return this;
    }

    addSeparator(): this {
        let separator = document.createElement("span");
        separator.className = "apper-separator";
        this.#element.appendChild(separator);
        return this;
    }
}
