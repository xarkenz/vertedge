export interface Vector2Like {
    x: number;
    y: number;
}

export class Vector2 {
    x: number = 0;
    y: number = 0;

    constructor();
    constructor(splat: number);
    constructor(x: number, y: number);
    constructor(xy: Vector2Like);
    constructor(x: number | Vector2Like = 0, y: number | undefined = undefined) {
        this.set(x, y);
    }

    copy(): Vector2 {
        return new Vector2(this);
    }

    set(x: number | Vector2Like = 0, y: number | undefined = undefined): this {
        if (typeof x === "number") {
            this.x = x;
            this.y = y === undefined ? x : y;
        } else {
            this.x = x.x;
            this.y = x.y;
        }
        return this;
    }

    magnitude(): number {
        return Math.hypot(this.x, this.y);
    }

    normalized(): Vector2 {
        return this.div(this.magnitude());
    }

    isNaN(): boolean {
        return isNaN(this.x) || isNaN(this.y);
    }

    isFinite(): boolean {
        return Number.isFinite(this.x) && Number.isFinite(this.y);
    }

    equals(x: number | Vector2Like, y: number | undefined = undefined): boolean {
        if (typeof x === "number") {
            return this.x === x && this.y === (y ?? x);
        } else {
            return this.x === x.x && this.y === x.y;
        }
    }

    neg(): Vector2 {
        return new Vector2(-this.x, -this.y);
    }

    add(x: number | Vector2Like, y: number | undefined = undefined): Vector2 {
        if (typeof x === "number") {
            return new Vector2(this.x + x, this.y + (y ?? x));
        } else {
            return new Vector2(this.x + x.x, this.y + x.y);
        }
    }

    sub(x: number | Vector2Like, y: number | undefined = undefined): Vector2 {
        if (typeof x === "number") {
            return new Vector2(this.x - x, this.y - (y ?? x));
        } else {
            return new Vector2(this.x - x.x, this.y - x.y);
        }
    }

    mul(x: number | Vector2Like, y: number | undefined = undefined): Vector2 {
        if (typeof x === "number") {
            return new Vector2(this.x * x, this.y * (y ?? x));
        } else {
            return new Vector2(this.x * x.x, this.y * x.y);
        }
    }

    div(x: number | Vector2Like, y: number | undefined = undefined): Vector2 {
        if (typeof x === "number") {
            return new Vector2(this.x / x, this.y / (y ?? x));
        } else {
            return new Vector2(this.x / x.x, this.y / x.y);
        }
    }

    dot(x: number | Vector2Like, y: number | undefined = undefined): number {
        if (typeof x === "number") {
            return this.x * x + this.y * (y ?? x);
        } else {
            return this.x * x.x + this.y * x.y;
        }
    }

    rotated90CCW(): Vector2 {
        return new Vector2(-this.y, this.x);
    }

    rotated90CW(): Vector2 {
        return new Vector2(this.y, -this.x);
    }

    transformed(view: Viewport): Vector2 {
        return view.transform(this);
    }

    located(view: Viewport): Vector2 {
        return view.locate(this);
    }
}


export class Rect {
    #pos: Vector2;
    #size: Vector2;

