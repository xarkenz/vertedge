import "./assets/styles/style.css";

import exampleGraphs from "./assets/data/examples.json";

import icon_capture from "./assets/icons/capture.svg";
import icon_color from "./assets/icons/color.svg";
import icon_data from "./assets/icons/data.svg";
import icon_download from "./assets/icons/download.svg";
import icon_draw from "./assets/icons/draw.svg";
import icon_erase from "./assets/icons/erase.svg";
import icon_grid from "./assets/icons/grid.svg";
import icon_height from "./assets/icons/height.svg";
import icon_help from "./assets/icons/help.svg";
import icon_lineWidth from "./assets/icons/line-width.svg";
import icon_load from "./assets/icons/load.svg";
import icon_move from "./assets/icons/move.svg";
import icon_radius from "./assets/icons/radius.svg";
import icon_save from "./assets/icons/save.svg";
import icon_select from "./assets/icons/select.svg";
import icon_shape from "./assets/icons/shape.svg";
import icon_shapeCircle from "./assets/icons/shape-circle.svg";
import icon_shapeSquare from "./assets/icons/shape-square.svg";
import icon_shapeDiamond from "./assets/icons/shape-diamond.svg";
import icon_shapeStar from "./assets/icons/shape-star.svg";
import icon_stroke from "./assets/icons/stroke.svg";
import icon_style from "./assets/icons/style.svg";
import icon_upload from "./assets/icons/upload.svg";
import icon_width from "./assets/icons/width.svg";

import * as zod from "zod";
import { GraphicalEditor, Modal, Panel, Shortcut, Tool, type ApperContextMenuEvent, type ApperKeyEvent, type ApperMouseDownEvent, type ApperMouseMoveEvent, type ApperMouseUpEvent, type ApperWheelEvent } from "@/apper";
import { Edge, getVertexShapeByID, Vertex, VertexShape, type EdgeDescriptor } from "./graph";
import { Color, getFillColorIcon, getStrokeColorIcon, linesIntersect, nearestOnLineSegment, nearestOnQuadraticCurve, quadraticCurve, quadraticCurveVertexX, quadraticCurveVertexY } from "./util";
import { Button, ButtonList, CanvasImage, Checkbox, FileInput, HSpread, NumberInput, Paragraph, TextEditor } from "@/apper/widget";
import { BoxRegion, getResizeCursor } from "@/apper/util";
import { Rect, Vector2, Viewport, type Vector2Like } from "@/apper/math";

export const config = {
    curveSamplingInterval: 0.01,
    revertProximityPixels: 8,
    resizeProximityPixels: 12,
    straightenCurveRadius: 20,
    scrollZoomMultiplier: 0.0005,
    keyZoomAmount: 0.1,
    defaultLineDash: [2, 2],
};

const colorOptions: string[] = [
    Color.NONE, Color.LIGHT, Color.MEDIUM, Color.DARK, Color.RED, Color.ORANGE,
    Color.YELLOW, Color.GREEN, Color.CYAN, Color.BLUE, Color.PURPLE, Color.PINK,
];
const shapeOptions: string[] = [
    icon_shapeCircle,
    icon_shapeSquare,
    icon_shapeDiamond,
    icon_shapeStar,
];

// TODO: eliminate the need to really even store these. the tools should be actions that handle their own state.
const Tools = {
    SELECT: new Tool("select", "Select", icon_select, new Shortcut("v")),
    MOVE: new Tool("move", "Move", icon_move, new Shortcut("m")),
    DRAW: new Tool("draw", "Draw", icon_draw, new Shortcut("d")),
    ERASE: new Tool("erase", "Erase", icon_erase, new Shortcut("x")),
    STYLE: new Tool("style", "Style", icon_style, new Shortcut("s")),
    GRID: new Tool("grid", "Grid", icon_grid, new Shortcut("g")),
    CAPTURE: new Tool("capture", "Capture", icon_capture),
    DATA: new Tool("data", "View Data", icon_data),
    LOAD: new Tool("load", "Load", icon_load),
    SAVE: new Tool("save", "Save", icon_save, new Shortcut("s", { ctrl: true })),
    HELP: new Tool("help", "Help", icon_help, new Shortcut("h")),
};

// TODO: better validation
const colorSchema = zod.string();
const lineDashSchema = zod.array(zod.number());
const jsonVector2Schema = zod.tuple([zod.number(), zod.number()]);

