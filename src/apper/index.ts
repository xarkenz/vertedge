import "./assets/styles/style.css";

import icon_closeButton from "./assets/icons/close-button.svg";
import icon_toolbarToggler from "./assets/icons/toolbar-toggler.svg";

import { Vector2, Viewport, type Vector2Like } from "./math";
import { beforeUnloadHandler, getTextMetrics } from "./util";

export const config = {
    defaultMessageSeconds: 10,
};

export interface ApperWidget {
    readonly element: HTMLElement;
}

export interface ApperApplication extends ApperWidget {
    toolbar: Toolbar | null;
    update(): void;
    focusCanvas(): void;
}

export interface ApperResizeEvent {
    width: number;
    height: number;
}

export interface ApperInputEvent {
    altKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
}

export interface ApperMouseEvent extends ApperInputEvent {
    leftBtn: boolean;
    rightBtn: boolean;
    middleBtn: boolean;
}

export interface ApperMouseDownEvent extends ApperMouseEvent {
    isTouch: boolean;
    screenPos: Vector2;
    worldPos: Vector2;
    button: number;
}

export interface ApperMouseMoveEvent extends ApperMouseEvent {
    isTouch: boolean;
    onCanvas: boolean;
    screenPos: Vector2;
    worldPos: Vector2;
}

export interface ApperMouseUpEvent extends ApperMouseEvent {
    isTouch: boolean;
    button: number;
}

export interface ApperContextMenuEvent extends ApperMouseEvent {
    screenPos: Vector2;
    worldPos: Vector2;
    button: number;
}

export interface ApperWheelEvent extends ApperInputEvent {
    dx: number,
    dy: number,
}

export interface ApperKeyEvent extends ApperInputEvent {
    key: string;
}

export class GraphicalEditor {
    #element: HTMLElement;
    #canvas: HTMLCanvasElement;
    #ctx: CanvasRenderingContext2D;
    #title: HTMLInputElement;
    #defaultTitle: string;
    #view: Viewport;
    #cursorPos: Vector2;
    #cursorWorldPos: Vector2;
    #toolbar: Toolbar | null = null;
    #panels: Panel[] = [];
    #modals: Modal[] = [];
    #message: HTMLElement | null = null;
    #messageTimeout: number | null = null;
    #altKey: boolean = false;
    #ctrlKey: boolean = false;
    #shiftKey: boolean = false;
    #hasUnsavedChanges: boolean = false;

    updateCallback?: () => void;
    resizeCallback?: (event: ApperResizeEvent) => void;
    mouseDownCallback?: (event: ApperMouseDownEvent) => boolean;
    mouseMoveCallback?: (event: ApperMouseMoveEvent) => boolean;
    mouseUpCallback?: (event: ApperMouseUpEvent) => boolean;
    contextMenuCallback?: (event: ApperContextMenuEvent) => boolean;
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

        this.#view = new Viewport();
        this.#cursorPos = new Vector2(NaN);
        this.#cursorWorldPos = new Vector2(NaN);

        let ctx = this.#canvas.getContext("2d");
        if (!ctx) {
            throw new Error("2d rendering context not supported.");
        }
        this.#ctx = ctx;

