const vertedgeApps = [];

window.addEventListener("load", event => {
  populateAppers(VertedgeApplication, "vertedge-application", vertedgeApps);
});


const Tool = {
  SELECT: 0,
  MOVE: 1,
  DRAW: 2,
  ERASE: 3,
  STYLE: 4,
  GRID: 5,
  CAPTURE: 6,
  DATA: 7,
  LOAD: 8,
  HELP: 9,
}

const Direction = {
  N: 0, E: 1, S: 2, W: 3,
  NW: 4, NE: 5, SE: 6, SW: 7,
  C: 8,
}

const Shape = {
  CIRCLE: 0, SQUARE: 1, DIAMOND: 2,
}


class Vertex {

  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 10;
    this.fill = "#666";
    this.stroke = "#ccc";
    this.lineWidth = 4;
    this.lineDash = [];
    this.shape = Shape.CIRCLE;
  }

  path(ctx) {
    ctx.beginPath();
    switch (this.shape) {
      case Shape.CIRCLE:
      default:
        ctx.ellipse(this.x, this.y, this.r, this.r, 0, 0, 2 * Math.PI);
        break;
      case Shape.SQUARE:
        ctx.rect(this.x - this.r, this.y - this.r, 2 * this.r, 2 * this.r);
        break;
      case Shape.DIAMOND:
        ctx.moveTo(this.x, this.y - 1.3 * this.r);
        ctx.lineTo(this.x - 1.3 * this.r, this.y);
        ctx.lineTo(this.x, this.y + 1.3 * this.r);
        ctx.lineTo(this.x + 1.3 * this.r, this.y);
        ctx.closePath();
        break;
    }
  }

  draw(ctx, hover, select, highlight) {
    // Add highlight if hovered or selected
    if (hover || select) {
      ctx.strokeStyle = select ? `#${highlight}cc` : `#${highlight}99`;
      ctx.lineWidth = this.lineWidth + 4;
      ctx.setLineDash([]);
      this.path(ctx);
      ctx.stroke();
    }
    // Draw the actual vertex
    ctx.fillStyle = this.fill;
    ctx.strokeStyle = this.stroke;
    ctx.lineWidth = this.lineWidth;
    ctx.setLineDash(this.lineDash);
    this.path(ctx);
    ctx.fill();
    ctx.stroke();
  }

  contains(ctx, pos, select) {
    // Recreate shape of vertex
    ctx.lineWidth = select ? this.lineWidth + 4 : Math.max(this.lineWidth + 4, 12);
    this.path(ctx);
    // Check collision
    return ctx.isPointInPath(pos.x, pos.y) || ctx.isPointInStroke(pos.x, pos.y);
  }

  copy() {
    let copy = new Vertex(this.x, this.y);
    copy.r = this.r;
    copy.fill = this.fill;
    copy.stroke = this.stroke;
    copy.lineWidth = this.lineWidth;
    copy.lineDash = this.lineDash.slice();
    copy.shape = this.shape;
    return copy;
  }

  get margin() {
    return (this.shape === Shape.DIAMOND ? 1.3 : 1) * this.r + 0.5 * this.lineWidth;
  }
  
}


class Edge {

  constructor(v1, v2) {
    this.v1 = v1;
    this.v2 = v2;
    this.cp = null;
    this.stroke = "#666";
    this.lineWidth = 4;
    this.lineDash = [];
  }

  path(ctx) {
    ctx.beginPath();
    ctx.moveTo(this.v1.x, this.v1.y);
    if (this.cp === null) ctx.lineTo(this.v2.x, this.v2.y);
    else ctx.quadraticCurveTo(this.cp.x, this.cp.y, this.v2.x, this.v2.y);
  }