const graphSchema = zod.object({
    title: zod.string().nonempty().optional(),
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

export class Vertedge {
    app: GraphicalEditor;
    vertices: Vertex[] = [];
    edges: Edge[] = [];
    selection: (Vertex | Edge)[] = [];
    firstVertex: Vertex | null = null;
    color: string = "";
    captureArea: Rect | null = null;
    dragState: {
        button: number,
        x: number,
        y: number,
        view: Viewport,
        elements: {
            element: Vertex | Edge,
            index: number,
        }[],
        captureArea: Rect | null,
        resizeBoxRegion: BoxRegion | null,
    } | null = null;

    stylePanel: Panel;
    style_fillColor: HSpread;
    style_lineColor: HSpread;
    style_vertexShape: HSpread;
    style_vertexRadius: NumberInput;
    style_lineWidth: NumberInput;
    style_lineDash: Checkbox;
    style_edgeDirected: Checkbox;
    style_reverseEdge: Button;
    style_arrowAngle: NumberInput;
    style_arrowLength: NumberInput;

    gridPanel: Panel;
    grid_enableAxes: Checkbox;
    grid_enableGrid: Checkbox;
    grid_gridStepX: NumberInput;
    grid_gridStepY: NumberInput;

    capturePanel: Panel;
    capture_prompt: Paragraph;
    capture_instructions: Paragraph;
    capture_selectionOnly: Checkbox;
    capture_fitGraph: Button;
    capture_emptyPreview: Paragraph;
    capture_preview: CanvasImage;
    capture_download: Button;

    saveModal: Modal;
    save_download: Button;

    loadModal: Modal;

    dataPanel: Panel;
    data_editor: TextEditor;

    helpModal: Modal;

    constructor(element: HTMLElement) {
        this.app = new GraphicalEditor(element)
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

        this.stylePanel = this.app.addPanel("Element Style")
            .addSeparator()
            .add(this.style_fillColor = new HSpread("vertedge-fill-color", "Fill color:", colorOptions.map(color => getFillColorIcon(color)), icon_color)
                .onChange(value => {
                    let color = colorOptions[value];
                    if (!color) return;
                    this.selection.forEach(element => {
                        if (element instanceof Vertex) {
                            element.fill = color;
                        }
                    });
                    this.app.update();
                }))
            .add(this.style_lineColor = new HSpread("vertedge-line-color", "Line color:", colorOptions.map(color => getStrokeColorIcon(color)), icon_stroke)
                .onChange(value => {
                    let color = colorOptions[value];
                    if (!color) return;
                    this.selection.forEach(element => {
                        element.stroke = color;
                    });
                    this.app.update();
                }))
            .addSeparator()
            .add(this.style_vertexShape = new HSpread("vertedge-vertex-shape", "Shape:", shapeOptions, icon_shape)
                .onChange(value => {
                    let shape = getVertexShapeByID(value);
                    if (!shape) return;
                    this.selection.forEach(element => {
                        if (element instanceof Vertex) {
                            element.shape = shape;
                        }
                    });
                    this.app.update();
                }))
            .add(this.style_vertexRadius = new NumberInput("vertedge-vertex-radius", "Radius:", icon_radius).setMin(0)
                .onChange(value => {
                    this.selection.forEach(element => {
                        if (element instanceof Vertex) {
                            element.r = value;
                        }
                    });
                    this.app.update();
                }))
            .add(this.style_lineWidth = new NumberInput("vertedge-line-width", "Line width:", icon_lineWidth).setMin(0)
                .onChange(value => {
                    this.selection.forEach(element => {
                        element.lineWidth = value;
                    });
                    this.app.update();
                }))
            .add(this.style_lineDash = new Checkbox("vertedge-line-dash", "Dashed line")
                .onChange(value => {
                    this.selection.forEach(element => {
                        element.lineDash = value ? config.defaultLineDash : [];
                    });
                    this.app.update();
                }))
            .addSeparator()
            .add(this.style_edgeDirected = new Checkbox("vertedge-edge-directed", "Directed edge")
                .onChange(value => {
                    this.selection.forEach(element => {
                        if (element instanceof Edge) {
                            element.directed = value;
                        }
                    });
                    this.app.update();
                }))
            .add(this.style_reverseEdge = new Button("Reverse Edge Direction")
                .onClick(() => {
                    this.selection.forEach(element => {
                        if (element instanceof Edge) {
                            element.reverse();
                        }
                    });
                    this.app.update();
                }))
            .add(this.style_arrowAngle = new NumberInput("vertedge-arrow-angle", "Arrow angle (degrees):").setMin(0).setMax(90)
                .onChange(value => {
                    this.selection.forEach(element => {
                        if (element instanceof Edge) {
                            element.arrowAngle = value;
                        }
                    });
                    this.app.update();
                }))
            .add(this.style_arrowLength = new NumberInput("vertedge-arrow-length", "Arrow length:").setMin(0)
                .onChange(value => {
                    this.selection.forEach(element => {
                        if (element instanceof Edge) {
                            element.arrowLength = value;
                        }
                    });
                    this.app.update();
                }));

        this.gridPanel = this.app.addPanel("Grid Settings")
            .addSeparator()
            .add(this.grid_enableAxes = new Checkbox("vertedge-show-axes", "Show axes")
                .onChange(() => this.app.update()))
            .add(this.grid_enableGrid = new Checkbox("vertedge-enable-grid", "Enable grid")
                .onChange(() => this.app.update()))
            .add(this.grid_gridStepX = new NumberInput("vertedge-grid-step-x", "Horizontal spacing:", icon_width, 50).setMin(1)
                .onChange(() => this.app.update()))
            .add(this.grid_gridStepY = new NumberInput("vertedge-grid-step-y", "Vertical spacing:", icon_height, 50).setMin(1)
                .onChange(() => this.app.update()));

        this.capturePanel = this.app.addPanel("Capture Image")
            .addSeparator()
            .add(this.capture_prompt = new Paragraph("To capture a graph image, try adding some elements to the graph."))
            .add(this.capture_instructions = new Paragraph("Resize the box to crop the resulting image. To move the view, drag from outside the box.").hide())
            .add(this.capture_selectionOnly = new Checkbox("vertedge-capture-selection-only", "Capture selection only").hide()
                .onChange(() => this.app.update()))
            .add(this.capture_fitGraph = new Button("Fit Entire Graph").hide()
                .onClick(() => {
                    this.fitCaptureTo(this.allElements());
                    this.app.update();
                }))
            .addSeparator()
            .add(this.capture_emptyPreview = new Paragraph("An image preview will appear here."))
            .add(this.capture_preview = new CanvasImage("Preview:").hide())
            .add(this.capture_download = new Button(`<img src="${icon_download}"> Download as PNG`).hide());
        
        this.saveModal = this.app.addModal("Save Graph")
            .addSeparator()
            .add(new Paragraph("Save the state of your graph to a file on your device:"))
            .add(this.save_download = new Button(`<img src="${icon_download}"> Download JSON`))

        this.loadModal = this.app.addModal("Load a Graph")
            .addSeparator()
            .add(new Paragraph("Import an existing graph from your device by clicking the button below:"))
            .add(new FileInput(`<img src="${icon_upload}"> Upload JSON`)
                .onChange(files => {
                    this.app.update();
                    if (files && files[0]) {
                        this.loadFromFile(files[0]);
                    }
                    this.app.tool = this.app.toolbar && this.app.toolbar.defaultTool;
                }))
            .add(new ButtonList("Example Graphs:", exampleGraphs.map(({ url, title }) => ({ label: title, value: url })))
                .onClick(url => {
                    this.app.update();
                    this.loadFromURL(url);
                    this.app.tool = this.app.toolbar && this.app.toolbar.defaultTool;
                }));

        this.dataPanel = this.app.addPanel("Raw Graph Data")
            .addSeparator()
            .add(this.data_editor = new TextEditor("vertedge-data-editor", "Raw JSON data...")
                .onChange(text => {
                    if (!text) {
                        this.loadFromData({});
                    } else {
                        try {
                            this.loadFromData(JSON.parse(text));
                            this.data_editor.valid = true;
                        } catch (err) {
                            if (!(err instanceof SyntaxError)) {
                                console.error(err);
                            }
                            this.data_editor.valid = false;
                        }
                    }
                    this.app.update();
                }));

        this.helpModal = this.app.addModal("Vertedge Help")
            .addSeparator()
            .add(new Paragraph("Hi! I built this in my spare time a while back, so I hope you'll understand that this is still a bit rough around the <i>edges</i> (pun intended)."))
            .add(new Paragraph("If you still need help beyond this page, you can email me at <a href='mailto:seanedwardsclarke@gmail.com' target='_blank' rel='noopener noreferrer'>seanedwardsclarke@gmail.com</a>."))
            .add(new Paragraph("Found a bug or issue? You can report it on <a href='https://github.com/xarkenz/vertedge/issues' target='_blank' rel='noopener noreferrer'>the GitHub page</a> or in an email to the address above. Thanks for your help!"))
            .addSeparator()
            .add(new Paragraph(`<img class="vertedge-help-tool-icon" src="${icon_select}"><b>Select</b> - <kbd>V</kbd><br>This is the default tool. Click on vertices and edges to select them, and drag them to move them around. If you drag an edge, it will become a curve which you can adjust to your needs. To select multiple elements at once, drag from empty space to select a region or hold <kbd>Shift</kbd> when clicking on elements.`))
            .add(new Paragraph(`<img class="vertedge-help-tool-icon" src="${icon_move}"><b>Move</b> - <kbd>M</kbd><br>This tool allows you to move the entire view by dragging. This can be especially helpful if you find yourself running out of room on the screen.`))
            .add(new Paragraph(`<img class="vertedge-help-tool-icon" src="${icon_draw}"><b>Draw</b> - <kbd>D</kbd><br>This tool allows you to create new edges and vertices by clicking and dragging. You can split edges by clicking on them. While drawing an edge, holding <kbd>Ctrl</kbd>/<kbd>⌘Cmd</kbd> creates a loop which connects a vertex to itself.`))
            .add(new Paragraph(`<img class="vertedge-help-tool-icon" src="${icon_erase}"><b>Erase</b> - <kbd>X</kbd><br>Use this tool to remove vertices and edges from the graph. You can also use <kbd>Delete</kbd> or <kbd>Backspace</kbd> to remove the current selection in any mode. If a vertex is removed, all connecting edges are removed.`))
            .add(new Paragraph(`<img class="vertedge-help-tool-icon" src="${icon_style}"><b>Style</b> - <kbd>S</kbd><br>This tool allows you to modify the appearance of selected elements through a menu.`))
            .add(new Paragraph(`<img class="vertedge-help-tool-icon" src="${icon_grid}"><b>Grid</b> - <kbd>G</kbd><br>This menu allows you to enable/disable and modify settings for a grid if you want to make your graph more orderly.`))
            .add(new Paragraph(`<img class="vertedge-help-tool-icon" src="${icon_capture}"><b>Capture</b><br>This tool allows you to download a PNG image of a region of your graph with a transparent background for convenience. If any graph elements are currently selected and the "Capture selection only" option is used, unselected elements will not be included in the capture. The resolution of a capture is currently fixed at 1 unit = 1 pixel, but this may change in the future.`))
            .add(new Paragraph(`<img class="vertedge-help-tool-icon" src="${icon_load}"><b>Load</b> - <kbd>Ctrl</kbd>/<kbd>⌘Cmd</kbd> <kbd>O</kbd><br>This menu allows you to load a graph either from a file on your device or from the list of examples.`))
            .add(new Paragraph(`<img class="vertedge-help-tool-icon" src="${icon_save}"><b>Save</b> - <kbd>Ctrl</kbd>/<kbd>⌘Cmd</kbd> <kbd>S</kbd><br>This menu allows you to save the current graph to a file on your device. Unfortunately, cloud saving is not supported. Maybe someday.`))
            .add(new Paragraph(`<img class="vertedge-help-tool-icon" src="${icon_data}"><b>View Data</b><br>This menu contains the raw JSON data for the graph. You can mess around with it if you like, and the graph will update dynamically. Usually, you won't need to use this.`))
            .add(new Paragraph(`<img class="vertedge-help-tool-icon" src="${icon_help}"><b>Help</b> - <kbd>H</kbd><br>You are here. Congratulations!`))
            .addSeparator()
            .add(new Paragraph(`<b>Zoom In</b> - <kbd>+</kbd><br>Zoom in to the graph by a fixed amount.`))
            .add(new Paragraph(`<b>Zoom Out</b> - <kbd>-</kbd><br>Zoom out of the graph by a fixed amount.`))
            .add(new Paragraph(`<b>Zoom Default</b> - <kbd>0</kbd><br>Zoom to the default zoom level.`))
            .add(new Paragraph(`<b>Center View</b> - <kbd>.</kbd><br>Move the view to the center of the graph.`))
            .add(new Paragraph(`<b>Select All</b> - <kbd>Ctrl</kbd>/<kbd>⌘Cmd</kbd> <kbd>A</kbd><br>Select all elements in the graph.`))
            .add(new Paragraph(`<b>Deselect All</b> - <kbd>Ctrl</kbd>/<kbd>⌘Cmd</kbd> <kbd>Shift</kbd> <kbd>A</kbd> or <kbd>Esc</kbd><br>Deselect all currently selected graph elements.`))
            .add(new Paragraph(`<b>Erase Selected</b> - <kbd>Delete</kbd> or <kbd>Backspace</kbd><br>Remove all currently selected elements from the graph. If a vertex is removed, all connecting edges are removed.`));

        this.app.update();

        let graphSourceURL = new URLSearchParams(window.location.search).get("src");
        if (graphSourceURL) {
            this.loadFromURL(graphSourceURL);
        }
    }

    allElements(): (Vertex | Edge)[] {
        let vertices: (Vertex | Edge)[] = this.vertices;
        return vertices.concat(this.edges);
    }

    isDragMode() {
        return !!this.dragState;
    }

    gridSettings() {
        return {
            axesVisible: this.grid_enableAxes.checked,
            gridEnabled: this.grid_enableGrid.checked,
            xStep: this.grid_gridStepX.value,
            yStep: this.grid_gridStepY.value,
        };
    }

    render() {
        let element = this.app.tool === Tools.MOVE || this.app.tool === Tools.CAPTURE ? null : this.elementAtCursor();
        this.color = this.app.tool === Tools.DRAW ? Color.GREEN_DARK
            : this.app.tool === Tools.ERASE ? Color.RED
            : Color.PURPLE;
        let resizeBoxRegion = this.app.tool === Tools.CAPTURE ? this.getResizeBoxRegion() : null;

        if (this.app.tool !== Tools.DRAW) {
            this.firstVertex = null;
        }

        if (this.app.tool === Tools.STYLE && this.selection.length) {
            if (this.selection.some(element => element instanceof Vertex)) {
                this.style_fillColor.show();
                this.style_vertexShape.show();
                this.style_vertexRadius.show();

                let fillColor = undefined;
                for (let element of this.selection) {
                    if (element instanceof Vertex) {
                        if (fillColor === undefined) {
                            fillColor = element.fill;
                        } else if (element.fill !== fillColor) {
                            fillColor = undefined;
                            break;
                        }
                    }
                }
                if (fillColor === undefined) {
                    this.style_fillColor.value = undefined;
                } else {
                    let index = colorOptions.indexOf(fillColor);
                    this.style_fillColor.value = index < 0 ? undefined : index;
                }

                let shape = undefined;
                for (let element of this.selection) {
                    if (element instanceof Vertex) {
                        if (shape === undefined) {
                            shape = element.shape;
                        } else if (element.shape !== shape) {
                            shape = undefined;
                            break;
                        }
                    }
                }
                this.style_vertexShape.value = shape?.id;

                let radius = undefined;
                for (let element of this.selection) {
                    if (element instanceof Vertex) {
                        if (radius === undefined) {
                            radius = element.r;
                        } else if (element.r !== radius) {
                            radius = undefined;
                            break;
                        }
                    }
                }
                this.style_vertexRadius.value = radius ?? new Vertex().r;
            } else {
                this.style_fillColor.hide();
                this.style_vertexShape.hide();
                this.style_vertexRadius.hide();
            }

            if (this.selection.some(element => element instanceof Edge)) {
                this.style_edgeDirected.show();
                this.style_reverseEdge.show();
                this.style_arrowAngle.show();
                this.style_arrowLength.show();

                this.style_edgeDirected.checked = this.selection.some(element => element instanceof Edge && element.directed)

                let arrowAngle = undefined;
                for (let element of this.selection) {
                    if (element instanceof Edge) {
                        if (arrowAngle === undefined) {
                            arrowAngle = element.arrowAngle;
                        } else if (element.arrowAngle !== arrowAngle) {
                            arrowAngle = undefined;
                            break;
                        }
                    }
                }
                this.style_arrowAngle.value = arrowAngle ?? new Edge().arrowAngle;

                let arrowLength = undefined;
                for (let element of this.selection) {
                    if (element instanceof Edge) {
                        if (arrowLength === undefined) {
                            arrowLength = element.arrowLength;
                        } else if (element.arrowLength !== arrowLength) {
                            arrowLength = undefined;
                            break;
                        }
                    }
                }
                this.style_arrowLength.value = arrowLength ?? new Edge().arrowLength;
            } else {
                this.style_edgeDirected.hide();
                this.style_reverseEdge.hide();
                this.style_arrowAngle.hide();
                this.style_arrowLength.hide();
            }

            let lineColor = undefined;
            for (let element of this.selection) {
                if (lineColor === undefined) {
                    lineColor = element.stroke;
                } else if (element.stroke !== lineColor) {
                    lineColor = undefined;
                    break;
                }
            }
            if (lineColor === undefined) {
                this.style_lineColor.value = undefined;
            } else {
                let index = colorOptions.indexOf(lineColor);
                this.style_lineColor.value = index < 0 ? undefined : index;
            }

            let lineWidth = undefined;
            for (let element of this.selection) {
                if (lineWidth === undefined) {
                    lineWidth = element.lineWidth;
                } else if (element.lineWidth !== lineWidth) {
                    lineWidth = undefined;
                    break;
                }
            }
            this.style_lineWidth.value = lineWidth ?? 4;

            this.style_lineDash.checked = this.selection.some(element => element.lineDash.length > 1);

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
                this.fitCaptureTo(this.selection.length > 0 ? this.selection : this.allElements());
            }
            if (!this.captureArea) {
                this.capture_prompt.show();
                this.capture_emptyPreview.show();
                this.capture_instructions.hide();
                this.capture_selectionOnly.hide();
                this.capture_fitGraph.hide();
                this.capture_preview.hide();
                this.capture_download.hide();

                this.capture_download.url = "";
                this.capture_download.filename = "";
            } else {
                this.capture_prompt.hide();
                this.capture_emptyPreview.hide();
                this.capture_instructions.show();
                this.capture_selectionOnly.show();
                this.capture_fitGraph.show();
                this.capture_preview.show();
                this.capture_download.show();

                if (this.selection.length > 0) {
                    this.capture_selectionOnly.enable();
                } else {
                    this.capture_selectionOnly.disable().setChecked(false);
                }

                this.capture_preview.label = `Preview (${this.captureArea.w} \u00d7 ${this.captureArea.h}):`
                this.capture_preview.resize(this.captureArea.w, this.captureArea.h);
                this.capture_preview.ctx.resetTransform();
                this.capture_preview.ctx.clearRect(0, 0, this.capture_preview.canvas.width, this.capture_preview.canvas.height);
                this.capture_preview.ctx.translate(-this.captureArea.x, -this.captureArea.y);
                this.capture_preview.ctx.lineCap = "round";
                this.capture_preview.ctx.lineJoin = "round";

                // TODO: users should be able to modify resolution through capture menu
                this.edges.forEach(edge => {
                    if (!this.capture_selectionOnly.checked || this.selection.includes(edge)) {
                        edge.draw(this.capture_preview.ctx, false, false, this.color);
                    }
                });
                this.vertices.forEach(vertex => {
                    if (!this.capture_selectionOnly.checked || this.selection.includes(vertex)) {
                        vertex.draw(this.capture_preview.ctx, false, false, this.color);
                    }
                });

                this.capture_download.url = this.capture_preview.canvas.toDataURL("image/png");
                this.capture_download.filename = `${this.app.title}.png`;
            }

            this.capturePanel.show();
        } else {
            this.capturePanel.hide();
            
            this.captureArea = null;
            this.capture_download.url = "";
            this.capture_download.filename = "";
        }

        if (this.app.tool === Tools.LOAD) {
            this.loadModal.show();
        } else {
            this.loadModal.hide();
        }

        if (this.app.tool === Tools.SAVE) {
            this.save_download.url = `data:application/json;base64,${btoa(this.getGraphData())}`;
            this.save_download.filename = `${this.app.title}.json`;

            this.saveModal.show();
        } else {
            this.saveModal.hide();

            this.save_download.url = "";
            this.save_download.filename = "";
        }

        if (this.app.tool === Tools.DATA) {
            if (!this.data_editor.editing) {
                this.data_editor.text = this.getGraphData();
                this.data_editor.valid = true;
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
        if (this.app.tool === Tools.MOVE || (this.dragState && this.dragState.button === 2)) {
            this.app.element.style.cursor = this.dragState ? "grabbing" : "";
            this.app.canvas.style.cursor = this.dragState ? "" : "grab";
        } else if (this.app.tool === Tools.CAPTURE) {
            let resizeCursor = getResizeCursor(this.dragState?.resizeBoxRegion ?? resizeBoxRegion!);
            this.app.element.style.cursor = this.dragState ? (resizeCursor ?? "grabbing") : "";
            this.app.canvas.style.cursor = this.dragState ? "" : (resizeCursor ?? "grab");
        } else {
            this.app.element.style.cursor = "";
            this.app.canvas.style.cursor = "";
        }

        this.app.ctx.lineCap = "round";
        this.app.ctx.lineJoin = "round";

        // Draw grid and/or axes
        let { axesVisible, gridEnabled, xStep, yStep } = this.gridSettings();
        if (gridEnabled || axesVisible) {
            let topLeft = this.app.locate(new Vector2(0, 0))
            let bottomRight = this.app.locate(new Vector2(this.app.width, this.app.height));
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
        if (this.dragState && this.dragState.elements.length > 0) {
            for (let { element } of this.dragState.elements) {
                element.draw(this.app.ctx, false, false, this.color, this.app.view);
                if (element instanceof Edge && element.cp) {
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
            edge.draw(this.app.ctx, !this.dragState && element === edge, this.selection.includes(edge), this.color, this.app.view);
        });
        this.vertices.forEach(vertex => {
            vertex.draw(this.app.ctx, !this.dragState && element === vertex, this.selection.includes(vertex), this.color, this.app.view);
        });

        // Draw tool indicators
        if (this.dragState && (this.dragState.button === 2 || this.app.tool === Tools.MOVE || this.app.tool === Tools.CAPTURE)) {
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
        else if (this.app.tool === Tools.DRAW && !this.app.cursorPos.isNaN()) {
            let drawingLoop = this.firstVertex != null && this.app.ctrlKey;
            let pos = gridEnabled ? this.app.transform(this.snapToGrid(this.app.cursorWorldPos)) : this.app.cursorPos;
            // Draw vertex preview
            this.app.ctx.fillStyle = `${this.color}aa`;
            this.app.ctx.strokeStyle = `${this.color}aa`;
            this.app.ctx.lineWidth = 2;
            this.app.ctx.setLineDash([]);
            if (drawingLoop) {
                // Draw diamond at the loop's control point
                this.app.ctx.beginPath();
                this.app.ctx.moveTo(pos.x, pos.y + 8);
                this.app.ctx.lineTo(pos.x + 8, pos.y);
                this.app.ctx.lineTo(pos.x, pos.y - 8);
                this.app.ctx.lineTo(pos.x - 8, pos.y);
                this.app.ctx.closePath();
                this.app.ctx.fill();
            } else if (element instanceof Vertex) {
                // Draw dot in the center to indicate that the vertex will be reused
                pos = this.app.transform(element);
                this.app.ctx.beginPath();
                this.app.ctx.ellipse(pos.x, pos.y, 5, 5, 0, 0, 2 * Math.PI);
                this.app.ctx.fill();
            } else if (element instanceof Edge && element.v1 && element.v2 && !element.isLoop()) {
                // Draw both dot and outline snapped to the edge to indicate that the edge will be split
                let p0 = new Vector2(element.v1);
                let p1 = new Vector2(element.v2);
                pos = this.app.transform(element.cp
                    ? nearestOnQuadraticCurve(p0, element.cp, p1, this.app.cursorWorldPos)[0]
                    : nearestOnLineSegment(p0, p1, this.app.cursorWorldPos)[0]);
                this.app.ctx.beginPath();
                this.app.ctx.ellipse(pos.x, pos.y, 5, 5, 0, 0, 2 * Math.PI);
                this.app.ctx.fill();
                this.app.ctx.beginPath();
                this.app.ctx.ellipse(pos.x, pos.y, 10 * this.app.view.zoom, 10 * this.app.view.zoom, 0, 0, 2 * Math.PI);
                this.app.ctx.stroke();
            } else {
                // Draw vertex outline to indicate that a new vertex will be created
                this.app.ctx.beginPath();
                this.app.ctx.ellipse(pos.x, pos.y, 10 * this.app.view.zoom, 10 * this.app.view.zoom, 0, 0, 2 * Math.PI);
                this.app.ctx.stroke();
            }
            // Draw edge preview, if applicable
            if (this.firstVertex != null) {
                this.app.ctx.setLineDash([5, 5]);
                this.app.ctx.beginPath();
                let start = this.app.transform(this.firstVertex);
                if (drawingLoop) {
                    // Draw loop preview
                    let radius = 0.5 * Math.hypot(pos.x - start.x, pos.y - start.y);
                    this.app.ctx.ellipse(0.5 * (pos.x + start.x), 0.5 * (pos.y + start.y), radius, radius, 0, 0, 2 * Math.PI);
                } else {
                    // Draw straight edge preview
                    this.app.ctx.moveTo(start.x, start.y);
                    this.app.ctx.lineTo(pos.x, pos.y);
                }
                this.app.ctx.stroke();
            }
        }
        else if (this.dragState && !this.dragState.elements.length && !this.app.cursorPos.isNaN()) {
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

    handleMouseDown(event: ApperMouseDownEvent): boolean {
        if (event.button === 0 || event.button === 2) {
            if (this.dragState && event.button !== this.dragState.button) {
                return true;
            }

            let canSelect = event.button !== 2 && this.app.tool !== Tools.MOVE && this.app.tool !== Tools.CAPTURE;
            let element = canSelect ? this.elementAtCursor() : null;

            if (this.app.tool === Tools.DRAW && event.button === 0) {
                if (element instanceof Vertex) {
                    if (this.firstVertex !== null) {
                        this.edges.push(new Edge({v1: this.firstVertex, v2: element}));
                    } else {
                        this.firstVertex = element;
                    }
                }
                else if (element instanceof Edge && !element.isLoop()) {
                    element = this.splitEdgeAt(element, event.worldPos);
                    if (this.firstVertex != null) {
                        this.edges.push(new Edge({v1: this.firstVertex, v2: element}));
                        this.firstVertex = null;
                    } else {
                        this.firstVertex = element;
                    }
                }
                else {
                    let placed = new Vertex(this.snapToGrid(event.worldPos));
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
                if ("fill" in orig) {
                    orig.fill = Color.NONE;
                }
                orig.stroke = `${this.color}77`;
                orig.lineWidth = 2;
                orig.lineDash = [1, 2];
                return {
                    element: orig,
                    index: item instanceof Vertex ? this.vertices.indexOf(item) : this.edges.indexOf(item),
                };
            });

            this.dragState = {
                button: event.button,
                x: event.screenPos.x,
                y: event.screenPos.y,
                view: this.app.view.copy(),
                elements,
                captureArea: this.captureArea,
                resizeBoxRegion: this.getResizeBoxRegion(),
            };

            return true;
        }

        return false;
    }

    handleMouseMove(event: ApperMouseMoveEvent): boolean {
        if (event.screenPos.isNaN()) {
            return false;
        }
        if (!this.dragState) {
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

        if (this.dragState.button === 2 || this.app.tool === Tools.MOVE || (this.app.tool === Tools.CAPTURE && this.dragState.resizeBoxRegion && this.dragState.resizeBoxRegion & BoxRegion.EXTERNAL)) {
            this.app.view.center.set(revert ? this.dragState.view.center : this.dragState.view.center.sub(dx / this.app.view.zoom, dy / this.app.view.zoom));
        }
        else if (this.app.tool === Tools.CAPTURE && this.dragState.captureArea && this.dragState.resizeBoxRegion) {
            let l = this.dragState.captureArea.x;
            let r = this.dragState.captureArea.xw;
            let t = this.dragState.captureArea.y;
            let b = this.dragState.captureArea.yh;
            if (!revertY) {
                if (this.dragState.resizeBoxRegion & BoxRegion.NEGATIVE_Y) t += dy / this.app.view.zoom;
                if (this.dragState.resizeBoxRegion & BoxRegion.POSITIVE_Y) b += dy / this.app.view.zoom;
            }
            if (!revertX) {
                if (this.dragState.resizeBoxRegion & BoxRegion.POSITIVE_X) r += dx / this.app.view.zoom;
                if (this.dragState.resizeBoxRegion & BoxRegion.NEGATIVE_X) l += dx / this.app.view.zoom;
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
            this.captureArea = new Rect(Math.min(l, r), Math.min(t, b), Math.abs(r - l), Math.abs(b - t));
        }
        else {
            for (let { element, index } of this.dragState.elements) {
                let vertex, edge;
                if (element instanceof Vertex && (vertex = this.vertices[index])) {
                    if (this.app.tool !== Tools.DRAW || this.firstVertex === null) {
                        let p = revert ? new Vector2(element) : this.snapToGrid(new Vector2(element).add(dx / this.app.view.zoom, dy / this.app.view.zoom));
                        vertex.x = p.x;
                        vertex.y = p.y;
                    }
                } else if (element instanceof Edge && (edge = this.edges[index])) {
                    if (this.dragState.elements.length === 1) {
                        if (!edge.cp) {
                            edge.cp = new Vector2();
                        }
                        edge.cp.set(revert ? element.cp ?? this.app.locate(this.dragState) : this.snapToGrid((element.cp ?? this.app.locate(this.dragState)).add(dx / this.app.view.zoom, dy / this.app.view.zoom)));

                        if (!edge.isLoop() && edge.v1 && edge.v2) {
                            this.app.ctx.lineWidth = config.straightenCurveRadius * 2;
                            this.app.ctx.setLineDash([]);
                            this.app.ctx.beginPath();
                            this.app.ctx.moveTo(this.app.transformX(edge.v1.x), this.app.transformY(edge.v1.y));
                            this.app.ctx.lineTo(this.app.transformX(edge.v2.x), this.app.transformY(edge.v2.y));
                            if (this.app.ctx.isPointInStroke(this.app.transformX(edge.cp.x) * this.app.scale, this.app.transformY(edge.cp.y) * this.app.scale)) {
                                edge.cp = null;
                            }
                        }
                    } else if (edge.cp && element.cp) {
                        edge.cp.set(revert ? element.cp : this.snapToGrid(element.cp.add(dx / this.app.view.zoom, dy / this.app.view.zoom)));
                    }
                }
            }
        }

        return true;
    }

    handleMouseUp(event: ApperMouseUpEvent): boolean {
        if (!this.dragState || event.button !== this.dragState.button) {
            return false;
        }

        let dx = this.app.cursorPos.x - this.dragState.x;
        let dy = this.app.cursorPos.y - this.dragState.y;
        let revertX = Math.abs(dx) <= config.revertProximityPixels;
        let revertY = Math.abs(dy) <= config.revertProximityPixels;
        let revert = revertX && revertY;

        let element = this.dragState.button === 2 || this.app.tool === Tools.MOVE || this.app.tool === Tools.CAPTURE ? null : this.elementAtCursor();

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
                    } else if (element instanceof Edge && !element.isLoop()) {
                        let pos = this.app.locate(this.app.cursorPos);
                        let v2 = this.splitEdgeAt(element, pos);
                        this.edges.push(new Edge({v1: this.firstVertex, v2}));
                    } else {
                        let pos = this.snapToGrid(this.app.locate(this.app.cursorPos));
                        // Prevent creating duplicate vertices in the same position (e.g. when grid snapping is enabled)
                        let v2 = this.vertices.findLast(vertex => pos.equals(vertex));
                        if (!v2) {
                            v2 = new Vertex(pos);
                            this.vertices.push(v2);
                        }
                        this.edges.push(new Edge({v1: this.firstVertex, v2}));
                        this.selection = [v2];
                    }
                }
            }
            this.firstVertex = null;
        }
        else if (this.app.tool === Tools.CAPTURE && this.captureArea && this.dragState.resizeBoxRegion) {
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
            if (!revert) {
                let selectBox = new Rect(
                    this.dragState.x,
                    this.dragState.y,
                    this.app.cursorPos.x - this.dragState.x,
                    this.app.cursorPos.y - this.dragState.y,
                ).located(this.app.view).normalized();

                let toSelect: (Vertex | Edge)[] = this.vertices.filter(vertex => {
                    // Check if the selectBox intersects the bounding box of the vertex
                    return selectBox.intersects(new Rect(vertex.x - vertex.r, vertex.y - vertex.r, 2 * vertex.r, 2 * vertex.r));
                });
                toSelect.push(...this.edges.filter(edge => {
                    if (!edge.v1 || !edge.v2) {
                        return false;
                    }
                    // If one endpoint is contained, it is guaranteed that the selection box intersects the edge
                    if (selectBox.contains(edge.v1) || selectBox.contains(edge.v2)) {
                        return true;
                    }
                    else if (edge.cp && edge.v1 !== edge.v2) { // Curved edge
                        // Check if the selection box intersects the curve
                        let minX = Math.min(edge.v1.x, edge.cp.x, edge.v2.x);
                        let maxX = Math.max(edge.v1.x, edge.cp.x, edge.v2.x);
                        let minY = Math.min(edge.v1.y, edge.cp.y, edge.v2.y);
                        let maxY = Math.max(edge.v1.y, edge.cp.y, edge.v2.y);
                        // If the curve's bounding box doesn't intersect, we can skip further checks
                        if (!selectBox.intersects(new Rect(minX, minY, maxX - minX, maxY - minY))) {
                            return false;
                        }
                        let v1 = new Vector2(edge.v1);
                        let v2 = new Vector2(edge.v2);
                        for (let t = 0; t <= 1; t += config.curveSamplingInterval) {
                            if (selectBox.contains(quadraticCurve(t, v1, edge.cp, v2))) {
                                return true;
                            }
                        }
                        return false;
                    }
                    else if (edge.cp && edge.v1 === edge.v2) { // Edge loop
                        // Check if the selection box intersects the loop
                        let center = edge.cp.add(edge.v1).mul(0.5);
                        let radius = 0.5 * Math.hypot(edge.cp.x - edge.v1.x, edge.cp.y - edge.v1.y);
                        // If the loop's bounding box doesn't intersect, we can skip further checks
                        if (!selectBox.intersects(new Rect(center.x - radius, center.y - radius, 2 * radius, 2 * radius))) {
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
                    else { // Straight edge
                        // Check if the selection box intersects the line
                        return linesIntersect(edge.v1, edge.v2, selectBox.xy, selectBox.xwy)
                            || linesIntersect(edge.v1, edge.v2, selectBox.xwy, selectBox.xwyh)
                            || linesIntersect(edge.v1, edge.v2, selectBox.xwyh, selectBox.xyh)
                            || linesIntersect(edge.v1, edge.v2, selectBox.xyh, selectBox.xy);
                    }
                }));
                // Ensure we don't end up with any duplicate elements
                this.selection.push(...toSelect.filter(element => !this.selection.includes(element)));
            }

            if (this.app.tool === Tools.ERASE) {
                this.deleteSelection();
            }
        }

        this.dragState = null;
        return true;
    }

    openContextMenu(event: ApperContextMenuEvent): boolean {
        // TODO: custom context menu
        return true;
    }

    handleScroll(event: ApperWheelEvent): boolean {
        if (event.dy === 0) {
            return false;
        }
        this.app.view.changeZoom(-event.dy * config.scrollZoomMultiplier, this.app.cursorPos.isNaN() ? undefined : this.app.cursorPos);
        return true;
    }

    handleKeyDown(event: ApperKeyEvent): boolean {
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
                this.app.tool = event.ctrlKey ? Tools.SAVE : Tools.STYLE;
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

    snapToGrid(pos: Vector2Like): Vector2 {
        let { gridEnabled, xStep, yStep } = this.gridSettings();
        if (gridEnabled) {
            return new Vector2(Math.round(pos.x / xStep) * xStep, Math.round(pos.y / yStep) * yStep);
        } else {
            return new Vector2(pos);
        }
    }

    splitEdgeAt(edge: Edge, cursorPos: Vector2): Vertex {
        if (!edge.v1 || !edge.v2) {
            throw new Error("Edge to split is missing vertices!");
        }
        let newVertex = new Vertex(cursorPos);
        this.vertices.push(newVertex);

        let other: Edge;
        {
            // Surely there is an easier way to do this in TypeScript...
            let { cp, ...omitCp } = edge;
            let otherData: EdgeDescriptor = { ...omitCp, v1: newVertex, v2: edge.v2 };
            if (cp) {
                otherData.cp = cp;
            }
            other = new Edge(otherData);
        }

        let p0 = new Vector2(edge.v1);
        let p1 = new Vector2(edge.v2);
        if (edge.cp) {
            // Find closest point on curve
            let cp = edge.cp.copy();
            let [pointNearest, tNearest] = nearestOnQuadraticCurve(p0, cp, p1, cursorPos);
            newVertex.x = pointNearest.x;
            newVertex.y = pointNearest.y;
            edge.cp = new Vector2(tNearest * cp.x + (1 - tNearest) * p0.x, tNearest * cp.y + (1 - tNearest) * p0.y);
            other.cp = new Vector2(tNearest * p1.x + (1 - tNearest) * cp.x, tNearest * p1.y + (1 - tNearest) * cp.y);
        } else {
            // Calculate closest point on line segment
            let pointNearest = nearestOnLineSegment(p0, p1, cursorPos)[0];
            newVertex.x = pointNearest.x;
            newVertex.y = pointNearest.y;
        }
        // Split edge at the new vertex
        edge.v2 = newVertex;
        this.edges.push(other);
        return newVertex;
    }

    elementAt(pos: Vector2, includeEdges: boolean = true): Vertex | Edge | null {
        if (pos.isNaN()) {
            return null;
        }

        for (let i = this.vertices.length - 1; i >= 0; i--) {
            let vertex = this.vertices[i]!;
            if (vertex.contains(this.app.ctx, pos, this.selection.includes(vertex), this.app.view, true)) {
                return vertex;
            }
        }

        if (includeEdges) {
            for (let i = this.edges.length - 1; i >= 0; i--) {
                let edge = this.edges[i]!;
                if (edge.contains(this.app.ctx, pos, this.selection.includes(edge), this.app.view, true)) {
                    return edge;
                }
            }
        }

        return null;
    }

    elementAtCursor(): Vertex | Edge | null {
        return this.elementAt(this.app.cursorPos) || (
            this.gridSettings().gridEnabled
                ? this.elementAt(this.app.transform(this.snapToGrid(this.app.cursorWorldPos)), false)
                : null
        );
    }

    selectAll(): void {
        this.selection = this.allElements();
    }

    deselectAll(): void {
        this.selection = [];
    }

    deleteSelection(): boolean {
        if (this.selection.length === 0) {
            return false;
        }

        this.selection.forEach(selected => {
            if (selected instanceof Vertex) {
                this.vertices.splice(this.vertices.indexOf(selected), 1);
                this.edges = this.edges.filter(edge => edge.v1 !== selected && edge.v2 !== selected);
            } else if (this.edges.includes(selected)) {
                this.edges.splice(this.edges.indexOf(selected), 1);
            }
        });
        this.selection = [];

        return true;
    }

    centerView(): void {
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

    fitCaptureTo(elements: (Vertex | Edge)[]): void {
        if (elements.length === 0) {
            this.captureArea = null;
            return;
        }
        elements = elements.flatMap(element => {
            let toCapture = [element];
            if (element instanceof Edge) {
                if (element.v1 && !elements.includes(element.v1)) {
                    toCapture.push(element.v1);
                }
                if (element.v2 && !elements.includes(element.v2)) {
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
            else if (element instanceof Edge && element.v1 && element.v2) {
                if (element.cp && element.v1 !== element.v2) {
                    // Curved edge
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
                } else if (element.cp && element.v1 === element.v2) {
                    // Edge loop
                    let center = element.cp.add(element.v1).mul(0.5);
                    let radius = 0.5 * Math.hypot(element.cp.x - element.v1.x, element.cp.y - element.v1.y);
                    if (center.x - radius - margin < minX) minX = center.x - radius - margin;
                    if (center.x + radius + margin > maxX) maxX = center.x + radius + margin;
                    if (center.y - radius - margin < minY) minY = center.y - radius - margin;
                    if (center.y + radius + margin > maxY) maxY = center.y + radius + margin;
                } else {
                    // Straight edge
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
        this.captureArea = new Rect(minX, minY, maxX - minX, maxY - minY);
    }

    getResizeBoxRegion(): BoxRegion | null {
        if (this.captureArea === null) return null;

        let area = this.captureArea.transformed(this.app.view);
        let broadArea = new Rect(
            area.x - config.resizeProximityPixels,
            area.y - config.resizeProximityPixels,
            area.w + 2 * config.resizeProximityPixels,
            area.h + 2 * config.resizeProximityPixels,
        );

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

    loadFromURL(url: string): void {
        this.app.title = "Loading...";

        let fullURL = url.startsWith("examples") ? `${import.meta.env.BASE_URL}${url}.json` : url;

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

    loadFromFile(file: File): void {
        this.app.title = "Loading...";

        let reader = new FileReader();
        reader.addEventListener("loadend", () => {
            if (reader.error) {
                this.app.showError("The selected file could not be opened.");
                this.app.title = this.app.defaultTitle();
                console.error(reader.error);
            } else {
                try {
                    if (reader.result === null) {
                        throw new Error("reader.result is somehow null!");
                    }
                    let data = JSON.parse(reader.result as string);
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

    loadFromData(data: unknown, reset: boolean = false): void {
        let graph = graphSchema.parse(data);

        this.app.title = graph.title || this.app.defaultTitle();
        this.vertices = graph.vertices ? graph.vertices.map(vertex => new Vertex({
            ...vertex,
            shape: (vertex.shape ? getVertexShapeByID(vertex.shape) : undefined) ?? VertexShape.CIRCLE,
        })) : [];
        this.edges = graph.edges ? graph.edges.map(edge => {
            let v1 = this.vertices[edge.v1];
            let v2 = this.vertices[edge.v2];
            if (!v1 || !v2) {
                throw new Error(`Invalid vertex reference for edge! v1=${edge.v1}, v2=${edge.v2}`);
            }
            let { cp, ...omitCp } = edge;
            let edgeData: EdgeDescriptor = { ...omitCp, v1, v2 };
            if (cp) {
                edgeData.cp = new Vector2(cp[0], cp[1]);
            }
            return new Edge(edgeData);
        }) : [];

        if (reset) {
            this.centerView();
        } else {
            this.app.update();
        }
    }

    getGraphData(): string {
        let vertexDefault = new Vertex();
        let vertices = this.vertices.map(vertex => ({
            x: vertex.x, y: vertex.y,
            r: vertex.r === vertexDefault.r ? undefined : vertex.r,
            fill: vertex.fill === vertexDefault.fill ? undefined : vertex.fill,
            stroke: vertex.stroke === vertexDefault.stroke ? undefined : vertex.stroke,
            lineWidth: vertex.lineWidth === vertexDefault.lineWidth ? undefined : vertex.lineWidth,
            lineDash: !vertex.lineDash.length ? undefined : vertex.lineDash.slice(),
            shape: vertex.shape.id === 0 ? undefined : vertex.shape.id,
        }));

        let edgeDefault = new Edge();
        let edges = this.edges.map(edge => ({
            v1: edge.v1 && this.vertices.indexOf(edge.v1), v2: edge.v2 && this.vertices.indexOf(edge.v2),
            cp: edge.cp === null ? undefined : [edge.cp.x, edge.cp.y],
            stroke: edge.stroke === edgeDefault.stroke ? undefined : edge.stroke,
            lineWidth: edge.lineWidth === edgeDefault.lineWidth ? undefined : edge.lineWidth,
            lineDash: !edge.lineDash.length ? undefined : edge.lineDash.slice(),
            directed: !edge.directed ? undefined : edge.directed,
            arrowAngle: edge.arrowAngle === edgeDefault.arrowAngle ? undefined : edge.arrowAngle,
            arrowLength: edge.arrowLength === edgeDefault.arrowLength ? undefined : edge.arrowLength,
        }));

        return JSON.stringify({
            title: this.app.title,
            vertices,
            edges,
        });
    }
}
