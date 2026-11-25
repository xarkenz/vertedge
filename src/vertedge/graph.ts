import * as zod from "zod";
import { Vector2, Viewport, type Vector2Like } from "@/apper/math";
import { Color, type GraphDrawingContext } from "@/vertedge/util";
import { config } from ".";

export interface VertexShape {
    id: number;
    sizeFactor: number;

    path(ctx: GraphDrawingContext, pos: Vector2Like, radius: number): void;
}

export const VertexShape = {
    CIRCLE: {
        id: 0,
        sizeFactor: 1,
        path(ctx: GraphDrawingContext, pos: Vector2Like, radius: number) {
            radius *= this.sizeFactor;
            ctx.ellipse(pos.x, pos.y, radius, radius, 0, 0, 2 * Math.PI);
            ctx.closePath();
        },
    },
    SQUARE: {
        id: 1,
        sizeFactor: 1,
        path(ctx: GraphDrawingContext, pos: Vector2Like, radius: number) {
            radius *= this.sizeFactor;
            ctx.rect(pos.x - radius, pos.y - radius, 2 * radius, 2 * radius);
        },
    },
    DIAMOND: {
        id: 2,
        sizeFactor: 1.3,
        path(ctx: GraphDrawingContext, pos: Vector2Like, radius: number) {
            radius *= this.sizeFactor;
            ctx.moveTo(pos.x, pos.y - radius);
            ctx.lineTo(pos.x - radius, pos.y);
            ctx.lineTo(pos.x, pos.y + radius);
            ctx.lineTo(pos.x + radius, pos.y);
            ctx.closePath();
        },
    },
    STAR: {
        id: 3,
        sizeFactor: 1.3,
        path(ctx: GraphDrawingContext, pos: Vector2Like, radius: number) {
            radius *= this.sizeFactor;
            ctx.moveTo(pos.x, pos.y - radius);
            ctx.lineTo(pos.x - 0.29 * radius, pos.y - 0.40 * radius);
            ctx.lineTo(pos.x - 0.95 * radius, pos.y - 0.31 * radius);
            ctx.lineTo(pos.x - 0.48 * radius, pos.y + 0.15 * radius);
            ctx.lineTo(pos.x - 0.59 * radius, pos.y + 0.81 * radius);
            ctx.lineTo(pos.x, pos.y + 0.5 * radius);
            ctx.lineTo(pos.x + 0.59 * radius, pos.y + 0.81 * radius);
            ctx.lineTo(pos.x + 0.48 * radius, pos.y + 0.15 * radius);
            ctx.lineTo(pos.x + 0.95 * radius, pos.y - 0.31 * radius);
            ctx.lineTo(pos.x + 0.29 * radius, pos.y - 0.40 * radius);
            ctx.closePath();
        },
    },
};

const vertexShapesByID: Record<number, VertexShape> = {};
for (let shape of Object.values(VertexShape)) {
    vertexShapesByID[shape.id] = shape;
}

export function getVertexShapeByID(id: number): VertexShape | undefined {
    return vertexShapesByID[id];
}

export interface VertexDescriptor {
    x: number;
    y: number;
    r?: number;
    fill?: string;
    stroke?: string;
    lineWidth?: number;
    lineDash?: number[];
    shape?: VertexShape;
}

export class Vertex {
    x: number;
    y: number;
    r: number;
    fill: string;
    stroke: string;
    lineWidth: number;
    lineDash: number[];
    shape: VertexShape;

    constructor(data: VertexDescriptor) {
        this.x = data.x;
        this.y = data.y;
        this.r = Math.abs(data.r ?? config.defaults.vertex.radius);
        this.fill = data.fill ?? config.defaults.vertex.fill;
        this.stroke = data.stroke ?? config.defaults.vertex.stroke;
        this.lineWidth = Math.abs(data.lineWidth ?? config.defaults.vertex.lineWidth);
        this.lineDash = (data.lineDash || []).slice();
        this.shape = data.shape || config.defaults.vertex.shape;
    }