    get pos(): Vector2 { return this.#pos; }
    get size(): Vector2 { return this.#size; }

    get x(): number { return this.#pos.x; }
    set x(x: number) { this.#pos.x = x; }
    get y(): number { return this.#pos.y; }
    set y(y: number) { this.#pos.y = y; }
    get w(): number { return this.#size.x; }
    set w(w: number) { this.#size.x = w; }
    get h(): number { return this.#size.y; }
    set h(h: number) { this.#size.y = h; }

    get cx(): number { return this.#pos.x + 0.5 * this.#size.x; }
    get cy(): number { return this.#pos.y + 0.5 * this.#size.y; }
    get xw(): number { return this.#pos.x + this.#size.x; }
    get yh(): number { return this.#pos.y + this.#size.y; }

    get xy(): Vector2 { return new Vector2(this.x, this.y); }
    get xwy(): Vector2 { return new Vector2(this.x + this.w, this.y); }
    get xyh(): Vector2 { return new Vector2(this.x, this.y + this.h); }
    get xwyh(): Vector2 { return new Vector2(this.x + this.w, this.y + this.h); }

    constructor(x: number, y: number, w: number, h: number) {
        this.#pos = new Vector2(x, y);
        this.#size = new Vector2(w, h);
    }

    copy(): Rect {
        return new Rect(this.#pos.x, this.#pos.y, this.#size.x, this.#size.y);
    }

    area(): number {
        return this.w * this.h;
    }

    static normalize(rect: Rect): Rect {
        return new Rect(rect.w < 0 ? rect.x + rect.w : rect.x, rect.h < 0 ? rect.y + rect.h : rect.y, Math.abs(rect.w), Math.abs(rect.h));
    }

    normalized(): Rect {
        return Rect.normalize(this);
    }

    scaled(scale: number): Rect {
        return new Rect(this.#pos.x * scale, this.#pos.y * scale, this.#size.x * scale, this.#size.y * scale);
    }

    contains(point: Vector2Like): boolean {
        let r = this.normalized();
        return r.x <= point.x && point.x <= r.x + r.w && r.y <= point.y && point.y <= r.y + r.h;
    }

    intersects(rect: Rect): boolean {
        let self = this.normalized();
        return !(self.x + self.w <= rect.x || self.x >= rect.x + rect.w || self.y + self.h <= rect.y || self.y >= rect.y + rect.h)
    }

    transformed(view: Viewport): Rect {
        const tl = view.transform(this.#pos);
        const br = view.transform(this.#pos.add(this.#size));
        return new Rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }

    located(view: Viewport): Rect {
        const tl = view.locate(this.#pos);
        const br = view.locate(this.#pos.add(this.#size));
        return new Rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }
}


export class Viewport {
    #center: Vector2;
    #size: Vector2;
    #zoom: number;
    #scale: number;

    get center(): Vector2 { return this.#center; }
    get size(): Vector2 { return this.#size; }
    get zoom(): number { return this.#zoom; }
    set zoom(z) { this.#zoom = z; }
    get scale(): number { return this.#scale; }
    set scale(s) { this.#scale = s; }

    get cx(): number { return this.#center.x; }
    set cx(x: number) { this.#center.x = x; }
    get cy(): number { return this.#center.y; }
    set cy(y: number) { this.#center.y = y; }
    get w(): number { return this.#size.x; }
    set w(w: number) { this.#size.x = w; }
    get h(): number { return this.#size.y; }
    set h(h: number) { this.#size.y = h; }

    constructor(cx: number = 0, cy: number = 0, w: number = 0, h: number = 0, z: number = 1, s: number = 1) {
        this.#center = new Vector2(cx, cy);
        this.#size = new Vector2(w, h);
        this.#zoom = z;
        this.#scale = s;
    }

    copy(): Viewport {
        return new Viewport(this.cx, this.cy, this.w, this.h, this.zoom, this.scale);
    }

    transform(worldPos: Vector2Like): Vector2 {
        return new Vector2(this.transformX(worldPos.x), this.transformY(worldPos.y));
    }

    transformX(worldX: number): number {
        return (worldX - this.#center.x) * this.#zoom + this.#size.x * 0.5;
    }

    transformY(worldY: number): number {
        return (worldY - this.#center.y) * this.#zoom + this.#size.y * 0.5;
    }

    locate(screenPos: Vector2Like): Vector2 {
        return new Vector2(this.locateX(screenPos.x), this.locateY(screenPos.y));
    }

    locateX(screenX: number): number {
        return (screenX - this.#size.x * 0.5) / this.#zoom + this.#center.x;
    }

    locateY(screenY: number): number {
        return (screenY - this.#size.y * 0.5) / this.#zoom + this.#center.y;
    }

    changeZoom(amount: number, target: Vector2Like | undefined = undefined): void {
        if (amount === 0 || !isFinite(amount)) {
            return;
        }
        let oldPos = target === undefined ? undefined : this.locate(target);
        if (amount > 0) {
            this.zoom *= 1 + amount;
        } else if (amount < 0) {
            this.zoom /= 1 - amount;
        }
        // Correct the center to zoom into target
        if (target !== undefined) {
            this.#center.set(this.#center.add((oldPos as Vector2).sub(this.locate(target))));
        }
    }
}
