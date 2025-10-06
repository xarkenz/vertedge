var apper;

var vertedge = vertedge || (() => {

    const config = {
        assetsRoot: "./assets/vertedge/",
        curveSamplingInterval: 0.01,
        revertProximityPixels: 8,
        resizeProximityPixels: 12,
        straightenCurveRadius: 20,
        scrollZoomMultiplier: 0.0005,
        keyZoomAmount: 0.1,
        defaultLineDash: [2, 2],
    };

    function getAsset(path) {
        return config.assetsRoot + path;
    }


    // Position at t for quadratic beziér curve
    // (t²)r + (2t(1-t))q + ((1-t)²)p
    function quadraticCurve(t, p, q, r) {
        return r.mul(t * t).add(q.mul(2 * t * (1 - t))).add(p.mul((1 - t) * (1 - t)));
    }

    // Velocity (derivative of position) at t for quadratic beziér curve
    // (2t)r + (2-4t)q - (2-2t)p
    function quadraticCurveVelocity(t, p, q, r) {
        return r.mul(2 * t).add(q.mul(2 - 4 * t)).sub(p.mul(2 - 2 * t));
    }

    function quadraticCurveVertexX(p, q, r) {
        return (-q.x * q.x + 2 * q.x * r.x - r.x * r.x) / (p.x - 2 * q.x + r.x) + r.x;
    }

    function quadraticCurveVertexY(p, q, r) {
        return (-q.y * q.y + 2 * q.y * r.y - r.y * r.y) / (p.y - 2 * q.y + r.y) + r.y;
    }

    function orientationOf(p1, p2, p3) {
        return Math.sign((p2.y - p1.y) * (p3.x - p2.x) - (p2.x - p1.x) * (p3.y - p2.y));
    }

    function linesIntersect(p1, q1, p2, q2) {
        return orientationOf(p1, q1, p2) != orientationOf(p1, q1, q2) && orientationOf(p2, q2, p1) != orientationOf(p2, q2, q1);
    }

    function getFillColorIcon(color) {
        return color === Color.NONE ? getAsset("icons/transparent.svg") : `\
            <svg version="1.1" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
                <ellipse fill="${color}" stroke="none" cx="16" cy="16" rx="9" ry="9"/>
            </svg>`;
    }

    function getStrokeColorIcon(color) {
        return color === Color.NONE ? getAsset("icons/transparent.svg") : `\
            <svg version="1.1" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
                <ellipse fill="none" stroke="${color}" stroke-width="2" cx="16" cy="16" rx="8" ry="8"/>
            </svg>`;
    }


    // TODO: eliminate the need to really even store these. the tools should be actions that handle their own state.
    const Tools = {
        SELECT: new apper.Tool("select", "Select", getAsset("icons/select.svg"), new apper.Shortcut("v")),
        MOVE: new apper.Tool("move", "Move", getAsset("icons/move.svg"), new apper.Shortcut("m")),
        DRAW: new apper.Tool("draw", "Draw", getAsset("icons/draw.svg"), new apper.Shortcut("d")),
        ERASE: new apper.Tool("erase", "Erase", getAsset("icons/erase.svg"), new apper.Shortcut("x")),
        STYLE: new apper.Tool("style", "Style", getAsset("icons/style.svg"), new apper.Shortcut("s")),
        GRID: new apper.Tool("grid", "Grid", getAsset("icons/grid.svg"), new apper.Shortcut("g")),
        CAPTURE: new apper.Tool("capture", "Capture", getAsset("icons/capture.svg")),
        DATA: new apper.Tool("data", "View Data", getAsset("icons/data.svg")),
        LOAD: new apper.Tool("load", "Load", getAsset("icons/load.svg")),
        SAVE: new apper.Tool("save", "Save", getAsset("icons/save.svg")),
        HELP: new apper.Tool("help", "Help", getAsset("icons/help.svg"), new apper.Shortcut("h")),
    };

    // TODO: store more information
    const Shape = {
        CIRCLE: 0,
        SQUARE: 1,
        DIAMOND: 2,
    };

    const Color = {
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


    class Vertex {
        constructor(data = null) {
            data ||= {};
            this.x = data.x ?? 0;
            this.y = data.y ?? 0;
            this.r = data.r ?? 10;
            this.fill = data.fill ?? Color.DARK;
            this.stroke = data.stroke ?? Color.LIGHT;
            this.lineWidth = data.lineWidth ?? 4;
            this.lineDash = (data.lineDash ?? []).slice();
            this.shape = data.shape ?? Shape.CIRCLE;
        }

        copy() {
            return new Vertex(this);
        }

        margin() {
            return (this.shape === Shape.DIAMOND ? 1.3 : 1) * this.r + 0.5 * this.lineWidth;
        }

        path(ctx, view = null) {
            view ||= new apper.Viewport();
            this.r = Math.abs(this.r);
            let pos = view.transform(this);
            ctx.beginPath();
            switch (this.shape) {
                case Shape.CIRCLE:
                default:
                    ctx.ellipse(pos.x, pos.y, this.r * view.zoom, this.r * view.zoom, 0, 0, 2 * Math.PI);
                    break;
                case Shape.SQUARE:
                    ctx.rect(pos.x - this.r * view.zoom, pos.y - this.r * view.zoom, 2 * this.r * view.zoom, 2 * this.r * view.zoom);
                    break;
                case Shape.DIAMOND:
                    ctx.moveTo(pos.x, pos.y - 1.3 * this.r * view.zoom);
                    ctx.lineTo(pos.x - 1.3 * this.r * view.zoom, pos.y);
                    ctx.lineTo(pos.x, pos.y + 1.3 * this.r * view.zoom);
                    ctx.lineTo(pos.x + 1.3 * this.r * view.zoom, pos.y);
                    ctx.closePath();
                    break;
            }
        }

        draw(ctx, hover, select, highlight, view = null) {
            if (!view) view = new apper.Viewport();
            this.r = Math.abs(this.r);
            if (hover || select) {
                ctx.strokeStyle = select ? `${highlight}cc` : `${highlight}99`;
                ctx.lineWidth = this.lineWidth * view.zoom + 4;
                ctx.setLineDash([]);
                this.path(ctx, view);
                ctx.stroke();
            }
            ctx.fillStyle = this.fill;
            ctx.strokeStyle = this.stroke;
            ctx.lineWidth = this.lineWidth * view.zoom;
            ctx.setLineDash(this.lineDash.map(value => value * this.lineWidth * view.zoom));
            this.path(ctx, view);
            if (this.r > 0) {
                ctx.fill();
            }
            if (this.lineWidth > 0) {
                ctx.stroke();
            }
        }

        contains(ctx, pos, select, view = null, screen = false) {
            if (!view) view = new apper.Viewport();
            if (!screen) pos = view.transform(pos);
            ctx.lineWidth = select ? this.lineWidth * view.zoom + 4 : Math.max(this.lineWidth * view.zoom + 4, 12);
            this.path(ctx, view);
            return ctx.isPointInPath(pos.x * view.scale, pos.y * view.scale) || ctx.isPointInStroke(pos.x * view.scale, pos.y * view.scale);
        }
    }


    class Edge {
        constructor(data = null) {
            data ||= {};
            this.v1 = data.v1;
            this.v2 = data.v2 ?? data.v1;
            this.cp = data.cp == null ? null : Array.isArray(data.cp) ? new apper.Vector2(data.cp[0], data.cp[1]) : new apper.Vector2(data.cp);
            this.stroke = data.stroke ?? Color.DARK;
            this.lineWidth = data.lineWidth ?? 4;
            this.lineDash = (data.lineDash ?? []).slice();
        }

        copy() {
            return new Edge({...this, v1: this.v1.copy(), v2: this.isLoop() ? undefined : this.v2.copy()});
        }

        margin() {
            return 0.5 * this.lineWidth;
        }

        isCurveOrLoop() {
            return !!this.cp;
        }

        isCurve() {
            return this.isCurveOrLoop() && this.v1 !== this.v2;
        }

        isLoop() {
            return this.isCurveOrLoop() && this.v1 === this.v2;
        }

        path(ctx, view = null) {
            view ||= new apper.Viewport();
            ctx.beginPath();
            let v1 = view.transform(this.v1);
            let v2 = view.transform(this.v2);
            if (this.isCurve()) {
                let cp = view.transform(this.cp);
                ctx.moveTo(v1.x, v1.y);
                ctx.quadraticCurveTo(cp.x, cp.y, v2.x, v2.y);
            } else if (this.isLoop()) {
                let cp = view.transform(this.cp);
                let radius = 0.5 * Math.hypot(v1.x - cp.x, v1.y - cp.y);
                ctx.ellipse(0.5 * (v1.x + cp.x), 0.5 * (v1.y + cp.y), radius, radius, 0, 0, 2 * Math.PI);
            } else {
                ctx.moveTo(v1.x, v1.y);
                ctx.lineTo(v2.x, v2.y);
            }
        }

        draw(ctx, hover, select, highlight, view = null) {
            view ||= new apper.Viewport();
            if (hover || select) {
                ctx.strokeStyle = select ? `${highlight}cc` : `${highlight}99`;
                ctx.lineWidth = this.lineWidth * view.zoom + 4;
                ctx.setLineDash([]);
                this.path(ctx, view);
                ctx.stroke();
            }
            ctx.strokeStyle = this.stroke;
            ctx.lineWidth = this.lineWidth * view.zoom;
            ctx.setLineDash(this.lineDash.map(value => value * this.lineWidth * view.zoom));
            this.path(ctx, view);
            if (this.lineWidth > 0) {
                ctx.stroke();
            }
            if (select && this.isCurveOrLoop()) {
                let v1 = view.transform(this.v1);
                let v2 = view.transform(this.v2);
                let cp = view.transform(this.cp);
                if (this.isCurve()) {
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
                ctx.fillStyle = `${highlight}cc`;
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(cp.x, cp.y + 8);
                ctx.lineTo(cp.x + 8, cp.y);
                ctx.lineTo(cp.x, cp.y - 8);
                ctx.lineTo(cp.x - 8, cp.y);
                ctx.closePath();
                ctx.fill();
            }
        }

        contains(ctx, pos, select, view = null, screen = false) {
            view ||= new apper.Viewport();
            if (!screen) {
                pos = view.transform(pos);
            }
            if (this.isCurveOrLoop()) {
                let cp = view.transform(this.cp);
                ctx.beginPath();
                ctx.ellipse(cp.x, cp.y, 10, 10, 0, 0, 2 * Math.PI);
                if (ctx.isPointInPath(pos.x * view.scale, pos.y * view.scale)) {
                    return true;
                }
            }
            ctx.lineWidth = select ? this.lineWidth * view.zoom + 4 : Math.max(this.lineWidth * view.zoom + 4, 12);
            this.path(ctx, view);
            return ctx.isPointInStroke(pos.x * view.scale, pos.y * view.scale);
        }
    }


    class Vertedge {
        vertices = [];
        edges = [];
        selection = [];
        dragState = null;
        firstVertex = null;
        color = "";
        captureArea = null;

        constructor(element) {
            this.app = new apper.GraphicalEditor(element)
                .onUpdate(this.render.bind(this))
                .onMouseDown(this.handleMouseDown.bind(this))
                .onMouseMove(this.handleMouseMove.bind(this))
                .onMouseUp(this.handleMouseUp.bind(this))
                .onContextMenu(this.openContextMenu.bind(this))
                .onWheel(this.handleScroll.bind(this))
                .onKeyDown(this.handleKeyDown.bind(this))
                .setDefaultTitle("Untitled Graph");

            this.app.addToolbar()
                .addTool(Tools.SELECT, true)
                .addTool(Tools.MOVE)
                .addTool(Tools.DRAW)
                .addTool(Tools.ERASE)
                .addTool(Tools.STYLE)
                .addTool(Tools.GRID)
                .addSpacer()
                .addTool(Tools.CAPTURE)
                .addTool(Tools.LOAD)
                .addTool(Tools.SAVE)
                .addTool(Tools.DATA)
                .addTool(Tools.HELP);

            this.widget = {};

            this.colorOptions = [
                Color.NONE, Color.LIGHT, Color.MEDIUM, Color.DARK, Color.RED, Color.ORANGE,
                Color.YELLOW, Color.GREEN, Color.CYAN, Color.BLUE, Color.PURPLE, Color.PINK,
            ];
            this.shapeOptions = [
                getAsset("icons/shape-circle.svg"),
                getAsset("icons/shape-square.svg"),
                getAsset("icons/shape-diamond.svg"),
            ];

            this.exampleURLs = [
                "examples/complete-4",
                "examples/complete-5",
                "examples/complete-3-3"
            ];
            this.exampleTitles = [
                "Complete Graph: n = 4",
                "Complete Graph: n = 5",
                "Complete Bipartite Graph: m = 3, n = 3"
            ];

            this.stylePanel = this.app.addPanel("Element Style")
                .addSeparator()
                .add(this.widget.fillColor = new apper.widget.HSpread("vertedge-fill-color", "Fill color:", this.colorOptions.map(color => getFillColorIcon(color)), getAsset("icons/color.svg"))
                    .onChange(value => {
                        this.selection.forEach(element => {
                            if (element instanceof Vertex) {
                                element.fill = this.colorOptions[value];
                            }
                        });
                        this.app.update();
                    }))
                .add(this.widget.lineColor = new apper.widget.HSpread("vertedge-line-color", "Line color:", this.colorOptions.map(color => getStrokeColorIcon(color)), getAsset("icons/stroke.svg"))
                    .onChange(value => {
                        this.selection.forEach(element => {
                            element.stroke = this.colorOptions[value];
                        });
                        this.app.update();
                    }))
                .addSeparator()
                .add(this.widget.vertexShape = new apper.widget.HSpread("vertedge-vertex-shape", "Shape:", this.shapeOptions, getAsset("icons/shape.svg"))
                    .onChange(value => {
                        this.selection.forEach(element => {
                            if (element instanceof Vertex) {
                                element.shape = value;
                            }
                        });
                        this.app.update();
                    }))
                .add(this.widget.vertexRadius = new apper.widget.NumberInput("vertedge-vertex-radius", "Radius:", getAsset("icons/radius.svg")).setMin(0)
                    .onChange(value => {
                        this.selection.forEach(element => {
                            if (element instanceof Vertex) {
                                element.r = value;
                            }
                        });
                        this.app.update();
                    }))
                .add(this.widget.lineWidth = new apper.widget.NumberInput("vertedge-line-width", "Line width:", getAsset("icons/line-width.svg")).setMin(0)
                    .onChange(value => {
                        this.selection.forEach(element => {
                            element.lineWidth = value;
                        });
                        this.app.update();
                    }))
                .add(this.widget.lineDash = new apper.widget.Checkbox("vertedge-line-dash", "Dashed line")
                    .onChange(value => {
                        this.selection.forEach(element => {
                            element.lineDash = value ? config.defaultLineDash : [];
                        });
                        this.app.update();
                    }));

            this.gridPanel = this.app.addPanel("Grid Settings")
                .addSeparator()
                .add(this.widget.enableAxes = new apper.widget.Checkbox("vertedge-show-axes", "Show axes")
                    .onChange(value => this.app.update()))
                .add(this.widget.enableGrid = new apper.widget.Checkbox("vertedge-enable-grid", "Enable grid")
                    .onChange(value => this.app.update()))
                .add(this.widget.gridStepX = new apper.widget.NumberInput("vertedge-grid-step-x", "Horizontal spacing:", getAsset("icons/width.svg"), 50).setMin(1)
                    .onChange(value => this.app.update()))
                .add(this.widget.gridStepY = new apper.widget.NumberInput("vertedge-grid-step-y", "Vertical spacing:", getAsset("icons/height.svg"), 50).setMin(1)
                    .onChange(value => this.app.update()));

            this.capturePanel = this.app.addPanel("Capture Image")
                .addSeparator()
                .add(this.widget.capturePrompt = new apper.widget.Paragraph("To capture a graph image, try adding some elements to the graph."))
                .add(this.widget.captureInstructions = new apper.widget.Paragraph("Resize the box to crop the resulting image. To move the view, drag from outside the box.").hide())
                .add(this.widget.captureSelectionOnly = new apper.widget.Checkbox("vertedge-capture-selection-only", "Capture selection only").hide()
                    .onChange(value => this.app.update()))
                .add(this.widget.captureFitGraph = new apper.widget.Button("Fit Entire Graph").hide()
                    .onClick(() => {
                        this.fitCaptureTo(this.vertices.concat(this.edges));
                        this.app.update();
                    }))
                .addSeparator()
                .add(this.widget.captureEmptyPreview = new apper.widget.Paragraph("An image preview will appear here."))
                .add(this.widget.capturePreview = new apper.widget.CanvasImage("Preview:").hide())
                .add(this.widget.captureDownload = new apper.widget.Button(`<img src="${getAsset("icons/download.svg")}"> Download as PNG`).hide());
            
            this.saveModal = this.app.addModal("Save Graph")
                .addSeparator()
                .add(new apper.widget.Paragraph("Save the state of your graph to a file on your device:"))
                .add(this.widget.saveDownload = new apper.widget.Button(`<img src="${getAsset("icons/download.svg")}"> Download JSON`))

            this.loadModal = this.app.addModal("Load a Graph")
                .addSeparator()
                .add(new apper.widget.Paragraph("Import an existing graph from your device by clicking the button below:"))
                .add(new apper.widget.FileInput(`<img src="${getAsset("icons/upload.svg")}"> Upload JSON`)
                    .onChange(files => {
                        this.app.update();
                        this.loadFromFile(files?.[0]);
                        this.app.tool = this.app.toolbar.defaultTool;
                    }))
                .add(new apper.widget.ButtonList("Example Graphs:", this.exampleURLs, this.exampleTitles)
                    .onClick(url => {
                        this.app.update();
                        this.loadFromURL(url);
                        this.app.tool = this.app.toolbar.defaultTool;
                    }));

            this.dataPanel = this.app.addPanel("Raw Graph Data")
                .addSeparator()
                .add(this.widget.dataEditor = new apper.widget.TextEditor("vertedge-data-editor", "Raw JSON data...")
                    .onChange(text => {
                        if (!text) {
                            this.loadFromData({});
                        } else {
                            try {
                                this.loadFromData(JSON.parse(text));
                                this.widget.dataEditor.valid = true;
                            } catch (err) {
                                if (!(err instanceof SyntaxError)) {
                                    console.error(err);
                                }
                                this.widget.dataEditor.valid = false;
                            }
                        }
                        this.app.update();
                    }));

            this.helpModal = this.app.addModal("Vertedge Help")
                .addSeparator()
                .add(new apper.widget.Paragraph("Hi! I built this in my spare time a while back, so I hope you'll understand that this is still a bit rough around the <i>edges</i> (pun intended)."))
                .add(new apper.widget.Paragraph("If you still need help beyond this page, you can email me at <a href='mailto:seanedwardsclarke@gmail.com' target='_blank' rel='noopener noreferrer'>seanedwardsclarke@gmail.com</a>."))
                .add(new apper.widget.Paragraph("Found a bug or issue? You can report it on <a href='https://github.com/xarkenz/vertedge/issues' target='_blank' rel='noopener noreferrer'>the GitHub page</a> or in an email to the address above. Thanks for your help!"))
                .addSeparator()
                .add(new apper.widget.Paragraph(`<img class="vertedge-help-tool-icon" src="${getAsset("icons/select.svg")}"><b>Select</b> - <kbd>V</kbd><br>This is the default tool. Click on vertices and edges to select them, and drag them to move them around. If you drag an edge, it will become a curve which you can adjust to your needs. To select multiple elements at once, drag from empty space to select a region or hold <kbd>Shift</kbd> when clicking on elements.`))
                .add(new apper.widget.Paragraph(`<img class="vertedge-help-tool-icon" src="${getAsset("icons/move.svg")}"><b>Move</b> - <kbd>M</kbd><br>This tool allows you to move the entire view by dragging. This can be especially helpful if you find yourself running out of room on the screen.`))
                .add(new apper.widget.Paragraph(`<img class="vertedge-help-tool-icon" src="${getAsset("icons/draw.svg")}"><b>Draw</b> - <kbd>D</kbd><br>This tool allows you to create new edges and vertices by clicking and dragging. You can split edges by clicking on them. While drawing an edge, holding <kbd>Ctrl</kbd>/<kbd>⌘Cmd</kbd> creates a loop which connects a vertex to itself.`))
                .add(new apper.widget.Paragraph(`<img class="vertedge-help-tool-icon" src="${getAsset("icons/erase.svg")}"><b>Erase</b> - <kbd>X</kbd><br>Use this tool to remove vertices and edges from the graph. You can also use <kbd>Delete</kbd> or <kbd>Backspace</kbd> to remove the current selection in any mode. If a vertex is removed, all connecting edges are removed.`))
                .add(new apper.widget.Paragraph(`<img class="vertedge-help-tool-icon" src="${getAsset("icons/style.svg")}"><b>Style</b> - <kbd>S</kbd><br>This tool allows you to modify the appearance of selected elements through a menu.`))
                .add(new apper.widget.Paragraph(`<img class="vertedge-help-tool-icon" src="${getAsset("icons/grid.svg")}"><b>Grid</b> - <kbd>G</kbd><br>This menu allows you to enable/disable and modify settings for a grid if you want to make your graph more orderly.`))
                .add(new apper.widget.Paragraph(`<img class="vertedge-help-tool-icon" src="${getAsset("icons/capture.svg")}"><b>Capture</b><br>This tool allows you to download a PNG image of a region of your graph with a transparent background for convenience. If any graph elements are currently selected and the "Capture selection only" option is used, unselected elements will not be included in the capture. The resolution of a capture is currently fixed at 1 unit = 1 pixel, but this may change in the future.`))
                .add(new apper.widget.Paragraph(`<img class="vertedge-help-tool-icon" src="${getAsset("icons/load.svg")}"><b>Load</b> - <kbd>Ctrl</kbd>/<kbd>⌘Cmd</kbd> <kbd>O</kbd><br>This menu allows you to load a graph either from a file on your device or from the list of examples.`))
                .add(new apper.widget.Paragraph(`<img class="vertedge-help-tool-icon" src="${getAsset("icons/save.svg")}"><b>Save</b> - <kbd>Ctrl</kbd>/<kbd>⌘Cmd</kbd> <kbd>S</kbd><br>This menu allows you to save the current graph to a file on your device. Unfortunately, cloud saving is not supported. Maybe someday.`))
                .add(new apper.widget.Paragraph(`<img class="vertedge-help-tool-icon" src="${getAsset("icons/data.svg")}"><b>View Data</b><br>This menu contains the raw JSON data for the graph. You can mess around with it if you like, and the graph will update dynamically. Usually, you won't need to use this.`))
                .add(new apper.widget.Paragraph(`<img class="vertedge-help-tool-icon" src="${getAsset("icons/help.svg")}"><b>Help</b> - <kbd>H</kbd><br>You are here. Congratulations!`))
                .addSeparator()
                .add(new apper.widget.Paragraph(`<b>Zoom In</b> - <kbd>+</kbd><br>Zoom in to the graph by a fixed amount.`))
                .add(new apper.widget.Paragraph(`<b>Zoom Out</b> - <kbd>-</kbd><br>Zoom out of the graph by a fixed amount.`))
                .add(new apper.widget.Paragraph(`<b>Zoom Default</b> - <kbd>0</kbd><br>Zoom to the default zoom level.`))
                .add(new apper.widget.Paragraph(`<b>Center View</b> - <kbd>.</kbd><br>Move the view to the center of the graph.`))
                .add(new apper.widget.Paragraph(`<b>Select All</b> - <kbd>Ctrl</kbd>/<kbd>⌘Cmd</kbd> <kbd>A</kbd><br>Select all elements in the graph.`))
                .add(new apper.widget.Paragraph(`<b>Deselect All</b> - <kbd>Ctrl</kbd>/<kbd>⌘Cmd</kbd> <kbd>Shift</kbd> <kbd>A</kbd> or <kbd>Esc</kbd><br>Deselect all currently selected graph elements.`))
                .add(new apper.widget.Paragraph(`<b>Erase Selected</b> - <kbd>Delete</kbd> or <kbd>Backspace</kbd><br>Remove all currently selected elements from the graph. If a vertex is removed, all connecting edges are removed.`));

            this.app.update();

            let graphSourceURL = new URLSearchParams(window.location.search).get("src");
            if (graphSourceURL) {
                this.loadFromURL(graphSourceURL);
            }
        }

        isDragMode() {
            return !!this.dragState;
        }

        gridSettings() {
            return {
                axesVisible: this.widget.enableAxes.checked,
                gridEnabled: this.widget.enableGrid.checked,
                xStep: this.widget.gridStepX.value,
                yStep: this.widget.gridStepY.value,
            };
        }

        render() {
            let element = this.app.tool === Tools.MOVE || this.app.tool === Tools.CAPTURE ? null : this.elementAt(this.app.cursorPos);
            this.color = this.app.tool === Tools.DRAW ? Color.GREEN_DARK
                : this.app.tool === Tools.ERASE ? Color.RED
                : Color.PURPLE;
            let resizeBoxRegion = this.app.tool === Tools.CAPTURE ? this.getResizeBoxRegion() : null;

            if (this.app.tool !== Tools.DRAW) {
                this.firstVertex = null;
            }

            if (this.app.tool === Tools.STYLE && this.selection.length) {
                if (this.selection.some(element => element instanceof Vertex)) {
                    this.widget.fillColor.element.style.display = "";
                    this.widget.vertexShape.element.style.display = "";
                    this.widget.vertexRadius.element.style.display = "";

                    let fillColor = null;
                    for (let element of this.selection) {
                        if (element instanceof Vertex) {
                            if (fillColor === null) {
                                fillColor = this.colorOptions.indexOf(element.fill);
                            } else if (element.fill !== fillColor) {
                                fillColor = null;
                                break;
                            }
                        }
                    }
                    if (fillColor === -1) {
                        fillColor = null;
                    }
                    this.widget.fillColor.value = fillColor;

                    let shape = null;
                    for (let element of this.selection) {
                        if (element instanceof Vertex) {
                            if (shape === null) {
                                shape = element.shape;
                            } else if (element.shape !== shape) {
                                shape = null;
                                break;
                            }
                        }
                    }
                    this.widget.vertexShape.value = shape;

                    let radius = null;
                    for (let element of this.selection) {
                        if (element instanceof Vertex) {
                            if (radius === null) {
                                radius = element.r;
                            } else if (element.r !== radius) {
                                radius = null;
                                break;
                            }
                        }
                    }
                    this.widget.vertexRadius.value = radius ?? 10;
                } else {
                    this.widget.fillColor.element.style.display = "none";
                    this.widget.vertexShape.element.style.display = "none";
                    this.widget.vertexRadius.element.style.display = "none";
                }

                let lineColor = null;
                for (let element of this.selection) {
                    if (lineColor === null) {
                        lineColor = this.colorOptions.indexOf(element.stroke);
                    } else if (element.stroke !== lineColor) {
                        lineColor = null;
                        break;
                    }
                }
                if (lineColor === -1) {
                    lineColor = null;
                }
                this.widget.lineColor.value = lineColor;

                let lineWidth = null;
                for (let element of this.selection) {
                    if (lineWidth === null) {
                        lineWidth = element.lineWidth;
                    } else if (element.lineWidth !== lineWidth) {
                        lineWidth = null;
                        break;
                    }
                }
                this.widget.lineWidth.value = lineWidth ?? 4;

                this.widget.lineDash.checked = this.selection.some(element => element.lineDash.length > 1);

                this.stylePanel.show();
            } else {
                this.stylePanel.hide();
            }

            if (this.app.tool === Tools.GRID) {
                this.gridPanel.show();
            } else {
                this.gridPanel.hide();
            }

            if (this.app.tool === Tools.CAPTURE) {
                if (!this.captureArea) {
                    this.fitCaptureTo(this.selection.length > 0 ? this.selection : this.vertices.concat(this.edges));
                }
                if (!this.captureArea) {
                    this.widget.capturePrompt.show();
                    this.widget.captureEmptyPreview.show();
                    this.widget.captureInstructions.hide();
                    this.widget.captureSelectionOnly.hide();
                    this.widget.captureFitGraph.hide();
                    this.widget.capturePreview.hide();
                    this.widget.captureDownload.hide();

                    this.widget.captureDownload.url = "";
                    this.widget.captureDownload.filename = "";
                } else {
                    this.widget.capturePrompt.hide();
                    this.widget.captureEmptyPreview.hide();
                    this.widget.captureInstructions.show();
                    this.widget.captureSelectionOnly.show();
                    this.widget.captureFitGraph.show();
                    this.widget.capturePreview.show();
                    this.widget.captureDownload.show();

                    if (this.selection.length > 0) {
                        this.widget.captureSelectionOnly.enable();
                    } else {
                        this.widget.captureSelectionOnly.disable().setChecked(false);
                    }

                    this.widget.capturePreview.label = `Preview (${this.captureArea.w} \u00d7 ${this.captureArea.h}):`
                    this.widget.capturePreview.resize(this.captureArea.w, this.captureArea.h);
                    this.widget.capturePreview.ctx.resetTransform();
                    this.widget.capturePreview.ctx.clearRect(0, 0, this.widget.capturePreview.canvas.width, this.widget.capturePreview.canvas.height);
                    this.widget.capturePreview.ctx.translate(-this.captureArea.x, -this.captureArea.y);
                    this.widget.capturePreview.ctx.lineCap = "round";
                    this.widget.capturePreview.ctx.lineJoin = "round";

                    // TODO: users should be able to modify resolution through capture menu
                    this.edges.forEach(edge => {
                        if (!this.widget.captureSelectionOnly.checked || this.selection.includes(edge)) {
                            edge.draw(this.widget.capturePreview.ctx, false, false, this.color);
                        }
                    });
                    this.vertices.forEach(vertex => {
                        if (!this.widget.captureSelectionOnly.checked || this.selection.includes(vertex)) {
                            vertex.draw(this.widget.capturePreview.ctx, false, false, this.color);
                        }
                    });

                    this.widget.captureDownload.url = this.widget.capturePreview.canvas.toDataURL("image/png");
                    this.widget.captureDownload.filename = `${this.app.title}.png`;
                }

                this.capturePanel.show();
            } else {
                this.capturePanel.hide();
                
                this.captureArea = null;
                this.widget.captureDownload.url = "";
                this.widget.captureDownload.filename = "";
            }

            if (this.app.tool === Tools.LOAD) {
                this.loadModal.show();
            } else {
                this.loadModal.hide();
            }

            if (this.app.tool === Tools.SAVE) {
                this.widget.saveDownload.url = `data:application/json;base64,${btoa(this.getGraphData())}`;
                this.widget.saveDownload.filename = `${this.app.title}.json`;

                this.saveModal.show();
            } else {
                this.saveModal.hide();

                this.widget.saveDownload.url = "";
                this.widget.saveDownload.filename = "";
            }

            if (this.app.tool === Tools.DATA) {
                if (!this.widget.dataEditor.editing) {
                    this.widget.dataEditor.text = this.getGraphData();
                    this.widget.dataEditor.valid = true;
                }

                this.dataPanel.show();
            } else {
                this.dataPanel.hide();
            }

            if (this.app.tool === Tools.HELP) {
                this.helpModal.show();
            } else {
                this.helpModal.hide();
            }

            // Set cursor appearance
            if (this.app.tool === Tools.MOVE || (this.isDragMode() && this.dragState.button === 2)) {
                this.app.element.style.cursor = this.isDragMode() ? "grabbing" : "";
                this.app.canvas.style.cursor = this.isDragMode() ? "" : "grab";
            } else if (this.app.tool === Tools.CAPTURE) {
                let resizeCursor = apper.util.getResizeCursor(this.dragState?.resizeBoxRegion ?? resizeBoxRegion);
                this.app.element.style.cursor = this.isDragMode() ? (resizeCursor ?? "grabbing") : "";
                this.app.canvas.style.cursor = this.isDragMode() ? "" : (resizeCursor ?? "grab");
            } else {
                this.app.element.style.cursor = "";
                this.app.canvas.style.cursor = "";
            }

            this.app.ctx.lineCap = "round";
            this.app.ctx.lineJoin = "round";

            // Draw grid and/or axes
            let { axesVisible, gridEnabled, xStep, yStep } = this.gridSettings();
            if (gridEnabled || axesVisible) {
                let topLeft = this.app.locate(new apper.Vector2(0, 0)), bottomRight = this.app.locate(new apper.Vector2(this.app.width, this.app.height));
                let startX = this.app.transformX(Math.floor(topLeft.x / xStep) * xStep);
                let startY = this.app.transformY(Math.floor(topLeft.y / yStep) * yStep);
                let endX = this.app.transformX(Math.ceil(bottomRight.x / xStep) * xStep);
                let endY = this.app.transformY(Math.ceil(bottomRight.y / yStep) * yStep);
                let x0 = this.app.transformX(0);
                let y0 = this.app.transformY(0);

                this.app.ctx.lineWidth = 2;
                this.app.ctx.setLineDash([]);

                if (gridEnabled) {
                    this.app.ctx.strokeStyle = "#fff1";
                    this.app.ctx.beginPath();
                    if (xStep * this.app.view.zoom >= 8) {
                        for (let x = startX; x <= endX; x += xStep * this.app.view.zoom) {
                            if (axesVisible && x === x0) {
                                continue;
                            }
                            this.app.ctx.moveTo(x, 0);
                            this.app.ctx.lineTo(x, this.app.height);
                        }
                    }
                    if (yStep * this.app.view.zoom >= 8) {
                        for (let y = startY; y <= endY; y += yStep * this.app.view.zoom) {
                            if (axesVisible && y === y0) {
                                continue;
                            }
                            this.app.ctx.moveTo(0, y);
                            this.app.ctx.lineTo(this.app.width, y);
                        }
                    }
                    this.app.ctx.stroke();
                }

                if (axesVisible) {
                    this.app.ctx.strokeStyle = "#fff3";
                    this.app.ctx.beginPath();
                    this.app.ctx.moveTo(startX, y0);
                    this.app.ctx.lineTo(endX, y0);
                    this.app.ctx.moveTo(x0, startY);
                    this.app.ctx.lineTo(x0, endY);
                    this.app.ctx.stroke();
                }
            }

            // Original element position indicators
            if (this.isDragMode() && this.dragState.elements.length > 0) {
                for (let element of this.dragState.elements) {
                    element.draw(this.app.ctx, false, false, this.color, this.app.view);
                    if (element instanceof Edge && element.isCurveOrLoop()) {
                        let cp = this.app.view.transform(element.cp);
                        this.app.ctx.strokeStyle = `${this.color}77`;
                        this.app.ctx.lineWidth = 2;
                        this.app.ctx.setLineDash([]);
                        this.app.ctx.beginPath();
                        this.app.ctx.moveTo(cp.x, cp.y + 6);
                        this.app.ctx.lineTo(cp.x + 6, cp.y);
                        this.app.ctx.lineTo(cp.x, cp.y - 6);
                        this.app.ctx.lineTo(cp.x - 6, cp.y);
                        this.app.ctx.closePath();
                        this.app.ctx.stroke();
                    }
                }
            }

            // Edges, then vertices (last index appears on top, vertices always in front of edges)
            this.edges.forEach(edge => {
                edge.draw(this.app.ctx, !this.isDragMode() && element === edge, this.selection.includes(edge), this.color, this.app.view);
            });
            this.vertices.forEach(vertex => {
                vertex.draw(this.app.ctx, !this.isDragMode() && element === vertex, this.selection.includes(vertex), this.color, this.app.view);
            });

            // Draw tool indicators
            if (this.isDragMode() && (this.dragState.button === 2 || this.app.tool === Tools.MOVE || this.app.tool === Tools.CAPTURE)) {
                // Draw drag start indicator
                this.app.ctx.strokeStyle = "#fff2";
                this.app.ctx.lineWidth = 2;
                this.app.ctx.setLineDash([]);
                this.app.ctx.beginPath();
                this.app.ctx.moveTo(this.dragState.x, this.dragState.y - 8);
                this.app.ctx.lineTo(this.dragState.x, this.dragState.y + 8);
                this.app.ctx.moveTo(this.dragState.x - 8, this.dragState.y);
                this.app.ctx.lineTo(this.dragState.x + 8, this.dragState.y);
                this.app.ctx.stroke();
            }
            else if (this.app.tool === Tools.DRAW && !this.app.cursorPos.equals(0, 0)) {
                let pos = gridEnabled ? this.app.transform(this.snapToGrid(this.app.locate(this.app.cursorPos))) : this.app.cursorPos;
                if (this.firstVertex != null) {
                    this.app.ctx.strokeStyle = `${this.color}aa`;
                    this.app.ctx.lineWidth = 2;
                    this.app.ctx.setLineDash([5, 5]);
                    this.app.ctx.beginPath();
                    let start = this.app.transform(this.firstVertex);
                    if (this.app.ctrlKey) {
                        // Draw loop preview
                        let radius = 0.5 * Math.hypot(pos.x - start.x, pos.y - start.y);
                        this.app.ctx.ellipse(0.5 * (pos.x + start.x), 0.5 * (pos.y + start.y), radius, radius, 0, 0, 2 * Math.PI);
                    } else {
                        // Draw straight edge preview
                        this.app.ctx.moveTo(start.x, start.y);
                        if (element instanceof Vertex) {
                            this.app.ctx.lineTo(this.app.transformX(element.x), this.app.transformY(element.y));
                        } else {
                            this.app.ctx.lineTo(pos.x, pos.y);
                        }
                    }
                    this.app.ctx.stroke();
                    // Draw dot on start vertex
                    this.app.ctx.fillStyle = `${this.color}aa`;
                    this.app.ctx.beginPath();
                    this.app.ctx.ellipse(start.x, start.y, 5, 5, 0, 0, 2 * Math.PI);
                    this.app.ctx.fill();
                }
                // Draw dot under cursor (snapped to grid)
                this.app.ctx.fillStyle = `${this.color}aa`;
                this.app.ctx.beginPath();
                this.app.ctx.ellipse(pos.x, pos.y, 5, 5, 0, 0, 2 * Math.PI);
                this.app.ctx.fill();
            }
            else if (this.isDragMode() && !this.dragState.elements.length && !this.app.cursorPos.equals(0, 0)) {
                // Draw selection box
                this.app.ctx.strokeStyle = `${this.color}77`;
                this.app.ctx.lineWidth = 2;
                this.app.ctx.setLineDash([5, 5]);
                // Below differs from ctx.rect() because it locks the line dash at the start and end corners, which looks nicer
                this.app.ctx.beginPath();
                this.app.ctx.moveTo(this.dragState.x, this.dragState.y);
                this.app.ctx.lineTo(this.app.cursorPos.x, this.dragState.y);
                this.app.ctx.moveTo(this.dragState.x, this.dragState.y);
                this.app.ctx.lineTo(this.dragState.x, this.app.cursorPos.y);
                this.app.ctx.moveTo(this.app.cursorPos.x, this.app.cursorPos.y);
                this.app.ctx.lineTo(this.dragState.x, this.app.cursorPos.y);
                this.app.ctx.moveTo(this.app.cursorPos.x, this.app.cursorPos.y);
                this.app.ctx.lineTo(this.app.cursorPos.x, this.dragState.y);
                this.app.ctx.stroke();
            }

            // Capture box
            if (this.app.tool === Tools.CAPTURE && this.captureArea != null) {
                const rect = this.captureArea.transformed(this.app.view);
                const cx = Math.round(rect.cx), cy = Math.round(rect.cy);
                this.app.ctx.fillStyle = `${Color.ORANGE}33`;
                this.app.ctx.strokeStyle = `${Color.ORANGE}aa`;
                this.app.ctx.lineWidth = 2;
                this.app.ctx.setLineDash([]);
                this.app.ctx.beginPath();
                this.app.ctx.rect(rect.x, rect.y, rect.w, rect.h);
                this.app.ctx.fill();
                // Resize handles
                this.app.ctx.rect(rect.x - 6, rect.y - 6, 12, 12);
                this.app.ctx.rect(rect.xw - 6, rect.y - 6, 12, 12);
                this.app.ctx.rect(rect.xw - 6, rect.yh - 6, 12, 12);
                this.app.ctx.rect(rect.x - 6, rect.yh - 6, 12, 12);
                if (rect.w > 2 * config.resizeProximityPixels) {
                    this.app.ctx.rect(cx - 6, rect.y - 6, 12, 12);
                    this.app.ctx.rect(cx - 6, rect.yh - 6, 12, 12);
                }
                if (rect.h > 2 * config.resizeProximityPixels) {
                    this.app.ctx.rect(rect.xw - 6, cy - 6, 12, 12);
                    this.app.ctx.rect(rect.x - 6, cy - 6, 12, 12);
                }
                this.app.ctx.stroke();
                // Indicator for hovering over a box resize handle
                if (this.dragState?.resizeBoxRegion ?? resizeBoxRegion != null) {
                    this.app.ctx.fillStyle = this.dragState?.resizeBoxRegion != null ? `${Color.ORANGE}aa` : `${Color.ORANGE}77`;
                    this.app.ctx.beginPath();
                    const BoxRegion = apper.util.BoxRegion;
                    switch (this.dragState?.resizeBoxRegion ?? resizeBoxRegion) {
                        case BoxRegion.NEGATIVE_Y: this.app.ctx.rect(cx - 6, rect.y - 6, 12, 12); break;
                        case BoxRegion.POSITIVE_X: this.app.ctx.rect(rect.xw - 6, cy - 6, 12, 12); break;
                        case BoxRegion.POSITIVE_Y: this.app.ctx.rect(cx - 6, rect.yh - 6, 12, 12); break;
                        case BoxRegion.NEGATIVE_X: this.app.ctx.rect(rect.x - 6, cy - 6, 12, 12); break;
                        case BoxRegion.NEGATIVE_X_NEGATIVE_Y: this.app.ctx.rect(rect.x - 6, rect.y - 6, 12, 12); break;
                        case BoxRegion.POSITIVE_X_NEGATIVE_Y: this.app.ctx.rect(rect.xw - 6, rect.y - 6, 12, 12); break;
                        case BoxRegion.POSITIVE_X_POSITIVE_Y: this.app.ctx.rect(rect.xw - 6, rect.yh - 6, 12, 12); break;
                        case BoxRegion.NEGATIVE_X_POSITIVE_Y: this.app.ctx.rect(rect.x - 6, rect.yh - 6, 12, 12); break;
                        default: break;
                    }
                    this.app.ctx.fill();
                }
            }
        }

        handleMouseDown(event) {
            if (event.button === 0 || event.button === 2) {
                if (this.isDragMode() && event.button !== this.dragState.button) {
                    return true;
                }

                let canSelect = event.button !== 2 && this.app.tool !== Tools.MOVE && this.app.tool !== Tools.CAPTURE;
                let p = this.snapToGrid(event.worldPos);
                let element = canSelect ? this.elementAt(event.screenPos) : null;

                if (this.app.tool === Tools.DRAW && event.button === 0) {
                    if (element instanceof Vertex) {
                        if (this.firstVertex !== null) {
                            this.edges.push(new Edge({v1: this.firstVertex, v2: element}));
                        } else {
                            this.firstVertex = element;
                        }
                    }
                    else if (element instanceof Edge && !element.isLoop()) {
                        let placed = new Vertex(p);
                        this.vertices.push(placed);
                        let other = new Edge({v1: placed, v2: element.v2});
                        let p0 = new apper.Vector2(element.v1);
                        let p1 = new apper.Vector2(element.v2);
                        if (element.isCurve()) {
                            // Find closest point on curve
                            let cp = element.cp.copy();
                            let tNearest = 0;
                            let minimumDistance = Infinity;
                            let previousTest = Infinity;
                            for (let t = 0; t <= 1; t += config.curveSamplingInterval) {
                                let sample = quadraticCurve(t, p0, cp, p1);
                                let velocity = quadraticCurveVelocity(t, p0, cp, p1);
                                let distanceX = sample.x - p.x;
                                let distanceY = sample.y - p.y;
                                // Compute a stripped-down version of the derivative of distance which has the same roots
                                let test = distanceX * velocity.x + distanceY * velocity.y;
                                // Optimize by only checking endpoints and local minima of distance
                                if (t === 0 || t === 1 || previousTest <= 0 && test >= 0) {
                                    let distance = Math.hypot(distanceX, distanceY);
                                    if (distance < minimumDistance) {
                                        minimumDistance = distance;
                                        tNearest = t;
                                        placed.x = sample.x;
                                        placed.y = sample.y;
                                    }
                                }
                                previousTest = test;
                            }
                            element.cp.set(tNearest * cp.x + (1 - tNearest) * p0.x, tNearest * cp.y + (1 - tNearest) * p0.y);
                            other.cp = new apper.Vector2(tNearest * p1.x + (1 - tNearest) * cp.x, tNearest * p1.y + (1 - tNearest) * cp.y);
                        } else {
                            // Calculate closest point on line segment
                            let lineVector = p1.sub(p0);
                            let pointVector = p.sub(p0);
                            let scalarProjection = pointVector.dot(lineVector) / lineVector.magnitude();
                            if (scalarProjection <= 0) {
                                // Closest point is p0
                                placed.x = p0.x;
                                placed.y = p0.y;
                            } else if (scalarProjection >= lineVector.magnitude()) {
                                // Closest point is p1
                                placed.x = p1.x;
                                placed.y = p1.y;
                            } else {
                                // Closest point is between p0 and p1
                                let vectorProjection = lineVector.normalized().mul(scalarProjection);
                                placed.x = p0.x + vectorProjection.x;
                                placed.y = p0.y + vectorProjection.y;
                            }
                        }
                        // Split edge at the new vertex
                        element.v2 = placed;
                        this.edges.push(other);
                        element = placed;
                        if (this.firstVertex != null) {
                            this.edges.push(new Edge({v1: this.firstVertex, v2: placed}));
                            this.firstVertex = null;
                        } else {
                            this.firstVertex = element;
                        }
                    }
                    else {
                        let placed = new Vertex(p);
                        this.vertices.push(placed);
                        element = placed;
                        if (this.firstVertex != null && this.firstVertex !== element) {
                            this.edges.push(new Edge({v1: this.firstVertex, v2: placed}));
                            this.firstVertex = null;
                        } else {
                            this.firstVertex = element;
                        }
                    }
                }
                else if (this.app.tool === Tools.ERASE && event.button === 0) {
                    if (element) {
                        if (!this.selection.includes(element)) {
                            this.selection = [element];
                        }
                        this.deleteSelection();
                        element = null;
                    }
                }

                if (!element) {
                    if (canSelect && !event.shiftKey) {
                        this.selection = [];
                    }
                } else if (event.shiftKey) {
                    if (this.selection.includes(element)) {
                        this.selection.splice(this.selection.indexOf(element), 1);
                    } else {
                        this.selection.push(element);
                    }
                } else if (!this.selection.includes(element)) {
                    this.selection = [element];
                }

                let elements = event.shiftKey ? [] : this.selection.map(item => {
                    // TODO: use a flag instead of changing the actual style
                    let orig = item.copy();
                    if (orig.fill != null) {
                        orig.fill = Color.NONE;
                    }
                    orig.stroke = `${this.color}77`;
                    orig.lineWidth = 2;
                    orig.lineDash = [4, 4];
                    return orig;
                });
                let indices = event.shiftKey ? [] : this.selection.map(item => (
                    item instanceof Vertex ? this.vertices.indexOf(item) : this.edges.indexOf(item))
                );

                this.dragState = {
                    button: event.button,
                    x: event.screenPos.x,
                    y: event.screenPos.y,
                    view: this.app.view.copy(),
                    elements,
                    indices,
                    captureArea: this.captureArea,
                    resizeBoxRegion: this.getResizeBoxRegion(),
                };

                return true;
            }

            return false;
        }

        handleMouseMove(event) {
            if (event.screenPos.equals(0, 0)) {
                return false;
            }
            if (!this.isDragMode()) {
                return true;
            }
            if (!event.leftBtn && !event.rightBtn) {
                return true;
            }

            let dx = event.screenPos.x - this.dragState.x;
            let dy = event.screenPos.y - this.dragState.y;
            let revertX = Math.abs(dx) <= config.revertProximityPixels;
            let revertY = Math.abs(dy) <= config.revertProximityPixels;
            let revert = revertX && revertY;

            const BoxRegion = apper.util.BoxRegion;

            if (this.dragState.button === 2 || this.app.tool === Tools.MOVE || (this.app.tool === Tools.CAPTURE && this.dragState.resizeBoxRegion & BoxRegion.EXTERNAL)) {
                this.app.view.center.set(revert ? this.dragState.view.center : this.dragState.view.center.sub(dx * this.app.view.izoom, dy * this.app.view.izoom));
            }
            else if (this.app.tool === Tools.CAPTURE) {
                let l = this.dragState.captureArea.x;
                let r = this.dragState.captureArea.xw;
                let t = this.dragState.captureArea.y;
                let b = this.dragState.captureArea.yh;
                if (!revertY) {
                    if (this.dragState.resizeBoxRegion & BoxRegion.NEGATIVE_Y) t += dy * this.app.view.izoom;
                    if (this.dragState.resizeBoxRegion & BoxRegion.POSITIVE_Y) b += dy * this.app.view.izoom;
                }
                if (!revertX) {
                    if (this.dragState.resizeBoxRegion & BoxRegion.POSITIVE_X) r += dx * this.app.view.izoom;
                    if (this.dragState.resizeBoxRegion & BoxRegion.NEGATIVE_X) l += dx * this.app.view.izoom;
                }
                if (t > b) {
                    // Flip the resize box vertically
                    this.dragState.resizeBoxRegion ^= BoxRegion.ALL_Y;
                    this.dragState.captureArea.y = this.dragState.captureArea.yh;
                    this.dragState.captureArea.h = -this.dragState.captureArea.h;
                }
                if (l > r) {
                    // Flip the resize box horizontally
                    this.dragState.resizeBoxRegion ^= BoxRegion.ALL_X;
                    this.dragState.captureArea.x = this.dragState.captureArea.xw;
                    this.dragState.captureArea.w = -this.dragState.captureArea.w;
                }
                this.captureArea = new apper.Rect(Math.min(l, r), Math.min(t, b), Math.abs(r - l), Math.abs(b - t));
            }
            else {
                for (let i = 0; i < this.dragState.elements.length; i++) {
                    let element = this.dragState.elements[i];
                    let index = this.dragState.indices[i];

                    if (element instanceof Vertex) {
                        let vertex = this.vertices[index];
                        let p = revert ? new apper.Vector2(element) : this.snapToGrid(new apper.Vector2(element).add(dx * this.app.view.izoom, dy * this.app.view.izoom));
                        if (this.app.tool !== Tools.DRAW || this.firstVertex === null) {
                            vertex.x = p.x;
                            vertex.y = p.y;
                        }
                    } else if (element instanceof Edge) {
                        let edge = this.edges[index];
                        if (this.dragState.elements.length === 1) {
                            if (!edge.cp) {
                                edge.cp = new apper.Vector2();
                            }
                            edge.cp.set(revert ? element.cp ?? this.app.locate(this.dragState) : this.snapToGrid((element.cp ?? this.app.locate(this.dragState)).add(dx * this.app.view.izoom, dy * this.app.view.izoom)));

                            if (!edge.isLoop()) {
                                this.app.ctx.lineWidth = config.straightenCurveRadius * 2;
                                this.app.ctx.setLineDash([]);
                                this.app.ctx.beginPath();
                                this.app.ctx.moveTo(this.app.transformX(edge.v1.x), this.app.transformY(edge.v1.y));
                                this.app.ctx.lineTo(this.app.transformX(edge.v2.x), this.app.transformY(edge.v2.y));
                                if (this.app.ctx.isPointInStroke(this.app.transformX(edge.cp.x) * this.app.scale, this.app.transformY(edge.cp.y) * this.app.scale)) {
                                    edge.cp = null;
                                }
                            }
                        } else if (edge.isCurveOrLoop() && element.isCurveOrLoop()) {
                            edge.cp.set(revert ? element.cp : this.snapToGrid(element.cp.add(dx * this.app.view.izoom, dy * this.app.view.izoom)));
                        }
                    }
                }
            }

            return true;
        }

        handleMouseUp(event) {
            if (!this.isDragMode() || event.button !== this.dragState.button) {
                return false;
            }

            let element = this.dragState.button === 2 || this.app.tool === Tools.MOVE || this.app.tool === Tools.CAPTURE ? null : this.elementAt(this.app.cursorPos);

            if (this.app.tool === Tools.DRAW) {
                if (this.firstVertex !== null && this.firstVertex !== element) {
                    if (event.ctrlKey) {
                        let loop = new Edge({v1: this.firstVertex, v2: this.firstVertex, cp: this.snapToGrid(this.app.locate(this.app.cursorPos))});
                        this.edges.push(loop);
                        this.selection = [loop];
                    } else {
                        if (element instanceof Vertex) {
                            this.edges.push(new Edge({v1: this.firstVertex, v2: element}));
                            this.selection = [element];
                        } else {
                            let placed = new Vertex(this.snapToGrid(this.app.locate(this.app.cursorPos)));
                            this.vertices.push(placed);
                            this.edges.push(new Edge({v1: this.firstVertex, v2: placed}));
                            this.selection = [placed];
                        }
                    }
                }
                this.firstVertex = null;
            }
            else if (this.app.tool === Tools.CAPTURE) {
                this.captureArea = this.captureArea.normalized();
                if (this.captureArea.w < 1) {
                    this.captureArea.w = 1;
                    if (this.dragState.resizeBoxRegion & BoxRegion.NEGATIVE_X) {
                        this.captureArea.x -= 1;
                    }
                }
                if (this.captureArea.h < 1) {
                    this.captureArea.h = 1;
                    if (this.dragState.resizeBoxRegion & BoxRegion.NEGATIVE_Y) {
                        this.captureArea.y -= 1;
                    }
                }
            }
            else if (this.dragState.button !== 2 && this.app.tool !== Tools.MOVE && !this.dragState.elements.length) {
                if (!event.shiftKey) {
                    this.selection = [];
                }
                let selectBox = new apper.Rect(this.dragState.x, this.dragState.y, this.app.cursorPos.x - this.dragState.x, this.app.cursorPos.y - this.dragState.y).located(this.app.view).normalized();
                if (selectBox.area) {
                    this.selection.push(
                        ...this.vertices.filter(vertex => {
                            // Check if the selectBox intersects the bounding box of the vertex
                            // FIXME: doesn't account for vertex shape
                            return selectBox.intersects(new apper.Rect(vertex.x - vertex.r, vertex.y - vertex.r, 2 * vertex.r, 2 * vertex.r));
                        })
                        .concat(this.edges.filter(edge => {
                            // If one endpoint is contained, it is guaranteed that the selection box intersects the edge
                            if (selectBox.contains(edge.v1) || selectBox.contains(edge.v2)) {
                                return true;
                            }
                            if (edge.isCurve()) {
                                // Check if the selection box intersects the curve
                                let minX = Math.min(edge.v1.x, edge.cp.x, edge.v2.x);
                                let maxX = Math.max(edge.v1.x, edge.cp.x, edge.v2.x);
                                let minY = Math.min(edge.v1.y, edge.cp.y, edge.v2.y);
                                let maxY = Math.max(edge.v1.y, edge.cp.y, edge.v2.y);
                                // If the curve's bounding box doesn't intersect, we can skip further checks
                                if (!selectBox.intersects(new apper.Rect(minX, minY, maxX - minX, maxY - minY))) {
                                    return false;
                                }
                                let v1 = new apper.Vector2(edge.v1);
                                let v2 = new apper.Vector2(edge.v2);
                                for (let t = 0; t <= 1; t += config.curveSamplingInterval) {
                                    if (selectBox.contains(quadraticCurve(t, v1, edge.cp, v2))) {
                                        return true;
                                    }
                                }
                                return false;
                            }
                            else if (edge.isLoop()) {
                                // Check if the selection box intersects the loop
                                let center = edge.cp.add(edge.v1).mul(0.5);
                                let radius = 0.5 * Math.hypot(edge.cp.x - edge.v1.x, edge.cp.y - edge.v1.y);
                                // If the loop's bounding box doesn't intersect, we can skip further checks
                                if (!selectBox.intersects(new apper.Rect(center.x - radius, center.y - radius, 2 * radius, 2 * radius))) {
                                    return false;
                                }
                                let distX = Math.max(Math.abs(center.x - selectBox.cx) - 0.5 * selectBox.w, 0);
                                let distY = Math.max(Math.abs(center.y - selectBox.cy) - 0.5 * selectBox.h, 0);
                                return distX * distX + distY * distY <= radius * radius && (
                                    Math.hypot(selectBox.x - center.x, selectBox.y - center.y) >= radius
                                    || Math.hypot(selectBox.xw - center.x, selectBox.y - center.y) >= radius
                                    || Math.hypot(selectBox.xw - center.x, selectBox.yh - center.y) >= radius
                                    || Math.hypot(selectBox.x - center.x, selectBox.yh - center.y) >= radius
                                );
                            }
                            else {
                                // Check if the selection box intersects the line
                                return linesIntersect(edge.v1, edge.v2, selectBox.xy, selectBox.xwy)
                                    || linesIntersect(edge.v1, edge.v2, selectBox.xwy, selectBox.xwyh)
                                    || linesIntersect(edge.v1, edge.v2, selectBox.xwyh, selectBox.xyh)
                                    || linesIntersect(edge.v1, edge.v2, selectBox.xyh, selectBox.xy);
                            }
                        }))
                        // Ensure we don't end up with any duplicate elements
                        .filter(element => !this.selection.includes(element))
                    );
                }

                if (this.app.tool === Tools.ERASE) {
                    this.deleteSelection();
                }
            }

            this.dragState = null;
            return true;
        }

        openContextMenu(event) {
            // TODO: custom context menu
            return true;
        }

        handleScroll(event) {
            if (!event.dy) {
                return false;
            }
            this.app.view.changeZoom(-event.dy * config.scrollZoomMultiplier, this.app.cursorPos.equals(0, 0) ? null : this.app.cursorPos);
            return true;
        }

        handleKeyDown(event) {
            // TODO: better
            switch (event.key.toLowerCase()) {
                case "v":
                    this.app.tool = Tools.SELECT;
                    return true;
                case "m":
                    this.app.tool = Tools.MOVE;
                    return true;
                case "d":
                    this.app.tool = Tools.DRAW;
                    return true;
                case "x":
                    this.app.tool = Tools.ERASE;
                    return true;
                case "s":
                    this.app.tool = event.ctrlKey ? Tools.STYLE : Tools.SAVE;
                    return true;
                case "g":
                    this.app.tool = Tools.GRID;
                    return true;
                case "o":
                    if (event.ctrlKey) {
                        this.app.tool = Tools.LOAD;
                        return true;
                    }
                    return false;
                case "h":
                    this.app.tool = Tools.HELP;
                    return true;
                case "a":
                    if (event.ctrlKey) {
                        if (event.shiftKey) {
                            this.deselectAll();
                        } else {
                            this.selectAll();
                        }
                        return true;
                    }
                    return false;
                case "escape":
                    this.firstVertex = null;
                    this.deselectAll();
                    return true;
                case "backspace":
                case "delete":
                    return this.deleteSelection();
                case ".":
                    this.centerView();
                    return true;
                case "+":
                case "=":
                    this.app.view.changeZoom(config.keyZoomAmount);
                    return true;
                case "-":
                case "_":
                    this.app.view.changeZoom(-config.keyZoomAmount);
                    return true;
                case "0":
                    this.app.view.zoom = 1;
                    return true;
                default:
                    return false;
            }
        }

        snapToGrid(pos) {
            let { gridEnabled: visible, xStep: width, yStep: height } = this.gridSettings();
            if (visible) {
                return new apper.Vector2(Math.round(pos.x / width) * width, Math.round(pos.y / height) * height);
            } else {
                return new apper.Vector2(pos);
            }
        }

        elementAt(pos) {
            for (let i = this.vertices.length - 1; i >= 0; i--) {
                if (this.vertices[i].contains(this.app.ctx, pos, this.selection.includes(this.vertices[i]), this.app.view, true)) {
                    return this.vertices[i];
                }
            }

            for (let i = this.edges.length - 1; i >= 0; i--) {
                if (this.edges[i].contains(this.app.ctx, pos, this.selection.includes(this.edges[i]), this.app.view, true)) {
                    return this.edges[i];
                }
            }

            return null;
        }

        selectAll() {
            this.selection = this.vertices.concat(this.edges);
        }

        deselectAll() {
            this.selection = [];
        }

        deleteSelection() {
            if (!this.selection.length) {
                return false;
            }

            this.selection.forEach(selected => {
                if (selected instanceof Vertex) {
                    this.vertices.splice(this.vertices.indexOf(selected), 1);
                    this.edges = this.edges.filter(edge => edge.v1 !== selected && edge.v2 !== selected);
                } else if (this.edges.includes(selected)) this.edges.splice(this.edges.indexOf(selected), 1);
            });
            this.selection = [];

            return true;
        }

        centerView() {
            if (this.vertices.length) {
                let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
                this.vertices.forEach(vertex => {
                    if (vertex.x < l) l = vertex.x;
                    if (vertex.x > r) r = vertex.x;
                    if (vertex.y < t) t = vertex.y;
                    if (vertex.y > b) b = vertex.y;
                });
                this.app.view.center.set(0.5 * (l + r), 0.5 * (t + b));
            } else {
                this.app.view.center.set(0, 0);
            }

            this.app.update();
        }

        fitCaptureTo(elements) {
            if (elements.length === 0) {
                this.captureArea = null;
            }
            elements = elements.flatMap(element => {
                let toCapture = [element];
                if (element instanceof Edge) {
                    if (!elements.includes(element.v1)) {
                        toCapture.push(element.v1);
                    }
                    if (!elements.includes(element.v2)) {
                        toCapture.push(element.v2);
                    }
                }
                return toCapture;
            });

            let minX = Infinity;
            let maxX = -Infinity;
            let minY = Infinity;
            let maxY = -Infinity;
            elements.forEach(element => {
                let margin = element.margin();
                if (element instanceof Vertex) {
                    minX = Math.min(minX, element.x - margin);
                    maxX = Math.max(maxX, element.x + margin);
                    minY = Math.min(minY, element.y - margin);
                    maxY = Math.max(maxY, element.y + margin);
                }
                else if (element instanceof Edge) {
                    if (element.isCurve()) {
                        if (element.cp.x < element.v1.x && element.cp.x < element.v2.x || element.cp.x > element.v1.x && element.cp.x > element.v2.x) {
                            let vx = quadraticCurveVertexX(element.v1, element.cp, element.v2);
                            if (vx - margin < minX) minX = vx - margin;
                            if (vx + margin > maxX) maxX = vx + margin;
                        }
                        if (element.cp.y < element.v1.y && element.cp.y < element.v2.y || element.cp.y > element.v1.y && element.cp.y > element.v2.y) {
                            let vy = quadraticCurveVertexY(element.v1, element.cp, element.v2);
                            if (vy - margin < minY) minY = vy - margin;
                            if (vy + margin > maxY) maxY = vy + margin;
                        }
                    } else if (element.isLoop()) {
                        let center = element.cp.add(element.v1).mul(0.5);
                        let radius = 0.5 * Math.hypot(element.cp.x - element.v1.x, element.cp.y - element.v1.y);
                        if (center.x - radius - margin < minX) minX = center.x - radius - margin;
                        if (center.x + radius + margin > maxX) maxX = center.x + radius + margin;
                        if (center.y - radius - margin < minY) minY = center.y - radius - margin;
                        if (center.y + radius + margin > maxY) maxY = center.y + radius + margin;
                    } else {
                        if (element.v1.x - margin < minX) minX = element.v1.x - margin;
                        if (element.v1.x + margin > maxX) maxX = element.v1.x + margin;
                        if (element.v1.y - margin < minY) minY = element.v1.y - margin;
                        if (element.v1.y + margin > maxY) maxY = element.v1.y + margin;
                        if (element.v2.x - margin < minX) minX = element.v2.x - margin;
                        if (element.v2.x + margin > maxX) maxX = element.v2.x + margin;
                        if (element.v2.y - margin < minY) minY = element.v2.y - margin;
                        if (element.v2.y + margin > maxY) maxY = element.v2.y + margin;
                    }
                }
            });
            minX = Math.round(minX);
            minY = Math.round(minY);
            maxX = Math.round(maxX);
            maxY = Math.round(maxY);
            this.captureArea = new apper.Rect(minX, minY, maxX - minX, maxY - minY);
        }

        getResizeBoxRegion() {
            if (this.captureArea === null) return null;

            let area = this.captureArea.transformed(this.app.view);
            let broadArea = new apper.Rect(
                area.x - config.resizeProximityPixels,
                area.y - config.resizeProximityPixels,
                area.w + 2 * config.resizeProximityPixels,
                area.h + 2 * config.resizeProximityPixels,
            );

            const BoxRegion = apper.util.BoxRegion;

            if (broadArea.contains(this.app.cursorPos)) {
                let de = Math.abs(area.xw - this.app.cursorPos.x);
                let dw = Math.abs(area.x - this.app.cursorPos.x);
                let ds = Math.abs(area.yh - this.app.cursorPos.y);
                let dn = Math.abs(area.y - this.app.cursorPos.y);
                let region = BoxRegion.NONE;
                if (de <= config.resizeProximityPixels && de < dw) {
                    region |= BoxRegion.POSITIVE_X;
                }
                if (dw <= config.resizeProximityPixels && dw < de) {
                    region |= BoxRegion.NEGATIVE_X;
                }
                if (ds <= config.resizeProximityPixels && ds < dn) {
                    region |= BoxRegion.POSITIVE_Y;
                }
                if (dn <= config.resizeProximityPixels && dn < ds) {
                    region |= BoxRegion.NEGATIVE_Y;
                }
                return region === BoxRegion.NONE ? BoxRegion.INTERNAL_ALL : region;
            }
            else {
                return BoxRegion.EXTERNAL;
            }
        }

        loadFromURL(url) {
            this.app.title = "Loading...";

            let fullURL = url.startsWith("examples") ? getAsset(url) : url;

            fetch(fullURL)
                .then(response => response.json(), error => {
                    if (error instanceof TypeError) {
                        error.message = "The graph URL could not be accessed.";
                    }
                    throw error;
                })
                .then(data => {
                    let searchParams = new URLSearchParams(window.location.search)
                    searchParams.set("src", url);
                    window.history.pushState(null, "", window.location.pathname + "?" + searchParams.toString());
                    this.loadFromData(data, true);
                    this.app.showMessage("Successfully loaded the graph.", 3);
                })
                .catch(error => {
                    if (error instanceof SyntaxError) {
                        error.message = "The graph at this URL could not be read.";
                    }
                    let message = error.message || "An error occurred while loading the graph.";
                    this.app.showError(message);
                    this.app.title = this.app.defaultTitle();
                    console.error(error);
                });
        }

        loadFromFile(file) {
            this.app.title = "Loading...";

            let reader = new FileReader();
            reader.addEventListener("loadend", () => {
                if (reader.error) {
                    this.app.showError("The selected file could not be opened.");
                    this.app.title = this.app.defaultTitle();
                    console.error(reader.error);
                } else {
                    try {
                        let data = JSON.parse(reader.result);
                        this.loadFromData(data, true);
                        this.app.showMessage("Successfully loaded the graph.", 3);
                    } catch (error) {
                        this.app.showError("An error occurred while loading the graph.");
                        this.app.title = this.app.defaultTitle();
                        console.error(error);
                    }
                }
            }, { once: true });
            reader.readAsText(file);
        }

        loadFromData(data, reset = false) {
            this.vertices = data.vertices.map(vertex => new Vertex(vertex));
            this.edges = data.edges.map(edge => new Edge({
                ...edge,
                v1: this.vertices[edge.v1],
                v2: this.vertices[edge.v2],
            }));
            this.app.title = data.title || this.app.defaultTitle();

            if (reset) {
                this.centerView();
            } else {
                this.app.update();
            }
        }

        getGraphData() {
            let vertices = this.vertices.map(vertex => ({
                x: vertex.x, y: vertex.y,
                r: vertex.r === 10 ? undefined : vertex.r,
                fill: vertex.fill === Color.DARK ? undefined : vertex.fill,
                stroke: vertex.stroke === Color.LIGHT ? undefined : vertex.stroke,
                lineWidth: vertex.lineWidth === 4 ? undefined : vertex.lineWidth,
                lineDash: !vertex.lineDash.length ? undefined : vertex.lineDash.slice(),
                shape: vertex.shape === 0 ? undefined : vertex.shape
            }));

            let edges = this.edges.map(edge => ({
                v1: this.vertices.indexOf(edge.v1), v2: this.vertices.indexOf(edge.v2),
                cp: edge.cp === null ? undefined : [edge.cp.x, edge.cp.y],
                stroke: edge.stroke === Color.DARK ? undefined : edge.stroke,
                lineWidth: edge.lineWidth === 4 ? undefined : edge.lineWidth,
                lineDash: !edge.lineDash.length ? undefined : edge.lineDash.slice(),
            }));

            return JSON.stringify({title: this.app.title, vertices, edges});
        }
    }


    return {
        config,
        Vertedge,
        Vertex,
        Edge,
        Tools,
        Shape,
        Color,
        getAsset,
        quadraticCurve,
        quadraticCurveVelocity,
        quadraticCurveVertexX,
        quadraticCurveVertexY,
        orientationOf,
        linesIntersect,
        getFillColorIcon,
        getStrokeColorIcon,
    };

})();