    copy(): Vertex {
        return new Vertex(this);
    }

    margin(): number {
        return this.shape.sizeFactor * this.r + 0.5 * this.lineWidth;
    }

    path(ctx: GraphDrawingContext, view: Viewport = new Viewport()): void {
        this.r = Math.abs(this.r);
        this.shape.path(ctx, view.transform(this), this.r * view.zoom);
    }

    draw(ctx: GraphDrawingContext, hover: boolean, select: boolean, highlight: string, view: Viewport = new Viewport()): void {
        this.r = Math.abs(this.r);
        if (hover || select) {
            ctx.strokeStyle = select ? `${highlight}cc` : `${highlight}99`;
            ctx.lineWidth = this.lineWidth * view.zoom + 4;
            ctx.setLineDash([]);
            ctx.beginPath();
            this.path(ctx, view);
            ctx.stroke();
        }
        ctx.fillStyle = this.fill;
        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = this.lineWidth * view.zoom;
        ctx.setLineDash(this.lineDash.map(value => value * this.lineWidth * view.zoom));
        ctx.beginPath();
        this.path(ctx, view);
        if (this.r > 0) {
            ctx.fill();
        }
        if (this.lineWidth > 0) {
            ctx.stroke();
        }
    }

    contains(ctx: CanvasRenderingContext2D, pos: Vector2Like, selected: boolean, view: Viewport = new Viewport(), screen: boolean = false): boolean {
        if (isNaN(pos.x) || isNaN(pos.y)) {
            return false;
        }
        if (!screen) {
            pos = view.transform(pos);
        }
        ctx.lineWidth = selected ? this.lineWidth * view.zoom + 4 : Math.max(this.lineWidth * view.zoom + 4, 12);
        ctx.beginPath();
        this.path(ctx, view);
        return ctx.isPointInPath(pos.x * view.scale, pos.y * view.scale) || ctx.isPointInStroke(pos.x * view.scale, pos.y * view.scale);
    }
}

export interface EdgeDescriptor {
    v1: Vertex;
    v2?: Vertex;
    cp?: Vector2Like;
    stroke?: string;
    lineWidth?: number;
    lineDash?: number[];
    directed?: boolean;
    arrowAngle?: number;
    arrowLength?: number;
}

export class Edge {
    v1: Vertex;
    v2: Vertex;
    cp: Vector2 | null;
    stroke: string;
    lineWidth: number;
    lineDash: number[];
    directed: boolean;
    arrowAngle: number;
    arrowLength: number;

    constructor(data: EdgeDescriptor) {
        this.v1 = data.v1 || null;
        this.v2 = data.v2 || this.v1;
        this.cp = (data.cp && new Vector2(data.cp)) || null;
        this.stroke = data.stroke ?? config.defaults.edge.stroke;
        this.lineWidth = Math.abs(data.lineWidth ?? config.defaults.edge.lineWidth);
        this.lineDash = (data.lineDash || []).slice();
        this.directed = !!data.directed;
        this.arrowAngle = data.arrowAngle ?? config.defaults.edge.arrowAngle;
        this.arrowLength = data.arrowLength ?? config.defaults.edge.arrowLength;
    }

    copy(): Edge {
        let { v2, cp, ...rest } = this;
        let data: EdgeDescriptor = rest;
        data.v1 = this.v1.copy();
        if (v2 !== this.v1) {
            data.v2 = v2.copy();
        }
        if (cp) {
            // Gets copied inside the constructor, no need to do it here.
            data.cp = cp;
        }
        return new Edge(data);
    }

    margin(): number {
        return 0.5 * this.lineWidth;
    }

    isCurveOrLoop(): boolean {
        return !!this.cp;
    }

    isCurve(): boolean {
        return this.isCurveOrLoop() && this.v1 !== this.v2;
    }

