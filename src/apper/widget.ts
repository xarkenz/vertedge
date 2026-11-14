import icon_checkboxCheck from "./assets/icons/checkbox-check.svg";

export class Paragraph {
    #element: HTMLElement;

    get element(): HTMLElement { return this.#element; }
    get text(): string { return this.#element.textContent; }
    set text(content: string) { this.#element.textContent = content; }

    constructor(content = "") {
        this.#element = document.createElement("p");
        this.#element.className = "apper-paragraph";
        this.#element.innerHTML = content;
    }

    show(): this {
        this.#element.style.display = "";
        return this;
    }

    hide(): this {
        this.#element.style.display = "none";
        return this;
    }
}

export class Button {
    #element: HTMLAnchorElement;

    clickCallback?: (event: PointerEvent) => void;

    get element(): HTMLElement { return this.#element; }
    get label(): string { return this.#element.textContent; }
    set label(text: string) { this.#element.textContent = text; }

    get url(): string { return this.#element.href; }
    set url(content: string) { this.#element.href = content; }
    get filename(): string { return this.#element.download; }
    set filename(content: string) { this.#element.download = content; }

    constructor(label: string, url: string | undefined = undefined, filename: string | undefined = undefined) {
        this.#element = document.createElement("a");
        this.#element.className = "apper-button";
        if (url !== undefined) {
            this.#element.href = url;
        }
        if (filename !== undefined) {
            this.#element.download = filename;
        }
        this.#element.innerHTML = label;
        this.#element.addEventListener("click", (event) => {
            this.clickCallback?.(event);
        }, { passive: true });
    }

    onClick(callback: (event: PointerEvent) => void): this {
        this.clickCallback = callback;
        return this;
    }

    show(): this {
        this.#element.style.display = "";
        return this;
    }

    hide(): this {
        this.#element.style.display = "none";
        return this;
    }
}

export class Checkbox {
    #element: HTMLElement;
    #label: HTMLElement;
    #input: HTMLInputElement;

    changeCallback?: (value: boolean, event: Event) => void;

    get element(): HTMLElement { return this.#element; }
    get name(): string { return this.#input.name; }
    get label(): string { return this.#label.textContent; }
    set label(text: string) { this.#label.textContent = text; }
    get checked(): boolean { return this.#input.checked; }
    set checked(value: boolean) { this.#input.checked = value; }

    constructor(name: string, label: string, init: boolean = false) {
        this.#element = document.createElement("label");
        this.#element.className = "apper-checkbox";
        this.#element.addEventListener("change", (event) => {
            this.changeCallback?.(this.checked, event);
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
        check.src = icon_checkboxCheck;
        box.appendChild(check);
        this.#element.appendChild(box);
    }

    onChange(callback: (value: boolean, event: Event) => void): this {
        this.changeCallback = callback;
        return this;
    }

    setChecked(value: boolean): this {
        this.checked = value;
        return this;
    }

    show(): this {
        this.#element.style.display = "";
        return this;
    }

    hide(): this {
        this.#element.style.display = "none";
        return this;
    }

    enable(): this {
        this.#input.disabled = false;
        return this;
    }

    disable(): this {
        this.#input.disabled = true;
        return this;
    }
}

export class HSpread {
    #element: HTMLElement;
    #name: string;
    #label: HTMLElement;
    #value: number | undefined;

    changeCallback?: (value: number, event: Event) => void;

    get element(): HTMLElement { return this.#element; }
    get name(): string { return this.#name; }
    get label(): string { return this.#label.textContent; }
    set label(text: string) { this.#label.textContent = text; }
    get value(): number | undefined { return this.#value; }

    set value(value: number | undefined) {
        document.querySelectorAll(`.apper-hspread input[name="${this.#name}"]`).forEach(input => {
            let radio = input as HTMLInputElement;
            radio.checked = parseInt(radio.value) === value;
        });
        this.#value = value;
    }

    constructor(name: string, label: string, icons: string[], labelIcon: string | undefined = undefined, init: number | undefined = undefined) {
        this.#name = name;
        this.#value = init;

        this.#element = document.createElement("div");
        this.#element.className = "apper-hspread";

        this.#label = document.createElement("span");
        this.#label.textContent = label;
        this.#element.appendChild(this.#label);

        if (labelIcon !== undefined) {
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
            input.value = value.toString();
            input.checked = value === init;
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

    onChange(callback: (value: number, event: Event) => void): this {
        this.changeCallback = callback;
        return this;
    }

    show(): this {
        this.#element.style.display = "";
        return this;
    }

    hide(): this {
        this.#element.style.display = "none";
        return this;
    }
}

export class TextEditor {
    #element: HTMLTextAreaElement;

    changeCallback?: (text: string, event: Event) => void;

    get element(): HTMLElement { return this.#element; }
    get name(): string { return this.#element.name; }
    get placeholder(): string { return this.#element.placeholder; }
    set placeholder(text: string) { this.#element.placeholder = text; }
    get text(): string { return this.#element.value; }
    set text(value: string) { this.#element.value = value; this.#update(); }
    get valid(): boolean { return !this.#element.classList.contains("apper-invalid"); }
    set valid(value: boolean) { this.#element.classList.toggle("apper-invalid", !value); }
    get editing(): boolean { return document.activeElement === this.#element; }

    constructor(name: string, placeholder: string = "", init: string = "") {
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

    #update(): void {
        // Solution from DreamTeK on StackOverflow:
        // https://stackoverflow.com/questions/454202/creating-a-textarea-with-auto-resize
        this.#element.style.height = "auto";
        this.#element.style.height = this.#element.scrollHeight + "px";
    }

    onChange(callback: (text: string, event: Event) => void): this {
        this.changeCallback = callback;
        return this;
    }

    show(): this {
        this.#element.style.display = "";
        return this;
    }

    hide(): this {
        this.#element.style.display = "none";
        return this;
    }
}

export class ButtonList {
    #element: HTMLElement;
    #label: HTMLElement;
    #buttons: HTMLButtonElement[];

    clickCallback?: (value: string, event: PointerEvent) => void;

    get element(): HTMLElement { return this.#element; }
    get label(): string { return this.#label.textContent; }
    set label(text: string) { this.#label.textContent = text; }

    constructor(label: string, buttons: { label: string, value: string }[]) {
        this.#element = document.createElement("div");
        this.#element.className = "apper-button-list";

        this.#label = document.createElement("span");
        this.#label.textContent = label;
        this.#element.appendChild(this.#label);

        let list = document.createElement("div");
        this.#buttons = [];
        buttons.forEach(({ label, value }) => {
            let button = document.createElement("button");
            button.textContent = label;
            button.value = value;
            button.addEventListener("click", (event) => {
                this.clickCallback?.(value, event);
            }, { passive: true });
            list.appendChild(button);
            this.#buttons.push(button);
        });
        this.#element.appendChild(list);
    }

    onClick(callback: (value: string, event: PointerEvent) => void): this {
        this.clickCallback = callback;
        return this;
    }

    show(): this {
        this.#element.style.display = "";
        return this;
    }

    hide(): this {
        this.#element.style.display = "none";
        return this;
    }
}

export class NumberInput {
    #element: HTMLElement;
    #label: HTMLElement;
    #input: HTMLInputElement;
    #min: number;
    #max: number;

    changeCallback?: (value: number, event: Event) => void;

    get element(): HTMLElement { return this.#element; }
    get name(): string { return this.#input.name; }
    get label(): string { return this.#label.textContent; }
    set label(text: string) { this.#label.textContent = text; }
    get value(): number { return parseFloat(this.#input.value); }
    set value(value: number) { this.#input.value = value.toString(); }

    constructor(name: string, label: string, icon: string | undefined = undefined, init: number = 0) {
        this.#min = -Infinity;
        this.#max = Infinity;

        this.#element = document.createElement("label");
        this.#element.className = "apper-number-input";
        this.#element.addEventListener("change", (event) => {
            this.value = Math.min(this.#max, Math.max(this.#min, this.value));
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
        this.#input.value = init.toString();
        this.#element.appendChild(this.#input);
    }

    setMin(value: number): this {
        this.#min = value;
        this.#input.min = value.toString();
        return this;
    }

    setMax(value: number): this {
        this.#max = value;
        this.#input.max = value.toString();
        return this;
    }

    onChange(callback: (value: number, event: Event) => void): this {
        this.changeCallback = callback;
        return this;
    }

    show(): this {
        this.#element.style.display = "";
        return this;
    }

    hide(): this {
        this.#element.style.display = "none";
        return this;
    }
}

export class FileInput {
    #element: HTMLElement;
    #label: HTMLElement;
    #input: HTMLInputElement;
    #files: FileList | null = null;

    changeCallback?: (value: FileList | null, event: Event) => void;

    get element(): HTMLElement { return this.#element; }
    get label(): string { return this.#label.textContent; }
    set label(text: string) { this.#label.textContent = text; }
    get files(): FileList | null { return this.#files; }

    constructor(label: string) {
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
    }

    onChange(callback: (value: FileList | null, event: Event) => void): this {
        this.changeCallback = callback;
        return this;
    }

    show(): this {
        this.#element.style.display = "";
        return this;
    }

    hide(): this {
        this.#element.style.display = "none";
        return this;
    }
}

export class CanvasImage {
    #element: HTMLElement;
    #label: HTMLElement;
    #canvas: HTMLCanvasElement;
    #ctx: CanvasRenderingContext2D;

    get element(): HTMLElement { return this.#element; }
    get label(): string { return this.#label.textContent; }
    set label(text: string) { this.#label.textContent = text; }
    get canvas(): HTMLCanvasElement { return this.#canvas; }
    get ctx(): CanvasRenderingContext2D { return this.#ctx; }

    constructor(label: string) {
        this.#element = document.createElement("div");
        this.#element.className = "apper-canvas-image";

        this.#label = document.createElement("span");
        this.#label.textContent = label;
        this.#element.appendChild(this.#label);

        this.#canvas = document.createElement("canvas");
        this.#element.appendChild(this.#canvas);

        let ctx = this.#canvas.getContext("2d");
        if (!ctx) {
            throw new Error("2d rendering context not supported.");
        }
        this.#ctx = ctx;
    }

    resize(width: number, height: number): this {
        this.#canvas.width = width;
        this.#canvas.height = height;
        return this;
    }

    show(): this {
        this.#element.style.display = "";
        return this;
    }

    hide(): this {
        this.#element.style.display = "none";
        return this;
    }
}