  draw(ctx, hover, select, highlight) {
    // Add highlight if hovered or selected
    if (hover || select) {
      ctx.strokeStyle = select ? `#${highlight}cc` : `#${highlight}99`;
      ctx.lineWidth = this.lineWidth + 4;
      ctx.setLineDash([]);
      this.path(ctx);
      ctx.stroke();
    }
    // Draw the edge itself
    ctx.strokeStyle = this.stroke;
    ctx.lineWidth = this.lineWidth;
    ctx.setLineDash(this.lineDash);
    this.path(ctx);
    ctx.stroke();
    // Add the control point visual on top if selected
    if (select && this.cp !== null) {
      // Draw lines to control point
      ctx.strokeStyle = `#${highlight}77`;
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.moveTo(this.v1.x, this.v1.y);
      ctx.lineTo(this.cp.x, this.cp.y);
      ctx.moveTo(this.v2.x, this.v2.y);
      ctx.lineTo(this.cp.x, this.cp.y);
      ctx.stroke();
      // Draw diamond at control point
      ctx.fillStyle = `#${highlight}cc`;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(this.cp.x, this.cp.y + 8);
      ctx.lineTo(this.cp.x + 8, this.cp.y);
      ctx.lineTo(this.cp.x, this.cp.y - 8);
      ctx.lineTo(this.cp.x - 8, this.cp.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  contains(ctx, pos, select) {
    // Check control point first
    if (this.cp !== null) {
      ctx.beginPath();
      ctx.ellipse(this.cp.x, this.cp.y, 10, 10, 0, 0, 2 * Math.PI);
      if (ctx.isPointInPath(pos.x, pos.y)) return true;
    }
    // Recreate shape of edge
    ctx.lineWidth = select ? this.lineWidth + 4 : Math.max(this.lineWidth + 4, 12);
    ctx.beginPath();
    ctx.moveTo(this.v1.x, this.v1.y);
    if (this.cp === null) ctx.lineTo(this.v2.x, this.v2.y);
    else ctx.quadraticCurveTo(this.cp.x, this.cp.y, this.v2.x, this.v2.y);
    // Check collision
    return ctx.isPointInStroke(pos.x, pos.y);
  }

  copy() {
    let copy = new Edge(this.v1.copy(), this.v2.copy());
    copy.cp = this.cp === null ? null : this.cp.copy();
    copy.stroke = this.stroke;
    copy.lineWidth = this.lineWidth;
    copy.lineDash = this.lineDash.slice();
    return copy;
  }

  get margin() {
    return 0.5 * this.lineWidth;
  }

}


// Position at t (quadratic beziér): t²r + 2t(1-t)q + (1-t)²p
const curveQ = (t, p, q, r) => r.mul(t*t).add(q.mul(2*t*(1-t))).add(p.mul((1-t)*(1-t)));
// Velocity at t (quadratic beziér): 2tr + (2(1-t)-2t)q - 2(1-t)p
const curveQDelta = (t, p, q, r) => r.mul(2*t).add(q.mul(2*(1-t)-2*t)).sub(p.mul(2*(1-t)));
const curveQVertX = (p, q, r) => p.x - 2*q.x + r.x === 0 ? null : (-q.x*q.x + 2*q.x*r.x - r.x*r.x) / (p.x - 2*q.x + r.x) + r.x;
const curveQVertY = (p, q, r) => p.y - 2*q.y + r.y === 0 ? null : (-q.y*q.y + 2*q.y*r.y - r.y*r.y) / (p.y - 2*q.y + r.y) + r.y;

const ptOrient = (p1, p2, p3) => Math.sign((p2.y-p1.y)*(p3.x-p2.x) - (p2.x-p1.x)*(p3.y-p2.y));
const linesIntersect = (p1, q1, p2, q2) => ptOrient(p1, q1, p2) != ptOrient(p1, q1, q2) && ptOrient(p2, q2, p1) != ptOrient(p2, q2, q1);


class VertedgeApplication extends ApperApplication {

  get dragging() { return this.drag !== null; }
  get grid() { return {x: this.gridWidthInput.value, y: this.gridHeightInput.value}; }

  constructor(element) {
    super(element);

    this.HOST_URL = "https://raw.githubusercontent.com/xarkenz/vertedge/main/"
    this.BEZIER_SAMPLE_INTERVAL = 0.01;
    this.REVERT_PROXIMITY = 8;
    this.RESIZE_PROXIMITY = 12;

    this.enableToolbar()
      .addTool("select", "Select", "icons/select.svg", "keyv", "v", true)
      .addTool("move", "Move", "icons/move.svg", "keym", "m")
      .addTool("draw", "Draw", "icons/draw.svg", "keyd", "d")
      .addTool("erase", "Erase", "icons/erase.svg", "keyx", "x")
      .addTool("style", "Style", "icons/style.svg", "keys", "s")
      .addTool("grid", "Grid", "icons/grid.svg", "keyg", "g")
      .addSpacer()
      .addTool("capture", "Capture", "icons/capture.svg")
      .addTool("data", "View Data", "icons/data.svg")
      .addTool("load", "Load", "icons/load.svg")
      .addTool("help", "Help", "icons/help.svg", "keyh", "h");

    let icons = ["icons/shape-circle.svg", "icons/shape-square.svg", "icons/shape-diamond.svg"];
    this.addMenu(0, "Element Style")
      .addSeparator()
      .add(this.shapeInput = new ApperHSpread("vertedge-vertex-shape", "Shape:", icons)
        .onChange(value => {
          this.selection.forEach(element => {
            if (element instanceof Vertex) element.shape = value;
          });
          this.update();
        }))
      .add(this.radiusInput = new ApperNumberInput("vertedge-radius", "Radius:", "icons/radius.svg")
        .onChange(value => {
          this.selection.forEach(element => {
            if (element instanceof Vertex) element.r = value;
          });
          this.update();
        }))
      .add(this.lineWidthInput = new ApperNumberInput("vertedge-line-width", "Line width:", "icons/line-width.svg")
        .onChange(value => {
          this.selection.forEach(element => {
            element.lineWidth = value;
          });
          this.update();
        }));

    this.addMenu(1, "Grid Settings")
      .addSeparator()
      .add(this.enableGrid = new ApperCheckbox("vertedge-enable-grid", "Enable grid")
        .onChange(value => this.update()))
      .add(this.gridWidthInput = new ApperNumberInput("vertedge-grid-width", "Horizontal spacing:", "icons/width.svg", 50)
        .onChange(value => this.update()))
      .add(this.gridHeightInput = new ApperNumberInput("vertedge-grid-height", "Vertical spacing:", "icons/height.svg", 50)
        .onChange(value => this.update()));

    this.captureMenu = {ID: 2};
    this.addMenu(this.captureMenu.ID, "Capture Image")
      .addSeparator()
      .add(this.captureMenu.prompt = new ApperParagraph("To capture a graph image, try adding some components to the graph."))
      .add(this.captureMenu.instructions = new ApperParagraph("Resize the box to crop the resulting image. To move the view, drag from outside the box.").hide())
      .addSeparator()
      .add(this.captureMenu.emptyPreview = new ApperParagraph("An image preview will appear here."))
      .add(this.captureMenu.preview = new ApperCanvasImage("Preview:").hide())
      .add(this.captureMenu.download = new ApperButton("Download as PNG").hide());

    this.addMenu(3, "Raw Graph Data")
      .addSeparator()
      .add(this.dataEditor = new ApperTextEditor("vertedge-data-editor", "Raw JSON data...")
        .onChange(text => {
          if (!text) this.loadFromData({});
          else try {
            this.loadFromData(JSON.parse(text));
            this.dataEditor.valid = true;
          } catch (err) {
            if (!(err instanceof SyntaxError)) console.error(err);
            this.dataEditor.valid = false;
          }
          this.update();
        }));

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

    this.addMenu(4, "Load a Graph")
      .addSeparator()
      .add(new ApperButtonList("Example Graphs:", this.exampleURLs, this.exampleTitles)
        .onChange(url => {
          this.toolbar.tool = Tool.SELECT;
          this.update();
          this.load(url);
        }));

    this.addMenu(5, "Need help?")
      .addSeparator()
      .add(new ApperParagraph("Sorry, nothing here yet. Coming soon!"));

    this.defaultTitle = "Untitled Graph";

    this.selection = [];

    this.drag = null;
    this.firstVertex = null;
    this.color = "";
    this.captureArea = null;

    this.vertices = [];
    this.edges = [];

    this.update();
    
    if (window.location.hash) this.load(window.location.hash.slice(1));
  }

  render() {
    if (this.toolbar === null) return;

    const element = this.toolbar.tool === Tool.MOVE || this.toolbar.tool === Tool.CAPTURE ? null : this.elementAt(this.cursorPos);
    this.color = this.toolbar.tool === Tool.DRAW ? "23a54c"  // green
               : this.toolbar.tool === Tool.ERASE ? "e84b33"  // red
               : "b762f0";  // purple
    const captureResizeDirection = this.captureResizeDirection;

    if (this.toolbar.tool !== Tool.DRAW) this.firstVertex = null;
    if (this.toolbar.tool !== Tool.CAPTURE) this.captureArea = null;

    if (this.toolbar.tool === Tool.STYLE && this.selection.length > 0) {
      if (this.selection.some(element => element instanceof Vertex)) {
        this.shapeInput.element.style.display = "";
        this.radiusInput.element.style.display = "";
        
        let shape = null;
        for (let element of this.selection) {
          if (element instanceof Vertex)
            if (shape === null) shape = element.shape;
            else if (element.shape !== shape) {
              shape = null;
              break;
            }
        }
        this.shapeInput.value = shape;
  
        let radius = null;
        for (let element of this.selection) {
          if (element instanceof Vertex)
            if (radius === null) radius = element.r;
            else if (element.r !== radius) {
              radius = null;
              break;
            }
        }
        this.radiusInput.value = radius === null ? 10 : radius;
      } else {
        this.shapeInput.element.style.display = "none";
        this.radiusInput.element.style.display = "none";
      }

      let lineWidth = null;
      for (let element of this.selection) {
        if (lineWidth === null) lineWidth = element.lineWidth;
        else if (element.lineWidth !== lineWidth) {
          lineWidth = null;
          break;
        }
      }
      this.lineWidthInput.value = lineWidth ?? 4;
      
      this.menu(0).show();
    } else this.menu(0).hide();

    if (this.toolbar.tool === Tool.GRID) this.menu(1).show();
    else this.menu(1).hide();

    if (this.toolbar.tool === Tool.CAPTURE) {
      if (this.captureArea === null) this.fitCaptureTo(this.vertices, this.edges);
      if (this.captureArea === null) {
        this.captureMenu.instructions.hide();
        this.captureMenu.preview.hide();
        this.captureMenu.download.hide();
        this.captureMenu.prompt.show();
        this.captureMenu.emptyPreview.show();

        this.captureMenu.download.url = "";
        this.captureMenu.download.filename = "";
      } else {
        this.captureMenu.prompt.hide();
        this.captureMenu.emptyPreview.hide();
        this.captureMenu.instructions.show();
        this.captureMenu.preview.show();
        this.captureMenu.download.show();

        this.captureMenu.preview.label = `Preview (${this.captureArea.w} \u00d7 ${this.captureArea.h}):`
        this.captureMenu.preview.resize(this.captureArea.w, this.captureArea.h);
        this.captureMenu.preview.ctx.resetTransform();
        this.captureMenu.preview.ctx.clearRect(0, 0, this.captureMenu.preview.canvas.width, this.captureMenu.preview.canvas.height);
        this.captureMenu.preview.ctx.translate(-this.captureArea.x, -this.captureArea.y);

        this.edges.forEach(edge => {
          edge.draw(this.captureMenu.preview.ctx, false, false, this.color);
        });
        this.vertices.forEach(vertex => {
          vertex.draw(this.captureMenu.preview.ctx, false, false, this.color);
        });

        this.captureMenu.download.url = this.captureMenu.preview.canvas.toDataURL("image/png");
        this.captureMenu.download.filename = `${this.title}.png`;
      }

      this.menu(this.captureMenu.ID).show();
    } else this.menu(this.captureMenu.ID).hide();

    if (this.toolbar.tool === Tool.DATA) {
      if (!this.dataEditor.editing) this.dataEditor.text = this.graphData;
      
      this.menu(3).show();
    } else this.menu(3).hide();

    if (this.toolbar.tool === Tool.LOAD) this.menu(4).show();
    else this.menu(4).hide();

    if (this.toolbar.tool === Tool.HELP) this.menu(5).show();
    else this.menu(5).hide();

    if (this.toolbar.tool === Tool.MOVE) {
      this.element.style.cursor = this.dragging ? "grabbing" : "";
      this.canvas.style.cursor = this.dragging ? "" : "grab";
    } else if (this.toolbar.tool === Tool.CAPTURE) {
      let cursor = "";
      switch (this.drag?.captureResizeDirection ?? captureResizeDirection) {
        case Direction.N: cursor = "n-resize"; break;
        case Direction.E: cursor = "e-resize"; break;
        case Direction.S: cursor = "s-resize"; break;
        case Direction.W: cursor = "w-resize"; break;
        case Direction.NW: cursor = "nw-resize"; break;
        case Direction.NE: cursor = "ne-resize"; break;
        case Direction.SE: cursor = "se-resize"; break;
        case Direction.SW: cursor = "sw-resize"; break;
        default: cursor = this.dragging ? "grabbing" : "grab"; break;
      }
      this.element.style.cursor = this.dragging ? cursor : "";
      this.canvas.style.cursor = this.dragging ? "" : cursor;
    } else {
      this.element.style.cursor = "";
      this.canvas.style.cursor = "";
    }

    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    if (this.enableGrid.checked) {
      let grid = this.grid;
      let topLeft = this.getWorldPos(new ApperPoint());
      let bottomRight = this.getWorldPos(new ApperPoint(this.canvas.width, this.canvas.height));
      
      this.ctx.strokeStyle = "#fff1";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([]);
      this.ctx.beginPath();
      
      for (let x = Math.floor(topLeft.x / grid.x) * grid.x; x <= Math.ceil(bottomRight.x / grid.x) * grid.x; x += grid.x) {
        this.ctx.moveTo(x, topLeft.y);
        this.ctx.lineTo(x, bottomRight.y);
      }
      
      for (let y = Math.floor(topLeft.y / grid.y) * grid.y; y <= Math.ceil(bottomRight.y / grid.y) * grid.y; y += grid.y) {
        this.ctx.moveTo(topLeft.x, y);
        this.ctx.lineTo(bottomRight.x, y);
      }

      this.ctx.stroke();
    }

    if (this.dragging && this.drag.elements.length > 0) {
      for (let element of this.drag.elements) {
        element.draw(this.ctx, false, false, this.color);
        if (element instanceof Edge && element.cp !== null) {
          this.ctx.strokeStyle = `#${this.color}77`;
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([]);
          this.ctx.beginPath();
          this.ctx.ellipse(element.cp.x, element.cp.y, 3, 3, 0, 0, 2 * Math.PI);
          this.ctx.stroke();
        }
      }
    }

    // Draw edges, then vertices (later index -> higher z)
    this.edges.forEach(edge => {
      edge.draw(this.ctx, !this.dragging && element === edge, this.selection.includes(edge), this.color);
    });
    this.vertices.forEach(vertex => {
      vertex.draw(this.ctx, !this.dragging && element === vertex, this.selection.includes(vertex), this.color);
    });

    // Add cursor dot and other indicators
    if (this.toolbar.tool === Tool.DRAW && !this.cursorPos.equals(0, 0)) {
      const worldPos = this.snapToGrid(this.getWorldPos(this.cursorPos));
      if (this.firstVertex !== null) {
        this.ctx.strokeStyle = `#${this.color}aa`;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.firstVertex.x, this.firstVertex.y);
        if (element instanceof Vertex) {
          this.ctx.lineTo(element.x, element.y);
          this.ctx.stroke();
        } else {
          this.ctx.lineTo(worldPos.x, worldPos.y);
          this.ctx.stroke();
        }
      }
      if (element == null || element instanceof Edge) {
        this.ctx.fillStyle = `#${this.color}aa`;
        this.ctx.beginPath();
        this.ctx.ellipse(worldPos.x, worldPos.y, 5, 5, 0, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    }

    // Draw selection box
    if (this.toolbar.tool !== Tool.MOVE && this.toolbar.tool !== Tool.DRAW && this.toolbar.tool !== Tool.CAPTURE && this.dragging && !this.drag.elements.length && !this.cursorPos.equals(0, 0)) {
      let start = this.getWorldPos(new ApperPoint(this.drag.x, this.drag.y));
      let end = this.getWorldPos(this.cursorPos);
      this.ctx.strokeStyle = `#${this.color}77`;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.beginPath();
      // This differs from ctx.rect() because it locks the line dash at the start and end points
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, start.y);
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(start.x, end.y);
      this.ctx.moveTo(end.x, end.y);
      this.ctx.lineTo(start.x, end.y);
      this.ctx.moveTo(end.x, end.y);
      this.ctx.lineTo(end.x, start.y);
      this.ctx.stroke();
    }

    // Draw capture box
    if (this.toolbar.tool === Tool.CAPTURE && this.captureArea !== null) {
      this.ctx.fillStyle = "#ff942133";
      this.ctx.strokeStyle = "#ff9421aa";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([]);
      this.ctx.beginPath();
      this.ctx.rect(this.captureArea.x, this.captureArea.y, this.captureArea.w, this.captureArea.h);
      this.ctx.fill();
      this.ctx.rect(this.captureArea.x - 6, this.captureArea.y - 6, 12, 12);
      this.ctx.rect(this.captureArea.X - 6, this.captureArea.y - 6, 12, 12);
      this.ctx.rect(this.captureArea.X - 6, this.captureArea.Y - 6, 12, 12);
      this.ctx.rect(this.captureArea.x - 6, this.captureArea.Y - 6, 12, 12);
      let midX = Math.round(0.5 * (this.captureArea.x + this.captureArea.X));
      let midY = Math.round(0.5 * (this.captureArea.y + this.captureArea.Y));
      if (this.captureArea.w > 2 * this.RESIZE_PROXIMITY) {
        this.ctx.rect(midX - 6, this.captureArea.y - 6, 12, 12);
        this.ctx.rect(midX - 6, this.captureArea.Y - 6, 12, 12);
      }
      if (this.captureArea.h > 2 * this.RESIZE_PROXIMITY) {
        this.ctx.rect(this.captureArea.X - 6, midY - 6, 12, 12);
        this.ctx.rect(this.captureArea.x - 6, midY - 6, 12, 12);
      }
      this.ctx.stroke();
      if (this.drag?.captureResizeDirection ?? captureResizeDirection != null) {
        this.ctx.fillStyle = this.drag?.captureResizeDirection != null ? "#ff9421aa" : "#ff942177";
        this.ctx.beginPath();
        switch (this.drag?.captureResizeDirection ?? captureResizeDirection) {
          case Direction.N: this.ctx.rect(midX - 6, this.captureArea.y - 6, 12, 12); break;
          case Direction.E: this.ctx.rect(this.captureArea.X - 6, midY - 6, 12, 12); break;
          case Direction.S: this.ctx.rect(midX - 6, this.captureArea.Y - 6, 12, 12); break;
          case Direction.W: this.ctx.rect(this.captureArea.x - 6, midY - 6, 12, 12); break;
          case Direction.NW: this.ctx.rect(this.captureArea.x - 6, this.captureArea.y - 6, 12, 12); break;
          case Direction.NE: this.ctx.rect(this.captureArea.X - 6, this.captureArea.y - 6, 12, 12); break;
          case Direction.SE: this.ctx.rect(this.captureArea.X - 6, this.captureArea.Y - 6, 12, 12); break;
          case Direction.SW: this.ctx.rect(this.captureArea.x - 6, this.captureArea.Y - 6, 12, 12); break;
          default: break;
        }
        this.ctx.fill();
      }
    }
  }

  mouseDown(event) {
    if (event.leftBtn) {
      let p = this.snapToGrid(event.worldPos);
      let element = this.toolbar.tool === Tool.MOVE || this.toolbar.tool === Tool.CAPTURE ? null : this.elementAt(event.screenPos);
      
      if (this.toolbar.tool === Tool.DRAW) {
        if (element === null) {
          let placed = new Vertex(p.x, p.y);
          this.vertices.push(placed);
          element = placed;
          if (this.firstVertex !== null && this.firstVertex !== element) {
            this.edges.push(new Edge(this.firstVertex, placed));
            this.firstVertex = null;
          } else {
            this.firstVertex = element;
          }
        } else if (element instanceof Vertex) {
          if (this.firstVertex !== null) {
            this.edges.push(new Edge(this.firstVertex, element));
          } else {
            this.firstVertex = element;
          }
        } else if (element instanceof Edge) {
          let placed = new Vertex(p.x, p.y);
          this.vertices.push(placed);
          let other = new Edge(placed, element.v2);
          if (element.cp !== null) {
            let p0 = new ApperPoint(element.v1);
            let p1 = new ApperPoint(element.v2);
            let cp = element.cp.copy();
            let tc = 0;
            let closest = Infinity;
            let lastTest = Infinity;
            for (let t = 0; t <= 1; t += this.BEZIER_SAMPLE_INTERVAL) {
              let pos = curveQ(t, p0, cp, p1);
              let delta = curveQDelta(t, p0, cp, p1);
              // The only part of test we need is its roots, so this doesn't match derivative of distance otherwise
              let test = (pos.x - p.x) * delta.x + (pos.y - p.y) * delta.y;
              if (t === 0 || t === 1 || lastTest <= 0 && test >= 0) {
                let dist = Math.hypot(p.x - pos.x, p.y - pos.y);
                if (dist < closest) {
                  closest = dist;
                  tc = t;
                }
              }
              lastTest = test;
            }
            let pos = curveQ(tc, p0, cp, p1);
            placed.x = pos.x;
            placed.y = pos.y;
            element.cp.set(tc*cp.x + (1-tc)*p0.x, tc*cp.y + (1-tc)*p0.y);
            other.cp = new ApperPoint(tc*p1.x + (1-tc)*cp.x, tc*p1.y + (1-tc)*cp.y);
          }
          element.v2 = placed;
          this.edges.push(other);
          element = placed;
          if (this.firstVertex !== null) {
            this.edges.push(new Edge(this.firstVertex, placed));
            this.firstVertex = null;
          }
        }
      } else if (this.toolbar.tool === Tool.ERASE) {
        if (element !== null) {
          if (!this.selection.includes(element)) this.selection = [element];
          this.deleteSelection();
          element = null;
        }
      }

      if (element === null) {
        if (this.toolbar.tool !== Tool.MOVE && this.toolbar.tool !== Tool.CAPTURE && !event.shiftKey) this.selection = [];
      } else if (event.shiftKey) {
        if (this.selection.includes(element)) {
          this.selection.splice(this.selection.indexOf(element), 1);
        } else {
          this.selection.push(element);
        }
      } else if (!this.selection.includes(element)) {
        this.selection = [element];
      }

      let elements = this.selection.map(item => {
        let orig = item.copy();
        if (orig.fill !== undefined) orig.fill = "transparent";
        orig.stroke = `#${this.color}77`;
        orig.lineWidth = 2;
        orig.lineDash = [4, 4];
        return orig;
      });
      let indices = this.selection.map(item => item instanceof Vertex ? this.vertices.indexOf(item) : this.edges.indexOf(item));

      this.drag = {
        x: event.screenPos.x,
        y: event.screenPos.y,
        transform: this.transform,
        elements, indices,
        captureArea: this.captureArea,
        captureResizeDirection: this.toolbar.tool === Tool.CAPTURE ? this.captureResizeDirection : null
      };
      
      if (elements.length === 1 && elements[0] instanceof Edge && elements[0].cp === null) {
        this.drag.elements[0].cp = p.copy();
      }
    }

    return true;
  }

  mouseMove(event) {
    if (event.screenPos.equals(0, 0)) return false;
    if (!this.dragging) return true;

    let revertX = Math.abs(event.screenPos.x - this.drag.x) <= this.REVERT_PROXIMITY * this.pixelRatio, revertY = Math.abs(event.screenPos.y - this.drag.y) <= this.REVERT_PROXIMITY * this.pixelRatio;
    let revert = revertX && revertY;
    let dx = (event.screenPos.x - this.drag.x) / this.pixelRatio;
    let dy = (event.screenPos.y - this.drag.y) / this.pixelRatio;

    if (this.toolbar.tool === Tool.MOVE || this.toolbar.tool === Tool.CAPTURE && this.drag.captureResizeDirection === null) {
      this.transform = revert ? this.drag.transform.translate(0, 0) : this.drag.transform.translate(dx, dy);

    } else if (this.toolbar.tool === Tool.CAPTURE) {
      let l = this.drag.captureArea.x, r = this.drag.captureArea.x + this.drag.captureArea.w, t = this.drag.captureArea.y, b = this.drag.captureArea.y + this.drag.captureArea.h;
      switch (this.drag.captureResizeDirection) {
        case Direction.N: if (!revertY) t += dy; if (t >= b) t = b - 1; break;
        case Direction.E: if (!revertX) r += dx; if (r <= l) r = l + 1; break;
        case Direction.S: if (!revertY) b += dy; if (b <= t) b = t + 1; break;
        case Direction.W: if (!revertX) l += dx; if (l >= r) l = r - 1; break;
        case Direction.NW: if (!revert) { t += dy; l += dx; } if (t >= b) t = b - 1; if (l >= r) l = r - 1; break;
        case Direction.NE: if (!revert) { t += dy; r += dx; } if (t >= b) t = b - 1; if (r <= l) r = l + 1; break;
        case Direction.SE: if (!revert) { b += dy; r += dx; } if (b <= t) b = t + 1; if (r <= l) r = l + 1; break;
        case Direction.SW: if (!revert) { b += dy; l += dx; } if (b <= t) b = t + 1; if (l >= r) l = r - 1; break;
        case Direction.C: if (!revert) { l += dx; r += dx; t += dy; b += dy; } break;
        default: break;
      }
      this.captureArea = new ApperRect(l, t, r - l, b - t);

    } else if (!this.drag.elements.length) {
      // TODO: update selection w/ selectbox
      
    } else for (let i = 0; i < this.drag.elements.length; i++) {
      let element = this.drag.elements[i];
      let index = this.drag.indices[i];
        
      if (element instanceof Vertex) {
        let vertex = this.vertices[index];
        let p = revert ? new ApperPoint(element) : this.snapToGrid(new ApperPoint(element).add(dx, dy));
        if (this.toolbar.tool === Tool.DRAW && this.firstVertex !== null) {
          if (vertex !== this.firstVertex) {
            if (!revert) console.log("change curvature");
  	      }
        } else {
          vertex.x = p.x;
          vertex.y = p.y;
        }
        
      } else if (element instanceof Edge) {
        let edge = this.edges[index];
        if (this.drag.elements.length === 1) {
          if (edge.cp === null) edge.cp = new ApperPoint();
          let p = revert ? element.cp : this.snapToGrid(element.cp.add(dx, dy));
          edge.cp.set(p);
    
          const v1 = edge.v1;
          const v2 = edge.v2;
          const cp = edge.cp;
          const angleDiff = Math.acos(((cp.x - v1.x) * (v2.x - cp.x) + (cp.y - v1.y) * (v2.y - cp.y)) / (Math.hypot(cp.x - v1.x, cp.y - v1.y) * Math.hypot(v2.x - cp.x, v2.y - cp.y)));
          if (angleDiff < 0.3) edge.cp = null;
        } else if (edge.cp !== null && element.cp !== null) {
          edge.cp.set(this.snapToGrid(element.cp.add(dx, dy)))
        }
      }
    }

    return true;
  }

  mouseUp(event) {
    if (event.leftBtn && this.drag !== null) {
      let element = this.toolbar.tool === Tool.MOVE ? null : this.elementAt(this.cursorPos);

      if (this.toolbar.tool === Tool.DRAW) {
        if (this.firstVertex !== null && this.firstVertex !== element) {
          if (element instanceof Vertex) {
            this.edges.push(new Edge(this.firstVertex, element));
            this.selection = [element];
          } else {
            let worldPos = this.snapToGrid(this.getWorldPos(this.cursorPos));
            let placed = new Vertex(worldPos.x, worldPos.y);
            this.vertices.push(placed);
            this.edges.push(new Edge(this.firstVertex, placed));
            this.selection = [placed];
          }
        }
        this.firstVertex = null;

      } else if (this.toolbar.tool === Tool.CAPTURE) {
        this.captureArea = this.captureArea.normalized;

      } else if (this.toolbar.tool !== Tool.MOVE && !this.drag.elements.length) {
        if (!event.shiftKey) this.selection = [];
        let selectBox = new ApperRect(this.drag.x, this.drag.y, this.cursorPos.x - this.drag.x, this.cursorPos.y - this.drag.y).transform(this.transform.inverse());
        this.vertices.filter(vertex => {
          return selectBox.intersects(new ApperRect(vertex.x - vertex.r, vertex.y - vertex.r, 2 * vertex.r, 2 * vertex.r));
        }).concat(this.edges.filter(edge => {
          if (selectBox.contains(edge.v1) || selectBox.contains(edge.v2)) return true;
          if (edge.cp === null) {
            return linesIntersect(edge.v1, edge.v2, selectBox.xy, selectBox.Xy)
                || linesIntersect(edge.v1, edge.v2, selectBox.Xy, selectBox.XY)
                || linesIntersect(edge.v1, edge.v2, selectBox.XY, selectBox.xY)
                || linesIntersect(edge.v1, edge.v2, selectBox.xY, selectBox.xy);
          } else {
            let bounds = [
              Math.min(edge.v1.x, edge.cp.x, edge.v2.x),
              Math.max(edge.v1.x, edge.cp.x, edge.v2.x),
              Math.min(edge.v1.y, edge.cp.y, edge.v2.y),
              Math.max(edge.v1.y, edge.cp.y, edge.v2.y)
            ];
            if (!selectBox.intersects(new ApperRect(bounds[0], bounds[2], bounds[1] - bounds[0], bounds[3] - bounds[2]))) return false;
            let v1 = new ApperPoint(edge.v1);
            let v2 = new ApperPoint(edge.v2);
            for (let t = 0; t <= 1; t += this.BEZIER_SAMPLE_INTERVAL) {
              if (selectBox.contains(curveQ(t, v1, edge.cp, v2))) return true;
            }
            return false;
          }
        })).forEach(selected => {
          if (!this.selection.includes(selected)) this.selection.push(selected);
        });
        
        if (this.toolbar.tool === Tool.ERASE) this.deleteSelection();
      }

      this.drag = null;
      return true;
    }
  }

  keyDown(event) {
    switch (event.key) {
      case "keyv": this.toolbar.tool = Tool.SELECT; break;
      case "keym": this.toolbar.tool = Tool.MOVE; break;
      case "keyd": this.toolbar.tool = Tool.DRAW; break;
      case "keyx": this.toolbar.tool = Tool.ERASE; break;
      case "keys": this.toolbar.tool = Tool.STYLE; break;
      case "keyg": this.toolbar.tool = Tool.GRID; break;
      case "keyh": this.toolbar.tool = Tool.HELP; break;
      case "escape": this.firstVertex = null; break;
      case "backspace":
      case "delete":
        if (!this.selection.length) return false;
        this.deleteSelection();
        break;
      case "period":
      case "numpaddecimal":
        this.centerView();
        break;
      default:
        return false;
    }

    return true;
  }

  snapToGrid(pos) {
    if (this.enableGrid.checked)
      return new ApperPoint(Math.round(pos.x / this.grid.x) * this.grid.x, Math.round(pos.y / this.grid.y) * this.grid.y);
    return pos;
  }

  elementAt(pos) {
    for (let i = this.vertices.length - 1; i >= 0; i--) {
      if (this.vertices[i].contains(this.ctx, pos, this.selection.includes(this.vertices[i]))) {
        return this.vertices[i];
      }
    }

    for (let i = this.edges.length - 1; i >= 0; i--) {
      if (this.edges[i].contains(this.ctx, pos, this.selection.includes(this.edges[i]))) {
        return this.edges[i];
      }
    }

    return null;
  }

  deleteSelection() {
    this.selection.forEach(selected => {
      if (selected instanceof Vertex) {
        this.vertices.splice(this.vertices.indexOf(selected), 1);
        this.edges = this.edges.filter(edge => edge.v1 !== selected && edge.v2 !== selected);
      } else this.edges.splice(this.edges.indexOf(selected), 1);
      this.selection = this.selection.filter(element => this.vertices.includes(element) || this.edges.includes(element));
    });
  }

  centerView() {
    let oldCenter = this.getWorldPos(new ApperPoint(this.canvas.width, this.canvas.height).mul(0.5));
    this.transform = this.transform.translate(oldCenter.x, oldCenter.y);
    
    if (this.vertices.length) {
      let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
      this.vertices.forEach(vertex => {
        if (vertex.x < l) l = vertex.x;
        if (vertex.x > r) r = vertex.x;
        if (vertex.y < t) t = vertex.y;
        if (vertex.y > b) b = vertex.y;
      });
      this.transform = this.transform.translate(-0.5 * (l + r), -0.5 * (t + b));
    }

    this.update();
  }

  fitCaptureTo(vertices, edges) {
    if (vertices.length) {
      let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
      vertices.forEach(vertex => {
        if (vertex.x - vertex.margin < l) l = vertex.x - vertex.margin;
        if (vertex.x + vertex.margin > r) r = vertex.x + vertex.margin;
        if (vertex.y - vertex.margin < t) t = vertex.y - vertex.margin;
        if (vertex.y + vertex.margin > b) b = vertex.y + vertex.margin;
      });
      edges.forEach(edge => {
        if (edge.cp !== null) {
          if (edge.cp.x < edge.v1.x && edge.cp.x < edge.v2.x || edge.cp.x > edge.v1.x && edge.cp.x > edge.v2.x) {
            let vx = curveQVertX(edge.v1, edge.cp, edge.v2);
            if (vx - edge.margin < l) l = vx - edge.margin;
            if (vx + edge.margin > r) r = vx + edge.margin;
          }
          if (edge.cp.y < edge.v1.y && edge.cp.y < edge.v2.y || edge.cp.y > edge.v1.y && edge.cp.y > edge.v2.y) {
            let vy = curveQVertY(edge.v1, edge.cp, edge.v2);
            if (vy - edge.margin < t) t = vy - edge.margin;
            if (vy + edge.margin > b) b = vy + edge.margin;
          }
        }
      });
      this.captureArea = new ApperRect(Math.round(l), Math.round(t), Math.round(r - l), Math.round(b - t));
    } else this.captureArea = null;
  }

  get captureResizeDirection() {
    if (this.captureArea === null) return null;

    let pos = this.getWorldPos(this.cursorPos);
    let broadArea = new ApperRect(
      this.captureArea.x - this.RESIZE_PROXIMITY,
      this.captureArea.y - this.RESIZE_PROXIMITY,
      this.captureArea.w + 2 * this.RESIZE_PROXIMITY,
      this.captureArea.h + 2 * this.RESIZE_PROXIMITY);

    if (broadArea.contains(pos)) {
      let dw = Math.abs(this.captureArea.x - pos.x);
      let de = Math.abs(this.captureArea.x + this.captureArea.w - pos.x);
      let dn = Math.abs(this.captureArea.y - pos.y);
      let ds = Math.abs(this.captureArea.y + this.captureArea.h - pos.y);
      let west = dw <= this.RESIZE_PROXIMITY && dw < de;
      let east = de <= this.RESIZE_PROXIMITY && de < dw;
      let north = dn <= this.RESIZE_PROXIMITY && dn < ds;
      let south = ds <= this.RESIZE_PROXIMITY && ds < dn;
      if (north) return west ? Direction.NW : east ? Direction.NE : Direction.N;
      if (south) return west ? Direction.SW : east ? Direction.SE : Direction.S;
      if (west) return Direction.W;
      if (east) return Direction.E;
    }

    return this.captureArea.contains(pos) ? Direction.C : null;
  }

  load(url) {
    this.title = "Loading...";

    let trueURL = url.startsWith("examples") ? this.HOST_URL + url : url;
    
    fetch(trueURL)
      .then(response => response.json(), error => {
        console.error(error);
        if (error instanceof TypeError) error = "The graph URL could not be reached.";
        this.showMessage(error, true);
        this.title = this.defaultTitle;
      }).then(data => {
        window.location.hash = url;
        this.loadFromData(data);
      }, error => {
        console.error(error);
        if (error instanceof SyntaxError) error = "The graph at this URL could not be read.";
        this.showMessage(error, true);
        this.title = this.defaultTitle;
      });
  }

  loadFromData(data) {
    this.vertices = [];
    this.edges = [];
    
    data.vertices.forEach(raw => {
      let vertex = new Vertex(raw.x, raw.y);
      if (raw.r !== undefined) vertex.r = raw.r;
      if (raw.fill !== undefined) vertex.fill = raw.fill;
      if (raw.stroke !== undefined) vertex.stroke = raw.stroke;
      if (raw.lineWidth !== undefined) vertex.lineWidth = raw.lineWidth;
      if (raw.lineDash !== undefined) vertex.lineDash = raw.lineDash.slice();
      if (raw.shape !== undefined) vertex.shape = raw.shape;
      this.vertices.push(vertex);
    });
    
    data.edges.forEach(raw => {
      let edge = new Edge(this.vertices[raw.v1], this.vertices[raw.v2]);
      if (raw.cp !== undefined) edge.cp = new ApperPoint(raw.cp[0], raw.cp[1]);
      if (raw.stroke !== undefined) edge.stroke = raw.stroke;
      if (raw.lineWidth !== undefined) edge.lineWidth = raw.lineWidth;
      if (raw.lineDash !== undefined) edge.lineDash = raw.lineDash.slice();
      this.edges.push(edge);
    });
    
    if (data.title !== undefined) this.title = data.title;
    else this.title = this.defaultTitle;
    
    this.update();
  }

  get graphData() {
    let vertices = this.vertices.map(vertex => { return {
      x: vertex.x, y: vertex.y,
      r: vertex.r === 10 ? undefined : vertex.r,
      fill: vertex.fill === "#666" ? undefined : vertex.fill,
      stroke: vertex.stroke === "#ccc" ? undefined : vertex.stroke,
      lineWidth: vertex.lineWidth === 4 ? undefined : vertex.lineWidth,
      lineDash: !vertex.lineDash.length ? undefined : vertex.lineDash.slice(),
      shape: vertex.shape === 0 ? undefined : vertex.shape
    }});

    let edges = this.edges.map(edge => { return {
      v1: this.vertices.indexOf(edge.v1), v2: this.vertices.indexOf(edge.v2),
      cp: edge.cp === null ? undefined : [edge.cp.x, edge.cp.y],
      stroke: edge.stroke === "#666" ? undefined : edge.stroke,
      lineWidth: edge.lineWidth === 4 ? undefined : edge.lineWidth,
      lineDash: !edge.lineDash.length ? undefined : edge.lineDash.slice(),
    }});
    
    let graph = {title: this.title, vertices, edges};
    return JSON.stringify(graph);
  }
  
}