    isLoop(): boolean {
        return this.isCurveOrLoop() && this.v1 === this.v2;
    }

    reverse(): void {
        [this.v1, this.v2] = [this.v2, this.v1];
    }

    path(ctx: GraphDrawingContext, view: Viewport = new Viewport()): void {
        if (!this.v1 || !this.v2) return;
        let v1 = view.transform(this.v1);
        let v2 = view.transform(this.v2);
        if (this.cp && this.v1 !== this.v2) {
            // Curved edge
            let cp = view.transform(this.cp);
            ctx.moveTo(v1.x, v1.y);
            ctx.quadraticCurveTo(cp.x, cp.y, v2.x, v2.y);
        } else if (this.cp && this.v1 === this.v2) {
            // Edge loop
            let cp = view.transform(this.cp);
            let radius = 0.5 * Math.hypot(v1.x - cp.x, v1.y - cp.y);
            ctx.ellipse(0.5 * (v1.x + cp.x), 0.5 * (v1.y + cp.y), radius, radius, 0, 0, 2 * Math.PI);
        } else {
            // Straight edge
            ctx.moveTo(v1.x, v1.y);
            ctx.lineTo(v2.x, v2.y);
        }
    }

    pathArrow(ctx: GraphDrawingContext, view: Viewport = new Viewport()): void {
        if (!this.v1 || !this.v2) return;
        let v1 = view.transform(this.v1);
        let v2 = view.transform(this.v2);
        let margin = this.v2.margin() * view.zoom;
        let len = this.arrowLength * view.zoom;
        let radians = this.arrowAngle * (Math.PI / 180);
        let cos = Math.cos(radians);
        let sin = Math.sin(radians);
        let dir;
        if (this.cp && this.v1 !== this.v2) {
            // Curved edge
            let cp = view.transform(this.cp);
            dir = cp.sub(v2);
            // In most cases, it looks fine to just shift the arrow along
            // the tangent line.
        } else if (this.cp && this.v1 === this.v2) {
            // Edge loop
            let cp = view.transform(this.cp);
            // Shifting the arrow along the tangent line looks really bad
            // here, so we should do some extra calculation.
            // To try and ensure the arrow looks good, we can fudge it a
            // little by increasing our margin by half of the arrow length.
            // Not perfect, but it's usually good enough.
            let sampleDist = margin + cos * len * 0.5;
            let offset = cp.sub(v2);
            let distSquared = offset.x * offset.x + offset.y * offset.y;
            let discriminant = distSquared - sampleDist * sampleDist;
            if (discriminant < 0) {
                // The arrow doesn't really have space to be drawn, so just
                // omit it; direction isn't critical for a loop anyway.
                return;
            }
            dir = offset.mul(sampleDist).add(offset.rotated90CCW().mul(Math.sqrt(discriminant)));
        } else {
            // Straight edge
            dir = v1.sub(v2);
        }
        dir = dir.normalized();
        let tip = v2.add(dir.mul(margin));
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(tip.x + len * (dir.x * cos - dir.y * sin), tip.y + len * (dir.y * cos + dir.x * sin));
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(tip.x + len * (dir.x * cos + dir.y * sin), tip.y + len * (dir.y * cos - dir.x * sin));
    }

