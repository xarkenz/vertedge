import { Vertedge } from "./vertedge";

declare global {
    var VERTEDGE: Vertedge;
}

window.addEventListener("load", () => {
    let element = document.getElementById("vertedge-application-container");
    if (!element) {
        throw new Error("Vertedge could not find element to bind to!");
    }
    globalThis.VERTEDGE = new Vertedge(element);
}, { once: true });