        window.addEventListener("resize", this.#handleResize.bind(this), { passive: true });
        this.#canvas.addEventListener("mousedown", this.#handleMouseDown.bind(this), { passive: false });
        document.addEventListener("mousemove", this.#handleMouseMove.bind(this), { passive: true });
        document.addEventListener("mouseup", this.#handleMouseUp.bind(this), { capture: true, passive: true });
        this.#canvas.addEventListener("mouseleave", this.#handleMouseLeave.bind(this), { passive: true });
        this.#canvas.addEventListener("touchstart", this.#handleMouseDown.bind(this), { passive: false });
        document.addEventListener("touchmove", this.#handleMouseMove.bind(this), { passive: true });
        document.addEventListener("touchend", this.#handleMouseUp.bind(this), { passive: true });
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

    get scale(): number {
        return window.devicePixelRatio;
    }

    get cursorPos(): Vector2 {
        return this.#cursorPos.copy();
    }

    get cursorWorldPos(): Vector2 {
        return this.#cursorWorldPos.copy();
    }

    get toolbar(): Toolbar | null {
        return this.#toolbar;
    }

    get tool(): Tool | null {
        return this.#toolbar && this.#toolbar.tool;
    }

    set tool(tool: Tool | null) {
        if (this.#toolbar) {
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

    onUpdate(callback: () => void): this {
        this.updateCallback = callback;
        return this;
    }

    onResize(callback: (event: ApperResizeEvent) => void): this {
        this.resizeCallback = callback;
        return this;
    }

    onMouseDown(callback: (event: ApperMouseDownEvent) => boolean): this {
        this.mouseDownCallback = callback;
        return this;
    }

    onMouseMove(callback: (event: ApperMouseMoveEvent) => boolean): this {
        this.mouseMoveCallback = callback;
        return this;
    }

    onMouseUp(callback: (event: ApperMouseUpEvent) => boolean): this {
        this.mouseUpCallback = callback;
        return this;
    }

    onContextMenu(callback: (event: ApperContextMenuEvent) => boolean): this {
        this.contextMenuCallback = callback;
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

    #updateTitleWidth(): void {
        // FIXME: this doesn't really work properly when the document first loads for some reason
        this.#title.style.width = `${getTextMetrics(this.title, "normal 16px 'Nunito'").width + 12}px`;
    }

    showMessage(text: string, seconds: number | undefined = undefined, error: boolean = false): void {
        this.hideMessage();
        this.#message = document.createElement("div");
        this.#message.className = "apper-message";
        if (error) {
            this.#message.classList.add("apper-error");
        }
        this.#message.textContent = text;
        this.#element.appendChild(this.#message);
        window.setTimeout(() => this.#message?.classList?.add("apper-shown"));
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

    update(): void {
        this.#ctx.clearRect(0, 0, this.width, this.height);

        this.updateCallback?.();
    }

    #handleResize(): void {
        this.#canvas.width = this.width * this.scale;
        this.#canvas.height = this.height * this.scale;
        this.#ctx.resetTransform();
        this.#ctx.scale(this.scale, this.scale);
        this.#view.size.set(this.width, this.height);
        this.#view.scale = this.scale;

        let info = {
            width: this.width,
            height: this.height,
        };

        this.resizeCallback?.(info);

        this.update();
    }

    #handleMouseDown(event: MouseEvent | TouchEvent): void {
        let screenPos, buttons, button;
        if ("touches" in event) {
            let touch = event.touches[0];
            if (!touch) return;
            screenPos = new Vector2(touch.pageX, touch.pageY);
            buttons = 1;
            button = 0;
        } else {
            screenPos = new Vector2(event.pageX, event.pageY);
            buttons = event.buttons;
            button = event.button;
        }
        screenPos = screenPos.sub(this.element.offsetLeft, this.element.offsetTop);

        let info = {
            isTouch: "touches" in event,
            screenPos,
            worldPos: this.locate(screenPos),
            altKey: this.#altKey = event.altKey ?? this.#altKey,
            ctrlKey: this.#ctrlKey = (event.ctrlKey || event.metaKey) ?? this.#ctrlKey,
            shiftKey: this.#shiftKey = event.shiftKey ?? this.#shiftKey,
            leftBtn: !!(buttons & 1),
            rightBtn: !!(buttons & 2),
            middleBtn: !!(buttons & 4),
            button,
        };

        this.focusCanvas();
        this.#cursorPos.set(screenPos);
        this.#cursorWorldPos.set(info.worldPos);

        if (this.mouseDownCallback?.(info)) {
            event.preventDefault();
            event.stopPropagation();
        }

        this.update();
    }

    #handleMouseMove(event: MouseEvent | TouchEvent): void {
        let screenPos, buttons;
        if ("touches" in event) {
            let touch = event.touches[0];
            if (!touch) return;
            screenPos = new Vector2(touch.pageX, touch.pageY);
            buttons = 1;
        } else {
            screenPos = new Vector2(event.pageX, event.pageY);
            buttons = event.buttons;
        }
        screenPos = screenPos.sub(this.element.offsetLeft, this.element.offsetTop);

        let info = {
            isTouch: "touches" in event,
            onCanvas: event.target === this.#canvas,
            screenPos,
            worldPos: this.locate(screenPos),
            altKey: this.#altKey = event.altKey ?? this.#altKey,
            ctrlKey: this.#ctrlKey = (event.ctrlKey || event.metaKey) ?? this.#ctrlKey,
            shiftKey: this.#shiftKey = event.shiftKey ?? this.#shiftKey,
            leftBtn: !!(buttons & 1),
            rightBtn: !!(buttons & 2),
            middleBtn: !!(buttons & 4),
        };

        this.#cursorPos.set(screenPos);
        this.#cursorWorldPos.set(info.worldPos);

        if (this.mouseMoveCallback?.(info)) {
            this.update();
        }
    }

    #handleMouseUp(event: MouseEvent | TouchEvent): void {
        let buttons, button;
        if ("touches" in event) {
            buttons = 1;
            button = 0;
        } else {
            buttons = event.buttons;
            button = event.button;
        }

        let info = {
            isTouch: "touches" in event,
            altKey: this.#altKey = event.altKey ?? this.#altKey,
            ctrlKey: this.#ctrlKey = (event.ctrlKey || event.metaKey) ?? this.#ctrlKey,
            shiftKey: this.#shiftKey = event.shiftKey ?? this.#shiftKey,
            leftBtn: !!(buttons & 1),
            rightBtn: !!(buttons & 2),
            middleBtn: !!(buttons & 4),
            button,
        };

        if (this.mouseUpCallback?.(info)) {
            this.update();
        }
    }

    #handleMouseLeave(event: MouseEvent): void {
        if (event.buttons === 0) {
            this.#cursorPos.set(NaN);
            this.#cursorWorldPos.set(NaN);
            this.update();
        }
    }

    #handleContextMenu(event: PointerEvent): void {
        let screenPos = new Vector2(
            event.pageX - this.element.offsetLeft,
            event.pageY - this.element.offsetTop,
        );

        let info = {
            screenPos,
            worldPos: this.locate(screenPos),
            altKey: this.#altKey = event.altKey ?? this.#altKey,
            ctrlKey: this.#ctrlKey = (event.ctrlKey || event.metaKey) ?? this.#ctrlKey,
            shiftKey: this.#shiftKey = event.shiftKey ?? this.#shiftKey,
            leftBtn: !!(event.buttons & 1),
            rightBtn: !!(event.buttons & 2),
            middleBtn: !!(event.buttons & 4),
            button: event.button,
        };

        this.#cursorPos.set(screenPos);
        this.#cursorWorldPos.set(info.worldPos);

        if (this.contextMenuCallback?.(info)) {
            event.preventDefault();
            event.stopPropagation();
        }

        this.update();
    }

    #handleWheel(event: WheelEvent): void {
        let info = {
            altKey: this.#altKey = event.altKey ?? this.#altKey,
            ctrlKey: this.#ctrlKey = (event.ctrlKey || event.metaKey) ?? this.#ctrlKey,
            shiftKey: this.#shiftKey = event.shiftKey ?? this.#shiftKey,
            dx: event.deltaX,
            dy: event.deltaY,
        };

        if (this.wheelCallback?.(info)) {
            event.preventDefault();
            event.stopPropagation();

            this.update();
        }
    }

    #handleKeyDown(event: KeyboardEvent): void {
        if (event.target !== this.#canvas) {
            this.update();
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

        this.update();
    }

    #handleKeyUp(event: KeyboardEvent): void {
        if (event.target !== this.#canvas) {
            this.update();
            return;
        }

        let info = {
            altKey: this.#altKey = event.altKey ?? this.#altKey,
            ctrlKey: this.#ctrlKey = (event.ctrlKey || event.metaKey) ?? this.#ctrlKey,
            shiftKey: this.#shiftKey = event.shiftKey ?? this.#shiftKey,
            key: event.key,
        };

        if (this.keyUpCallback?.(info)) {}

        this.update();
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
    #toggler: HTMLElement;
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

        let togglerImg = document.createElement("img");
        togglerImg.className = "apper-toolbar-toggler";
        togglerImg.src = icon_toolbarToggler;
        togglerImg.addEventListener("click", () => this.toggleVisibility());
        this.#toggler = togglerImg;
        this.#app.element.appendChild(this.#toggler);
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
        this.#app.update();
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

        let button = document.createElement("div");
        button.className = "apper-toolbutton";
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
        button.appendChild(icon);

        let tip = document.createElement("div");
        tip.className = "apper-toolbutton-tip";
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