    draw(ctx: GraphDrawingContext, hover: boolean, select: boolean, highlight: string, view: Viewport = new Viewport()): void {
        if (!this.v1 || !this.v2) return;
        if (hover || select) {
            ctx.strokeStyle = select ? `${highlight}cc` : `${highlight}99`;
            ctx.lineWidth = this.lineWidth * view.zoom + 4;
            ctx.setLineDash([]);
            ctx.beginPath();
            this.path(ctx, view);
            if (this.directed) {
                this.pathArrow(ctx, view);
            }
            ctx.stroke();
        }
        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = this.lineWidth * view.zoom;
        if (this.lineWidth > 0) {
            ctx.setLineDash(this.lineDash.map(value => value * this.lineWidth * view.zoom));
            ctx.beginPath();
            this.path(ctx, view);
            ctx.stroke();
            if (this.directed) {
                ctx.setLineDash([]);
                ctx.beginPath();
                this.pathArrow(ctx, view);
                ctx.stroke();
            }
        }
        if (select && this.cp) {
            // Either curved edge or edge loop
            let v1 = view.transform(this.v1);
            let v2 = view.transform(this.v2);
            let cp = view.transform(this.cp);
            if (this.isCurve()) {
                // Draw lines to control point
                ctx.strokeStyle = `${highlight}77`;
                ctx.lineWidth = 2;
                ctx.setLineDash([2, 5]);
                ctx.beginPath();
                ctx.moveTo(v1.x, v1.y);
                ctx.lineTo(cp.x, cp.y);
                ctx.moveTo(v2.x, v2.y);
                ctx.lineTo(cp.x, cp.y);
                ctx.stroke();
            }
            // Draw control point diamond
            ctx.fillStyle = `${highlight}cc`;
            ctx.beginPath();
            ctx.moveTo(cp.x, cp.y + 8);
            ctx.lineTo(cp.x + 8, cp.y);
            ctx.lineTo(cp.x, cp.y - 8);
            ctx.lineTo(cp.x - 8, cp.y);
            ctx.closePath();
            ctx.fill();
        }
    }

    contains(ctx: CanvasRenderingContext2D, pos: Vector2Like, selected: boolean, view: Viewport = new Viewport(), screen: boolean = false): boolean {
        if (isNaN(pos.x) || isNaN(pos.y)) {
            return false;
        }
        if (!screen) {
            pos = view.transform(pos);
        }
        if (selected && this.cp) {
            // Either curved edge or edge loop
            let cp = view.transform(this.cp);
            ctx.beginPath();
            ctx.ellipse(cp.x, cp.y, 10, 10, 0, 0, 2 * Math.PI);
            if (ctx.isPointInPath(pos.x * view.scale, pos.y * view.scale)) {
                return true;
            }
        }
        ctx.lineWidth = selected ? this.lineWidth * view.zoom + 4 : Math.max(this.lineWidth * view.zoom + 4, 12);
        ctx.beginPath();
        this.path(ctx, view);
        if (this.directed) {
            this.pathArrow(ctx, view);
        }
        return ctx.isPointInStroke(pos.x * view.scale, pos.y * view.scale);
    }
}

export const colorSchema = zod.string();
export const lineDashSchema = zod.array(zod.number());
export const jsonVector2Schema = zod.tuple([zod.number(), zod.number()]);

export const graphSchema = zod.object({
    version: zod.int().positive().optional(),
    title: zod.string().nonempty().optional(),
    view: zod.object({
        x: zod.number().optional(),
        y: zod.number().optional(),
        zoom: zod.number().positive().optional(),
    }).optional(),
    settings: zod.object({
        enableAxes: zod.boolean().optional(),
        enableGrid: zod.boolean().optional(),
        gridStepX: zod.number().positive().optional(),
        gridStepY: zod.number().positive().optional(),
    }).optional(),
    vertices: zod.array(zod.object({
        x: zod.number(),
        y: zod.number(),
        r: zod.number().optional(),
        fill: colorSchema.optional(),
        stroke: colorSchema.optional(),
        lineWidth: zod.number().optional(),
        lineDash: lineDashSchema.optional(),
        shape: zod.int().nonnegative().optional(),
    })).optional(),
    edges: zod.array(zod.object({
        v1: zod.int().nonnegative(),
        v2: zod.int().nonnegative(),
        cp: jsonVector2Schema.optional(),
        stroke: colorSchema.optional(),
        lineWidth: zod.number().optional(),
        lineDash: lineDashSchema.optional(),
        directed: zod.boolean().optional(),
        arrowAngle: zod.number().optional(),
        arrowLength: zod.number().optional(),
    })).optional(),
});
