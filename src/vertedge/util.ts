import icon_transparent from "./assets/icons/transparent.svg";

import { Vector2, type Vector2Like } from "@/apper/math";
import { config } from ".";

// Position at t for quadratic beziér curve
// (t²)r + (2t(1-t))q + ((1-t)²)p
export function quadraticCurve(t: number, p: Vector2, q: Vector2, r: Vector2): Vector2 {
    return r.mul(t * t).add(q.mul(2 * t * (1 - t))).add(p.mul((1 - t) * (1 - t)));
}

// Velocity (derivative of position) at t for quadratic beziér curve
// (2t)r + (2-4t)q - (2-2t)p
export function quadraticCurveVelocity(t: number, p: Vector2, q: Vector2, r: Vector2): Vector2 {
    return r.mul(2 * t).add(q.mul(2 - 4 * t)).sub(p.mul(2 - 2 * t));
}

export function quadraticCurveVertexX(p: Vector2Like, q: Vector2Like, r: Vector2Like): number {
    return (-q.x * q.x + 2 * q.x * r.x - r.x * r.x) / (p.x - 2 * q.x + r.x) + r.x;
}

export function quadraticCurveVertexY(p: Vector2Like, q: Vector2Like, r: Vector2Like): number {
    return (-q.y * q.y + 2 * q.y * r.y - r.y * r.y) / (p.y - 2 * q.y + r.y) + r.y;
}

export function nearestOnQuadraticCurve(p: Vector2, q: Vector2, r: Vector2, point: Vector2Like): [Vector2, number] {
    // There's probably a more precise and efficient way of doing this, but this works for now
    let pointNearest = new Vector2(point);
    let tNearest = 0;
    let minimumDistance = Infinity;
    let previousTest = Infinity;
    for (let t = 0; t <= 1; t += config.curveSamplingInterval) {
        let sample = quadraticCurve(t, p, q, r);
        let velocity = quadraticCurveVelocity(t, p, q, r);
        let distanceX = sample.x - point.x;
        let distanceY = sample.y - point.y;
        // Compute a stripped-down version of the derivative of distance which has the same roots
        let test = distanceX * velocity.x + distanceY * velocity.y;
        // Optimize by only checking endpoints and local minima of distance
        if (t === 0 || t === 1 || previousTest <= 0 && test >= 0) {
            let distance = Math.hypot(distanceX, distanceY);
            if (distance < minimumDistance) {
                minimumDistance = distance;
                tNearest = t;
                pointNearest = sample;
            }
        }
        previousTest = test;
    }
    return [pointNearest, tNearest];
}

export function nearestOnLineSegment(p: Vector2, q: Vector2, point: Vector2): [Vector2, number] {
    let lineVector = q.sub(p);
    let pointVector = point.sub(p);
    let lineLength = lineVector.magnitude();
    let scalarProjection = pointVector.dot(lineVector) / lineLength;
    if (scalarProjection <= 0) {
        // Closest point is p
        return [new Vector2(p), 0];
    } else if (scalarProjection >= lineLength) {
        // Closest point is q
        return [new Vector2(q), 1];
    } else {
        // Closest point is between p and q
        let t = scalarProjection / lineLength;
        let vectorProjection = lineVector.mul(t);
        return [vectorProjection.add(p), t];
    }
}

export function orientationOf(p1: Vector2Like, p2: Vector2Like, p3: Vector2Like): number {
    return Math.sign((p2.y - p1.y) * (p3.x - p2.x) - (p2.x - p1.x) * (p3.y - p2.y));
}

export function linesIntersect(p1: Vector2Like, q1: Vector2Like, p2: Vector2Like, q2: Vector2Like): boolean {
    return orientationOf(p1, q1, p2) !== orientationOf(p1, q1, q2) && orientationOf(p2, q2, p1) !== orientationOf(p2, q2, q1);
}

export function getFillColorIcon(color: string): string {
    return color === Color.NONE ? icon_transparent : `\
        <svg version="1.1" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
            <ellipse fill="${color}" stroke="none" cx="16" cy="16" rx="9" ry="9"/>
        </svg>`;
}

export function getStrokeColorIcon(color: string): string {
    return color === Color.NONE ? icon_transparent : `\
        <svg version="1.1" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
            <ellipse fill="none" stroke="${color}" stroke-width="2" cx="16" cy="16" rx="8" ry="8"/>
        </svg>`;
}

export const Color = {
    NONE: "transparent",
    LIGHT: "#cccccc",
    MEDIUM: "#999999",
    DARK: "#666666",
    RED: "#e84b33",
    RED_TINT: "#f46b30",
    ORANGE: "#ff9421",
    ORANGE_TINT: "#ffb128",
    YELLOW: "#ffd731",
    YELLOW_TINT: "#ffef42",
    GREEN: "#39d12a",
    GREEN_TINT: "#72e02d",
    GREEN_DARK: "#23a54c",
    CYAN: "#16dbbd",
    CYAN_TINT: "#58ebdf",
    BLUE: "#39a0fa",
    BLUE_TINT: "#43bdff",
    PURPLE: "#b762f0",
    PURPLE_TINT: "#e074f7",
    PINK: "#ff5ed5",
    PINK_TINT: "#ff83c6",
};
