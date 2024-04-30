window.addEventListener("load", () => {
    let element = document.getElementById("vertedge-application-container");
    window.VERTEDGE_INSTANCE = new vertedge.Vertedge(element);
}, { once: true });
