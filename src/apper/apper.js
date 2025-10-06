var apper = apper || (() => {
    const NAME = "apper";

    const config = {
        toString() { return NAME + ".config"; },
        assetsRoot: "./assets/apper/",
        defaultMessageSeconds: 10,
    };

    function getAsset(path) {
        return config.assetsRoot + path;
    }


    const util = (parent => {
        const NAME = parent + ".util";

        class Iterator {
            static toString() { return NAME + ".Iterator"; }

            constructor() {
                if (new.target === Iterator) {
                    throw new TypeError(`${Iterator} represents an abstract class and cannot be constructed directly; use from() instead`);
                }
            }

            static from(object) {
                if (object instanceof Iterator) {
                    return object;
                } else {
                    return new DefaultIterator(object[Symbol.iterator]?.() ?? object);
                }
            }

            drop(limit) {
                limit = Math.trunc(limit);
                if (!(limit >= 0)) {
                    throw new RangeError(`${Iterator}.drop(): invalid limit value: ${limit}`)
                }
                return Iterator.from({
                    inner: this,
                    count: 0,
                    limit,
                    next() {
                        let next;
                        while (!(next = this.inner.next()).done && this.count < this.limit) {
                            this.count++;
                        }
                        return next;
                    }
                });
            }

            every(callbackFn) {
                let nextIndex = 0;
                let next;
                while (!(next = this.next()).done) {
                    if (!callbackFn(next.value, nextIndex++)) {
                        return false;
                    }
                }
                return true;
            }

            filter(callbackFn) {
                return Iterator.from({
                    inner: this,
                    callbackFn,
                    nextIndex: 0,
                    next() {
                        let next;
                        while (!(next = this.inner.next()).done && !this.callbackFn(next.value, this.nextIndex++));
                        return next;
                    }
                });
            }

            find(callbackFn) {
                let nextIndex = 0;
                let next;
                while (!(next = this.next()).done) {
                    let value = next.value;
                    if (callbackFn(value, nextIndex++)) {
                        return value;
                    }
                }
                return undefined;
            }

            flatMap(callbackFn) {
                return Iterator.from({
                    inner: this,
                    current: null,
                    callbackFn,
                    nextIndex: 0,
                    next() {
                        let next;
                        while (!this.current || (next = this.current.next()).done) {
                            if (!(next = this.inner.next()).done) {
                                this.current = Iterator.from(this.callbackFn(next.value, this.nextIndex++));
                            }
                            else {
                                return next;
                            }
                        }
                        return next;
                    }
                });
            }

            forEach(callbackFn) {
                let nextIndex = 0;
                let next;
                while (!(next = this.next()).done) {
                    callbackFn(next.value, nextIndex++);
                }
            }

            map(callbackFn) {
                return Iterator.from({
                    inner: this,
                    callbackFn,
                    nextIndex: 0,
                    next() {
                        let next;
                        if (!(next = this.inner.next()).done) {
                            return { value: this.callbackFn(next.value, this.nextIndex++), done: false };
                        }
                        return next;
                    }
                });
            }

            reduce(callbackFn, initialValue = undefined) {
                let accumulator = initialValue;
                let nextIndex = 0;
                let next;
                if (initialValue === undefined) {
                    if ((next = this.next()).done) {
                        throw new TypeError(`${Iterator}.reduce(): called on empty iterator with no initial value specified`);
                    }
                    accumulator = next.value;
                    nextIndex++;
                }
                while (!(next = this.next()).done) {
                    accumulator = callbackFn(accumulator, next.value, nextIndex++);
                }
                return accumulator;
            }

            some(callbackFn) {
                let nextIndex = 0;
                let next;
                while (!(next = this.next()).done) {
                    if (callbackFn(next.value, nextIndex++)) {
                        return true;
                    }
                }
                return false;
            }

            take(limit) {
                limit = Math.trunc(limit);
                if (!(limit >= 0)) {
                    throw new RangeError(`${Iterator}.take(): invalid limit value: ${limit}`)
                }
                return Iterator.from({
                    inner: this,
                    count: 0,
                    limit,
                    next() {
                        if (this.count >= this.limit) {
                            return { value: undefined, done: true };
                        } else {
                            this.count++;
                            return this.inner.next();
                        }
                    }
                });
            }

            toArray() {
                return Array.from(this);
            }

            [Symbol.iterator]() {
                return this;
            }
        }

        class DefaultIterator extends Iterator {
            #inner;

            constructor(inner) {
                super();
                this.#inner = inner;
            }

            next() {
                return this.#inner.next();
            }

            return() {
                return this.#inner.return?.() ?? { value: undefined, done: true };
            }
        }

        const reverseIterator = Symbol(NAME + ".reverseIterator");

        class ArrayReverseIterator extends Iterator {
            #array;
            #nextIndex;

            constructor(array) {
                super();
                this.#array = array;
                this.#nextIndex = array.length - 1;
            }

            next() {
                if (this.#nextIndex < 0) {
                    return { value: undefined, done: true };
                } else {
                    return { value: this.#array[this.#nextIndex--], done: false };
                }
            }
        }

        Array.prototype[reverseIterator] = function() {
            return new ArrayReverseIterator(this);
        };

        
        const BoxRegion = {
            NONE: 0b0000,
            POSITIVE_X: 0b0001,
            NEGATIVE_X: 0b0010,
            POSITIVE_Y: 0b0100,
            NEGATIVE_Y: 0b1000,
            INTERNAL: 0b010000,
            EXTERNAL: 0b100000,
            POSITIVE_X_POSITIVE_Y: 0b0101,
            POSITIVE_X_NEGATIVE_Y: 0b1001,
            NEGATIVE_X_POSITIVE_Y: 0b0110,
            NEGATIVE_X_NEGATIVE_Y: 0b1010,
            ALL_X: 0b0011,
            ALL_Y: 0b1100,
            INTERNAL_ALL: 0b011111,
            EXTERNAL_ALL: 0b101111,
        };

        const resizeCursors = {
            [BoxRegion.POSITIVE_X]: "e-resize",
            [BoxRegion.NEGATIVE_X]: "w-resize",
            [BoxRegion.POSITIVE_Y]: "s-resize",
            [BoxRegion.NEGATIVE_Y]: "n-resize",
            [BoxRegion.POSITIVE_X_POSITIVE_Y]: "se-resize",
            [BoxRegion.POSITIVE_X_NEGATIVE_Y]: "ne-resize",
            [BoxRegion.NEGATIVE_X_POSITIVE_Y]: "sw-resize",
            [BoxRegion.NEGATIVE_X_NEGATIVE_Y]: "nw-resize",
        };

        function getResizeCursor(boxRegion) {
            return resizeCursors[boxRegion];
        }


        let dummyCanvas = null;

        function getTextMetrics(text, source) {
            dummyCanvas ||= document.createElement("canvas");
            let ctx = dummyCanvas.getContext("2d");
    
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


        return {
            toString() { return NAME; },
            Iterator,
            DefaultIterator,
            reverseIterator,
            ArrayReverseIterator,
            BoxRegion,
            getResizeCursor,
            getTextMetrics,
        };

    })(NAME);


    class GraphicalEditor {
        static toString() { return NAME + ".GraphicalEditor"; }

        #element;
        #canvas;
        #ctx;
        #title;
        #defaultTitle;
        #view;
        #cursorPos;
        #toolbar = null;
        #panels = [];
        #modals = [];
        #message = null;
        #messageTimeout = null;
        #altKey = false;
        #ctrlKey = false;
        #shiftKey = false;

        constructor(element) {
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

            this.#ctx = this.#canvas.getContext("2d");

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

        get element() {
            return this.#element;
        }

        get canvas() {
            return this.#canvas;
        }

        get ctx() {
            return this.#ctx;
        }

        get width() {
            return this.#element.clientWidth;
        }

        get height() {
            return this.#element.clientHeight;
        }

        get title() {
            return this.#title.value;
        }

        set title(text) {
            this.#title.value = text;
            this.#updateTitleWidth();
            return this.#title.value;
        }

        defaultTitle() {
            return this.#defaultTitle;
        }

        setDefaultTitle(text) {
            this.title ||= text;
            this.#defaultTitle = text;
            return this;
        }

        get view() {
            return this.#view;
        }

        get scale() {
            return window.devicePixelRatio;
        }

        get cursorPos() {
            return this.#cursorPos.copy();
        }

        get toolbar() {
            return this.#toolbar;
        }

        get tool() {
            return this.#toolbar.tool;
        }

        set tool(tool) {
            return this.#toolbar.tool = tool;
        }

        get altKey() {
            return this.#altKey;
        }

        get ctrlKey() {
            return this.#ctrlKey;
        }

        get shiftKey() {
            return this.#shiftKey;
        }

        onUpdate(callback) {
            this.updateCallback = callback;
            return this;
        }

        onResize(callback) {
            this.resizeCallback = callback;
            return this;
        }

        onMouseDown(callback) {
            this.mouseDownCallback = callback;
            return this;
        }

        onMouseMove(callback) {
            this.mouseMoveCallback = callback;
            return this;
        }

        onMouseUp(callback) {
            this.mouseUpCallback = callback;
            return this;
        }

        onContextMenu(callback) {
            this.contextMenuCallback = callback;
            return this;
        }

        onWheel(callback) {
            this.wheelCallback = callback;
            return this;
        }

        onKeyDown(callback) {
            this.keyDownCallback = callback;
            return this;
        }

        onKeyUp(callback) {
            this.keyUpCallback = callback;
            return this;
        }

        addToolbar() {
            this.#toolbar ||= new Toolbar(this);
            return this.#toolbar;
        }

        addPanel(title) {
            let panel = new Panel(this, title);
            return this.#panels[panel.id] = panel;
        }

        addModal(title) {
            let modal = new Modal(this, title);
            return this.#modals[modal.id] = modal;
        }

        focusCanvas() {
            this.#canvas.focus();
        }

        #updateTitleWidth() {
            // FIXME: this doesn't really work properly when the document first loads for some reason
            this.#title.style.width = `${util.getTextMetrics(this.title, "normal 16px 'Nunito'").width + 12}px`;
        }

        showMessage(text, seconds = null, error = false) {
            this.#message = document.createElement("div");
            this.#message.className = "apper-message";
            if (error) {
                this.#message.classList.add("apper-error");
            }
            this.#message.textContent = text;
            this.#element.appendChild(this.#message);
            window.setTimeout(() => this.#message.classList.add("apper-shown"));
            this.#messageTimeout = window.setTimeout(() => this.hideMessage(), (seconds ?? config.defaultMessageSeconds) * 1000);
        }

        showError(text, seconds = null) {
            this.showMessage(text, seconds, true);
        }

        hideMessage() {
            if (this.#messageTimeout == null || this.#message == null) {
                return;
            }
            window.clearTimeout(this.#messageTimeout);
            this.#messageTimeout = null;
            this.#message.classList.remove("apper-shown");
            let failsafeTimeout = window.setTimeout(() => this.#message.remove(), config.defaultMessageSeconds * 1000);
            this.#message.addEventListener("transitionend", () => {
                window.clearTimeout(failsafeTimeout);
                this.#message.remove();
            }, { once: true, passive: true });
        }

        transform(worldPos) {
            return this.#view.transform(worldPos);
        }

        transformX(worldX) {
            return this.#view.transformX(worldX);
        }

        transformY(worldY) {
            return this.#view.transformY(worldY);
        }

        locate(screenPos) {
            return this.#view.locate(screenPos);
        }

        locateX(screenX) {
            return this.#view.locateX(screenX);
        }

        locateY(screenY) {
            return this.#view.locateY(screenY);
        }

        update() {
            this.#ctx.clearRect(0, 0, this.width, this.height);

            this.updateCallback?.();
        }

        #handleResize() {
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

        #handleMouseDown(event) {
            let isTouch = !!event.touches;
            let screenPos = new Vector2(
                isTouch ? event.touches[0].pageX - this.element.offsetLeft : event.pageX - this.element.offsetLeft,
                isTouch ? event.touches[0].pageY - this.element.offsetTop : event.pageY - this.element.offsetTop,
            );

            let info = {
                isTouch,
                screenPos,
                worldPos: this.locate(screenPos),
                altKey: this.#altKey = event.altKey ?? this.#altKey,
                ctrlKey: this.#ctrlKey = (event.ctrlKey || event.metaKey) ?? this.#ctrlKey,
                shiftKey: this.#shiftKey = event.shiftKey ?? this.#shiftKey,
                leftBtn: isTouch ? true : !!(event.buttons & 1),
                rightBtn: isTouch ? false : !!(event.buttons & 2),
                middleBtn: isTouch ? false : !!(event.buttons & 4),
                button: isTouch ? 0 : event.button,
            };

            this.focusCanvas();
            this.#cursorPos.set(screenPos);

            if (this.mouseDownCallback?.(info)) {
                event.preventDefault();
                event.stopPropagation();
            }

            this.update();
        }

        #handleMouseMove(event) {
            let isTouch = !!event.touches;
            let screenPos = event.target !== this.#canvas && event.buttons === 0 ? new Vector2(NaN) : new Vector2(
                isTouch ? event.touches[0].pageX - this.element.offsetLeft : event.pageX - this.element.offsetLeft,
                isTouch ? event.touches[0].pageY - this.element.offsetTop : event.pageY - this.element.offsetTop,
            );

            let info = {
                isTouch,
                onCanvas: event.target === this.#canvas,
                screenPos,
                worldPos: this.locate(screenPos),
                altKey: this.#altKey = event.altKey ?? this.#altKey,
                ctrlKey: this.#ctrlKey = (event.ctrlKey || event.metaKey) ?? this.#ctrlKey,
                shiftKey: this.#shiftKey = event.shiftKey ?? this.#shiftKey,
                leftBtn: isTouch ? true : !!(event.buttons & 1),
                rightBtn: isTouch ? false : !!(event.buttons & 2),
                middleBtn: isTouch ? false : !!(event.buttons & 4),
            };

            this.#cursorPos.set(screenPos);

            if (this.mouseMoveCallback?.(info)) {
                this.update();
            }
        }

        #handleMouseUp(event) {
            let isTouch = !!event.touches;

            let info = {
                isTouch,
                altKey: this.#altKey = event.altKey ?? this.#altKey,
                ctrlKey: this.#ctrlKey = (event.ctrlKey || event.metaKey) ?? this.#ctrlKey,
                shiftKey: this.#shiftKey = event.shiftKey ?? this.#shiftKey,
                leftBtn: isTouch ? true : !!(event.buttons & 1),
                rightBtn: isTouch ? false : !!(event.buttons & 2),
                middleBtn: isTouch ? false : !!(event.buttons & 4),
                button: isTouch ? 0 : event.button,
            };

            if (this.mouseUpCallback?.(info)) {
                this.update();
            }
        }

        #handleMouseLeave(event) {
            if (event.buttons === 0) {
                this.#cursorPos.set(NaN);
                this.update();
            }
        }

        #handleContextMenu(event) {
            let screenPos = new Vector2(
                event.pageX - this.element.offsetLeft,
                event.pageY - this.element.offsetTop
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

            if (this.contextMenuCallback?.(info)) {
                event.preventDefault();
                event.stopPropagation();
            }

            this.update();
        }

        #handleWheel(event) {
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

        #handleKeyDown(event) {
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

        #handleKeyUp(event) {
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


    class Vector2 {
        static toString() { return NAME + ".Vector2"; }

        constructor(x = 0, y = null) {
            this.set(x, y);
        }

        copy() {
            return new Vector2(this);
        }

        set(x, y = null) {
            if (x.x !== undefined) {
                this.x = x.x;
                this.y = x.y;
                return this;
            }
            this.x = x;
            this.y = y == null ? x : y;
            return this;
        }

        magnitude() {
            return Math.hypot(this.x, this.y);
        }

        normalized() {
            let magnitude = this.magnitude();
            return new Vector2(this.x / magnitude, this.y / magnitude);
        }

        isNaN() {
            return Number.isNaN(this.x) || Number.isNaN(this.y);
        }

        isFinite() {
            return Number.isFinite(this.x) && Number.isFinite(this.y);
        }

        equals(x, y = null) {
            if (x.x !== undefined) {
                return this.x === x.x && this.y === x.y;
            }
            if (y == null) {
                y = x;
            }
            return this.x === x && this.y === y;
        }

        add(x, y = null) {
            if (x.x !== undefined) {
                return new Vector2(this.x + x.x, this.y + x.y);
            }
            if (y == null) {
                y = x;
            }
            return new Vector2(this.x + x, this.y + y);
        }

        sub(x, y = null) {
            if (x.x !== undefined) {
                return new Vector2(this.x - x.x, this.y - x.y);
            }
            if (y == null) {
                y = x;
            }
            return new Vector2(this.x - x, this.y - y);
        }

        mul(x, y = null) {
            if (x.x !== undefined) {
                return new Vector2(this.x * x.x, this.y * x.y);
            }
            if (y == null) {
                y = x;
            }
            return new Vector2(this.x * x, this.y * y);
        }

        div(x, y = null) {
            if (x.x !== undefined) {
                return new Vector2(this.x / x.x, this.y / x.y);
            }
            if (y == null) {
                y = x;
            }
            return new Vector2(this.x / x, this.y / y);
        }

        dot(x, y = null) {
            if (x.x !== undefined) {
                return this.x * x.x + this.y * x.y;
            }
            return this.x * x + this.y * y;
        }

        transformed(view) {
            return view.transform(this);
        }

        located(view) {
            return view.locate(this);
        }
    }


    class Rect {
        static toString() { return NAME + ".Rect"; }

        #pos;
        #size;

        get pos() { return this.#pos; }
        get size() { return this.#size; }

        get x() { return this.#pos.x; }
        set x(x) { return this.#pos.x = x; }
        get y() { return this.#pos.y; }
        set y(y) { return this.#pos.y = y; }
        get w() { return this.#size.x; }
        set w(w) { return this.#size.x = w; }
        get h() { return this.#size.y; }
        set h(h) { return this.#size.y = h; }

        get cx() { return this.#pos.x + 0.5 * this.#size.x; }
        get cy() { return this.#pos.y + 0.5 * this.#size.y; }
        get xw() { return this.#pos.x + this.#size.x; }
        get yh() { return this.#pos.y + this.#size.y; }

        get xy() { return new Vector2(this.x, this.y); }
        get xwy() { return new Vector2(this.x + this.w, this.y); }
        get xyh() { return new Vector2(this.x, this.y + this.h); }
        get xwyh() { return new Vector2(this.x + this.w, this.y + this.h); }

        constructor(x, y, w, h) {
            this.#pos = new Vector2(x, y);
            this.#size = new Vector2(w, h);
        }

        copy() {
            return new Rect(this.#pos.x, this.#pos.y, this.#size.x, this.#size.y);
        }

        area() {
            return this.w * this.h;
        }

        static normalize(rect) {
            return new Rect(rect.w < 0 ? rect.x + rect.w : rect.x, rect.h < 0 ? rect.y + rect.h : rect.y, Math.abs(rect.w), Math.abs(rect.h));
        }

        normalized() {
            return Rect.normalize(this);
        }

        scaled(scale) {
            return new Rect(this.#pos.x * scale, this.#pos.y * scale, this.#size.x * scale, this.#size.y * scale);
        }

        contains(point) {
            let r = this.normalized();
            return r.x <= point.x && point.x <= r.x + r.w && r.y <= point.y && point.y <= r.y + r.h;
        }

        intersects(rect) {
            let self = this.normalized();
            return !(self.x + self.w <= rect.x || self.x >= rect.x + rect.w || self.y + self.h <= rect.y || self.y >= rect.y + rect.h)
        }

        transformed(view) {
            const tl = view.transform(this.#pos);
            const br = view.transform(this.#pos.add(this.#size));
            return new Rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
        }

        located(view) {
            const tl = view.locate(this.#pos);
            const br = view.locate(this.#pos.add(this.#size));
            return new Rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
        }
    }


    class Viewport {
        static toString() { return NAME + ".Viewport"; }

        #center;
        #size;
        #zoom;
        #izoom;
        #scale;

        get center() { return this.#center; }
        get size() { return this.#size; }
        get zoom() { return this.#zoom; }
        set zoom(z) { this.#izoom = 1 / z; return this.#zoom = z; }
        get izoom() { return this.#izoom; }
        set izoom(z) { this.#zoom = 1 / z; return this.#izoom = z; }
        get scale() { return this.#scale; }
        set scale(s) { return this.#scale = s; }

        get cx() { return this.#center.x; }
        set cx(x) { return this.#center.x = x; }
        get cy() { return this.#center.y; }
        set cy(y) { return this.#center.y = y; }
        get w() { return this.#size.x; }
        set w(w) { return this.#size.x = w; }
        get h() { return this.#size.y; }
        set h(h) { return this.#size.y = h; }

        constructor(cx = 0, cy = 0, w = 0, h = 0, z = 1, s = 1) {
            this.#center = new Vector2(cx, cy);
            this.#size = new Vector2(w, h);
            this.#zoom = z;
            this.#izoom = 1 / z;
            this.#scale = s;
        }

        copy() {
            return new Viewport(this.cx, this.cy, this.w, this.h, this.zoom);
        }

        transform(worldPos) {
            return new Vector2(this.transformX(worldPos.x), this.transformY(worldPos.y));
        }

        transformX(worldX) {
            return (worldX - this.#center.x) * this.#zoom + this.#size.x * 0.5;
        }

        transformY(worldY) {
            return (worldY - this.#center.y) * this.#zoom + this.#size.y * 0.5;
        }

        locate(screenPos) {
            return new Vector2(this.locateX(screenPos.x), this.locateY(screenPos.y));
        }

        locateX(screenX) {
            return (screenX - this.#size.x * 0.5) * this.#izoom + this.#center.x;
        }

        locateY(screenY) {
            return (screenY - this.#size.y * 0.5) * this.#izoom + this.#center.y;
        }

        changeZoom(amount, target = null) {
            if (!amount) {
                return;
            }
            let oldPos = target ? this.locate(target) : null;
            if (amount > 0) {
                this.zoom *= 1 + amount;
            } else if (amount < 0) {
                this.zoom /= 1 - amount;
            }
            // Correct the center to zoom into target
            if (target) {
                this.#center.set(this.#center.add(oldPos.sub(this.locate(target))));
            }
        }
    }


    // TODO: method for testing key state
    class Shortcut {
        static toString() { return NAME + ".Shortcut"; }

        #key;
        #ctrl;
        #alt;
        #shift;

        constructor(key, mods = null) {
            this.#key = key;
            this.#ctrl = !!mods?.ctrl;
            this.#alt = !!mods?.alt;
            this.#shift = !!mods?.shift;
        }

        toString() {
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


    var nextToolID = 0;
    var toolList = [];

    class Tool {
        static toString() { return NAME + ".Tool"; }

        #id;
        #name;
        #displayName;
        #icon;
        #shortcut;

        get id() { return this.#id; }
        get name() { return this.#name; }
        get displayName() { return this.#displayName; }
        get icon() { return this.#icon; }
        get shortcut() { return this.#shortcut; }

        constructor(name, displayName, icon, shortcut = null) {
            this.#id = nextToolID++;
            this.#name = name;
            this.#displayName = displayName;
            this.#icon = icon;
            this.#shortcut = shortcut;

            toolList.push(this);
        }
    }


    class Toolbar {
        static toString() { return NAME + ".Toolbar"; }

        #app;
        #element;
        #toggler;
        #buttons;
        #tools;
        #tool;
        #defaultTool;

        get app() { return this.#app; }
        get element() { return this.#element; }
        get tools() { return this.#tools; }

        constructor(app, shown = true) {
            this.#app = app;

            this.#element = document.createElement("div");
            this.#element.className = "apper-toolbar";
            this.#app.element.appendChild(this.#element);
            if (shown) {
                this.#element.classList.add("apper-shown");
            }

            this.#toggler = document.createElement("img");
            this.#toggler.className = "apper-toolbar-toggler";
            this.#toggler.src = getAsset("icons/toolbar-toggler.svg");
            this.#toggler.addEventListener("click", () => this.toggleVisibility());
            this.#app.element.appendChild(this.#toggler);

            this.#buttons = [];
            this.#tools = [];
            this.#tool = 0;
            this.#defaultTool = 0;
        }

        get tool() {
            return toolList[this.#tool];
        }

        set tool(tool) {
            this.#tool = tool.id;
            this.#update();
            return tool;
        }

        get defaultTool() {
            return toolList[this.#defaultTool];
        }

        set defaultTool(tool) {
            this.#defaultTool = tool.id;
            return tool;
        }

        #update() {
            this.#buttons.forEach(button => button.classList.remove("apper-button-selected"));
            this.#buttons[this.#tool].classList.add("apper-button-selected");
            this.#app.update();
        }

        show() {
            this.#element.classList.add("apper-shown");
            return this;
        }

        hide() {
            this.#element.classList.remove("apper-shown");
            return this;
        }

        toggleVisibility() {
            this.#element.classList.toggle("apper-shown");
            return this;
        }

        addTool(tool, setDefault = false) {
            this.#tools.push(tool.id);
            if (setDefault) {
                this.#tool = this.#defaultTool = tool.id;
            }

            let button = document.createElement("div");
            button.className = "apper-toolbutton";
            if (this.#tool === tool.id) button.classList.add("apper-button-selected");
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

        addSpacer() {
            let spacer = document.createElement("div");
            spacer.className = "apper-toolbar-spacer";
            this.#element.appendChild(spacer);
            return this;
        }
    }


    var nextPanelID = 0;

    class Panel {
        static toString() { return NAME + ".Panel"; }

        #id;
        #app;
        #frame;
        #element;
        #title;

        get id() { return this.#id; }
        get app() { return this.#app; }
        get element() { return this.#element; }
        get title() { return this.#title.textContent; }
        set title(text) { return this.#title.textContent = text; }

        constructor(app, title = "") {
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

        show() {
            this.#frame.style.visibility = "visible";
            this.#frame.classList.add("apper-shown");
            return this;
        }

        hide() {
            this.#frame.classList.remove("apper-shown");
            return this;
        }

        add(widget) {
            this.#element.appendChild(widget.element);
            return this;
        }

        addSeparator() {
            let separator = document.createElement("span");
            separator.className = "apper-separator";
            this.#element.appendChild(separator);
            return this;
        }
    }


    var nextModalID = 0;

    class Modal {
        static toString() { return NAME + ".Modal"; }

        #id;
        #app;
        #frame;
        #element;
        #title;

        get id() { return this.#id; }
        get app() { return this.#app; }
        get element() { return this.#element; }
        get title() { return this.#title.textContent; }
        set title(text) { return this.#title.textContent = text; }

        constructor(app, title = "") {
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
            closeButton.src = getAsset("icons/close-button.svg");
            closeButton.addEventListener("click", () => {
                this.hide();
                this.app.tool = this.app.toolbar.defaultTool;
            });
            this.#frame.appendChild(closeButton);

            this.#element = document.createElement("div");
            this.#frame.appendChild(this.#element);
        }

        show() {
            this.#frame.style.visibility = "visible";
            this.#frame.classList.add("apper-shown");
            return this;
        }

        hide() {
            this.#frame.classList.remove("apper-shown");
            return this;
        }

        add(widget) {
            this.#element.appendChild(widget.element);
            return this;
        }

        addSeparator() {
            let separator = document.createElement("span");
            separator.className = "apper-separator";
            this.#element.appendChild(separator);
            return this;
        }
    }


    const widget = (parent => {
        const NAME = parent + ".widget";

        class Paragraph {
            static toString() { return NAME + ".Paragraph"; }

            #element;

            get element() { return this.#element; }
            get text() { return this.#element.textContent; }
            set text(content) { return this.#element.textContent = content; }

            constructor(content = "") {
                this.#element = document.createElement("p");
                this.#element.className = "apper-paragraph";
                this.#element.innerHTML = content;
            }

            show() {
                this.#element.style.display = "";
                return this;
            }

            hide() {
                this.#element.style.display = "none";
                return this;
            }
        }


        class Button {
            static toString() { return NAME + ".Button"; }

            #element;
            #name;

            get element() { return this.#element; }
            get name() { return this.#name; }
            get label() { return this.#element.textContent; }
            set label(text) { return this.#element.textContent = text; }

            get url() { return this.#element.href; }
            set url(content) { return this.#element.href = content; }
            get filename() { return this.#element.download; }
            set filename(content) { return this.#element.download = content; }

            constructor(label, url = null, filename = null) {
                this.#element = document.createElement("a");
                this.#element.className = "apper-button";
                if (url != null) {
                    this.#element.href = url;
                }
                if (filename != null) {
                    this.#element.download = filename;
                }
                this.#element.innerHTML = label;
                this.#element.addEventListener("click", (event) => {
                    this.clickCallback?.(event);
                }, { passive: true });
            }

            onClick(callback) {
                this.clickCallback = callback;
                return this;
            }

            show() {
                this.#element.style.display = "";
                return this;
            }

            hide() {
                this.#element.style.display = "none";
                return this;
            }
        }


        class Checkbox {
            static toString() { return NAME + ".Checkbox"; }

            #element;
            #name;
            #label;
            #input;

            get element() { return this.#element; }
            get name() { return this.#name; }
            get label() { return this.#label.textContent; }
            set label(text) { return this.#label.textContent = text; }
            get checked() { return this.#input.checked; }
            set checked(value) { return this.#input.checked = value; }

            constructor(name, label, init = false) {
                this.#element = document.createElement("label");
                this.#element.className = "apper-checkbox";
                this.#element.addEventListener("change", (event) => {
                    this.change?.(this.checked, event);
                }, { passive: true });

                this.#input = document.createElement("input");
                this.#input.type = "checkbox";
                this.#input.name = name;
                this.#input.checked = init;
                this.#element.appendChild(this.#input);

                this.#label = document.createElement("span");
                this.#label.textContent = label;
                this.#element.appendChild(this.#label);

                let box = document.createElement("div");
                let check = document.createElement("img");
                check.src = getAsset("icons/checkbox-check.svg");
                box.appendChild(check);
                this.#element.appendChild(box);
            }

            onChange(callback) {
                this.change = callback;
                return this;
            }

            setChecked(value) {
                this.checked = value;
                return this;
            }

            show() {
                this.#element.style.display = "";
                return this;
            }

            hide() {
                this.#element.style.display = "none";
                return this;
            }

            enable() {
                this.#input.disabled = false;
                return this;
            }

            disable() {
                this.#input.disabled = true;
                return this;
            }
        }


        class HSpread {
            static toString() { return NAME + ".HSpread"; }

            #element;
            #name;
            #label;
            #value;

            get element() { return this.#element; }
            get name() { return this.#name; }
            get label() { return this.#label.textContent; }
            set label(text) { return this.#label.textContent = text; }
            get value() { return this.#value; }

            set value(value) {
                document.querySelectorAll(`.apper-hspread input[name="${this.#name}"]`).forEach(input => {
                    input.checked = input.value == value;
                });
                return this.#value = value;
            }

            constructor(name, label, icons, labelIcon = null, init = null) {
                this.#name = name;
                this.#value = init;

                this.#element = document.createElement("div");
                this.#element.className = "apper-hspread";

                this.#label = document.createElement("span");
                this.#label.textContent = label;
                this.#element.appendChild(this.#label);

                if (labelIcon) {
                    let icon = document.createElement("img");
                    icon.src = labelIcon;
                    this.#element.appendChild(icon);
                }

                let spread = document.createElement("div");
                this.#element.appendChild(spread);

                icons.forEach((iconSrc, value) => {
                    let container = document.createElement("label");
                    spread.appendChild(container);

                    let input = document.createElement("input");
                    input.type = "radio";
                    input.name = name;
                    input.value = value;
                    if (value === this.#value) {
                        input.checked = true;
                    }
                    input.addEventListener("change", (event) => {
                        this.#value = value;
                        this.changeCallback?.(value, event);
                    }, { passive: true });
                    container.appendChild(input);

                    let button = document.createElement("span");
                    container.appendChild(button);

                    iconSrc = iconSrc.trim();
                    if (iconSrc.startsWith("<")) {
                        button.innerHTML = iconSrc;
                    } else {
                        let icon = document.createElement("img");
                        icon.src = iconSrc;
                        button.appendChild(icon);
                    }
                });
            }

            onChange(callback) {
                this.changeCallback = callback;
                return this;
            }

            show() {
                this.#element.style.display = "";
                return this;
            }

            hide() {
                this.#element.style.display = "none";
                return this;
            }
        }


        class TextEditor {
            static toString() { return NAME + ".TextEditor"; }

            #element;
            #name;

            get element() { return this.#element; }
            get name() { return this.#name; }
            get text() { return this.#element.value; }
            set text(value) { this.#element.value = value; this.#update(); return value; }
            get valid() { return !this.#element.classList.contains("apper-invalid"); }
            set valid(value) { return this.#element.classList.toggle("apper-invalid", !value); }
            get editing() { return document.activeElement === this.#element; }

            constructor(name, placeholder = "", init = "") {
                this.#name = name;

                this.#element = document.createElement("textarea");
                this.#element.className = "apper-text-editor";
                this.#element.name = name;
                this.#element.placeholder = placeholder;
                this.#element.value = init;
                this.#element.spellcheck = false;
                this.#element.autocomplete = "off";
                this.#element.addEventListener("input", (event) => {
                    this.changeCallback?.(this.text, event);
                    this.#update();
                }, { passive: true });

                this.#update();
            }

            #update() {
                // Solution from DreamTeK on StackOverflow:
                // https://stackoverflow.com/questions/454202/creating-a-textarea-with-auto-resize
                this.#element.style.height = "auto";
                this.#element.style.height = this.#element.scrollHeight + "px";
            }

            onChange(callback) {
                this.changeCallback = callback;
                return this;
            }

            show() {
                this.#element.style.display = "";
                return this;
            }

            hide() {
                this.#element.style.display = "none";
                return this;
            }
        }


        class ButtonList {
            static toString() { return NAME + ".ButtonList"; }

            #element;
            #label;
            #buttons;

            get element() { return this.#element; }
            get label() { return this.#label.textContent; }
            set label(text) { return this.#label.textContent = text; }

            constructor(label, values, names) {
                this.#element = document.createElement("div");
                this.#element.className = "apper-button-list";

                this.#label = document.createElement("span");
                this.#label.textContent = label;
                this.#element.appendChild(this.#label);

                let list = document.createElement("div");
                this.#buttons = [];
                values.forEach((value, i) => {
                    let button = document.createElement("button");
                    button.value = value;
                    button.textContent = names[i];
                    button.addEventListener("click", (event) => {
                        this.clickCallback?.(value, event);
                    }, { passive: true });
                    list.appendChild(button);
                    this.#buttons.push(button);
                });
                this.#element.appendChild(list);
            }

            onClick(callback) {
                this.clickCallback = callback;
                return this;
            }

            show() {
                this.#element.style.display = "";
                return this;
            }

            hide() {
                this.#element.style.display = "none";
                return this;
            }
        }


        class NumberInput {
            static toString() { return NAME + ".NumberInput"; }

            #element;
            #name;
            #label;
            #input;
            #min;
            #max;

            get element() { return this.#element; }
            get name() { return this.#name; }
            get label() { return this.#label.textContent; }
            set label(text) { return this.#label.textContent = text; }
            get value() { return +this.#input.value; }
            set value(value) { return this.#input.value = value; }

            constructor(name, label, icon = null, init = 0) {
                this.#min = -Infinity;
                this.#max = Infinity;

                this.#element = document.createElement("label");
                this.#element.className = "apper-number-input";
                this.#element.addEventListener("change", (event) => {
                    if (this.value < this.#min) {
                        this.value = this.#min;
                    } else if (this.value > this.#max) {
                        this.value = this.#max;
                    }
                    this.changeCallback?.(this.value, event);
                }, { passive: true });

                if (icon) {
                    let iconElement = document.createElement("img");
                    iconElement.src = icon;
                    this.#element.appendChild(iconElement);
                }

                this.#label = document.createElement("span");
                this.#label.textContent = label;
                this.#element.appendChild(this.#label);

                this.#input = document.createElement("input");
                this.#input.type = "number";
                this.#input.name = name;
                this.#input.value = init;
                this.#element.appendChild(this.#input);
            }

            setMin(value) {
                this.#min = value;
                this.#input.min = value;
                return this;
            }

            setMax(value) {
                this.#max = value;
                this.#input.max = value;
                return this;
            }

            onChange(callback) {
                this.changeCallback = callback;
                return this;
            }

            show() {
                this.#element.style.display = "";
                return this;
            }

            hide() {
                this.#element.style.display = "none";
                return this;
            }
        }


        class FileInput {
            static toString() { return NAME + ".FileInput"; }

            #element;
            #label;
            #input;
            #files;

            get element() { return this.#element; }
            get label() { return this.#label.textContent; }
            set label(text) { return this.#label.textContent = text; }
            get files() { return this.#files; }

            constructor(label) {
                this.#element = document.createElement("label");
                this.#element.className = "apper-file-input";
                this.#element.addEventListener("change", (event) => {
                    this.#files = this.#input.files;
                    this.changeCallback?.(this.#files, event);
                    this.#input.files = null;
                }, { passive: true });

                this.#label = document.createElement("span");
                this.#label.innerHTML = label;
                this.#element.appendChild(this.#label);

                this.#input = document.createElement("input");
                this.#input.type = "file";
                this.#element.appendChild(this.#input);

                this.#files = null;
            }

            onChange(callback) {
                this.changeCallback = callback;
                return this;
            }

            show() {
                this.#element.style.display = "";
                return this;
            }

            hide() {
                this.#element.style.display = "none";
                return this;
            }
        }


        class CanvasImage {
            static toString() { return NAME + ".CanvasImage"; }

            #element;
            #label;
            #canvas;
            #ctx;

            get element() { return this.#element; }
            get label() { return this.#label.textContent; }
            set label(text) { return this.#label.textContent = text; }
            get canvas() { return this.#canvas; }
            get ctx() { return this.#ctx; }

            constructor(label) {
                this.#element = document.createElement("div");
                this.#element.className = "apper-canvas-image";

                this.#label = document.createElement("span");
                this.#label.textContent = label;
                this.#element.appendChild(this.#label);

                this.#canvas = document.createElement("canvas");
                this.#element.appendChild(this.#canvas);

                this.#ctx = this.#canvas.getContext("2d");
            }

            resize(width, height) {
                this.#canvas.width = width;
                this.#canvas.height = height;
            }

            show() {
                this.#element.style.display = "";
                return this;
            }

            hide() {
                this.#element.style.display = "none";
                return this;
            }
        }


        return {
            toString() { return NAME; },
            Paragraph,
            Button,
            Checkbox,
            HSpread,
            TextEditor,
            ButtonList,
            NumberInput,
            FileInput,
            CanvasImage,
        };

    })(NAME);


    let loadResources = () => {
        // Insert necessary <link> tags to dynamically load resources
        if (!document.querySelector("link[href='https://fonts.googleapis.com']")) {
            let link = document.createElement("link");
            link.rel = "preconnect";
            link.href = "https://fonts.googleapis.com";
            document.head.insertBefore(link, scriptNode);
        }
        if (!document.querySelector("link[href='https://fonts.gstatic.com']")) {
            let link = document.createElement("link");
            link.rel = "preconnect";
            link.href = "https://fonts.gstatic.com";
            link.crossOrigin = "anonymous";
            document.head.insertBefore(link, scriptNode);
        }
        if (!document.querySelector("link[href='https://fonts.googleapis.com/css2?family=Cousine&family=Nunito:wght@500&display=swap']")) {
            let link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://fonts.googleapis.com/css2?family=Cousine&family=Nunito:wght@500&display=swap";
            document.head.insertBefore(link, scriptNode);
        }
        if (!document.querySelector("link[href*='/apper.css']")) {
            let link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = scriptNode.src.substring(0, scriptNode.src.indexOf(".js")) + ".css";
            link.type = "text/css";
            document.head.insertBefore(link, scriptNode);
        }
    }

    var scriptNode = document.currentScript;
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", loadResources, { once: true, passive: true });
    } else {
        loadResources();
    }


    return {
        toString() { return NAME; },
        config,
        util,
        widget,
        GraphicalEditor,
        Vector2,
        Rect,
        Viewport,
        Shortcut,
        Tool,
        Toolbar,
        Panel,
        Modal,
        getAsset,
    };

})();
