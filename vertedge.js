class Vertedge extends Apper {

  get dragging() { return this.drag !== null; }
  get grid() { return {x: this.widget.gridWidth.value, y: this.widget.gridHeight.value}; }

  constructor() {
    super();

    this.HOST_URL = "https://raw.githubusercontent.com/xarkenz/vertedge/main/"
    this.CURVE_SAMPLE_INTERVAL = 0.01;
    this.REVERT_PROXIMITY = 8;
    this.RESIZE_PROXIMITY = 12;
    this.REVERT_ANGLE_DIFF = 0.3;

    this.enableToolbar()
      .addTool(Vertedge.Tool.SELECT, true)
      .addTool(Vertedge.Tool.MOVE)
      .addTool(Vertedge.Tool.DRAW)
      .addTool(Vertedge.Tool.ERASE)
      .addTool(Vertedge.Tool.STYLE)
      .addTool(Vertedge.Tool.GRID)
      .addSpacer()
      .addTool(Vertedge.Tool.CAPTURE)
      .addTool(Vertedge.Tool.DATA)
      .addTool(Vertedge.Tool.LOAD)
      .addTool(Vertedge.Tool.HELP);

    this.widget = {};

    let icons = ["icons/shape-circle.svg", "icons/shape-square.svg", "icons/shape-diamond.svg"];
    this.styleMenu = this.addMenu("Element Style")
      .addSeparator()
      .add(this.widget.vertexShape = new Apper.Menu.HSpread("vertedge-vertex-shape", "Shape:", icons)
        .onChange(value => {
          this.selection.forEach(element => {
            if (element instanceof Vertedge.Vertex) element.shape = value;
          });
          this.update();
        }))
      .add(this.widget.vertexRadius = new Apper.Menu.NumberInput("vertedge-vertex-radius", "Radius:", "icons/radius.svg")
        .onChange(value => {
          this.selection.forEach(element => {
            if (element instanceof Vertedge.Vertex) element.r = value;
          });
          this.update();
        }))
      .add(this.widget.lineWidth = new Apper.Menu.NumberInput("vertedge-line-width", "Line width:", "icons/line-width.svg")
        .onChange(value => {
          this.selection.forEach(element => {
            element.lineWidth = value;
          });
          this.update();
        }));

    this.gridMenu = this.addMenu("Grid Settings")
      .addSeparator()
      .add(this.widget.enableGrid = new Apper.Menu.Checkbox("vertedge-enable-grid", "Enable grid")
        .onChange(value => this.update()))
      .add(this.widget.gridWidth = new Apper.Menu.NumberInput("vertedge-grid-width", "Horizontal spacing:", "icons/width.svg", 50)
        .onChange(value => this.update()))
      .add(this.widget.gridHeight = new Apper.Menu.NumberInput("vertedge-grid-height", "Vertical spacing:", "icons/height.svg", 50)
        .onChange(value => this.update()));

    this.captureMenu = this.addMenu("Capture Image")
      .addSeparator()
      .add(this.widget.capturePrompt = new Apper.Menu.Paragraph("To capture a graph image, try adding some elements to the graph."))
      .add(this.widget.captureInstructions = new Apper.Menu.Paragraph("Resize the box to crop the resulting image. To move the view, drag from outside the box.").hide())
      .add(this.widget.captureFitGraph = new Apper.Menu.Button("Fit Entire Graph").hide()
        .onClick(() => this.fitCaptureTo(this.vertices.concat(this.edges))))
      .addSeparator()
      .add(this.widget.captureEmptyPreview = new Apper.Menu.Paragraph("An image preview will appear here."))
      .add(this.widget.capturePreview = new Apper.Menu.CanvasImage("Preview:").hide())
      .add(this.widget.captureDownload = new Apper.Menu.Button("<img src='icons/download.svg'/> Download as PNG").hide());

    this.dataMenu = this.addMenu("Raw Graph Data")
      .addSeparator()
      .add(this.widget.dataEditor = new Apper.Menu.TextEditor("vertedge-data-editor", "Raw JSON data...")
        .onChange(text => {
          if (!text) this.loadFromData({});
          else try {
            this.loadFromData(JSON.parse(text));
            this.widget.dataEditor.valid = true;
          } catch (err) {
            if (!(err instanceof SyntaxError)) console.error(err);
            this.widget.dataEditor.valid = false;
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

    this.loadMenu = this.addMenu("Load a Graph")
      .addSeparator()
      .add(new Apper.Menu.ButtonList("Example Graphs:", this.exampleURLs, this.exampleTitles)
        .onChange(url => {
          this.update();
          this.load(url);
          this.tool = this.toolbar.defaultTool;
        }));

    this.helpModal = this.addModal("Vertedge Help")
      .addSeparator()
      .add(new Apper.Menu.Paragraph("Hi! I'm a former AMR student, so I hope you'll understand that this is still a work in progress."))
      .add(new Apper.Menu.Paragraph("If you still need help beyond this page, you can email me at <a href='mailto:seanedwardsclarke@gmail.com' target='_blank' rel='noopener noreferrer'>seanedwardsclarke@gmail.com</a>."))
      .add(new Apper.Menu.Paragraph("Please note that the only way to save graphs right now is to save the data using the <b>View Data</b> menu, or an image using the <b>Capture</b> tool. See the section below for more information on how to use these."))
      .add(new Apper.Menu.Paragraph("Found a bug or issue? You can report it on <a href='https://github.com/xarkenz/vertedge/issues' target='_blank' rel='noopener noreferrer'>the GitHub page</a> or in an email to the address above. Thanks for your help!"))
      .addSeparator()
      .add(new Apper.Menu.Paragraph("- You can center the view on the graph by pressing the <b>Period</b> key.<br>- Holding <b>Shift</b> while clicking on objects adds them to the current selection.<br>- While dragging in <b>Draw</b> mode to draw an edge, holding the <b>Control</b> key allows you to create a loop."))
      .addSeparator()
      .add(new Apper.Menu.Paragraph("<img style='float:left' src='icons/select.svg'/><b>Select</b> (v)<br><br>This is the default tool. Click on vertices and edges to select them, and drag them to move them around. If you drag an edge, it will become a curve which you can adjust to your needs. To select multiple elements at once, drag from empty space to select a region or hold <b>Shift</b> when clicking on elements."))
      .add(new Apper.Menu.Paragraph("<img style='float:left' src='icons/move.svg'/><b>Move</b> (m)<br><br>This tool allows you to move the entire view by dragging. This can be especially helpful if you find yourself running out of room on the screen."))
      .add(new Apper.Menu.Paragraph("<img style='float:left' src='icons/draw.svg'/><b>Draw</b> (d)<br><br>This tool allows you to create new edges and vertices simply by clicking and dragging. You can even split edges by clicking on them."))
      .add(new Apper.Menu.Paragraph("<img style='float:left' src='icons/erase.svg'/><b>Erase</b> (x)<br><br>Use this tool to remove vertices and edges from the graph. You can also use the <b>Delete</b> key to remove the selection in any mode."))
      .add(new Apper.Menu.Paragraph("<img style='float:left' src='icons/style.svg'/><b>Style</b> (s)<br><br>This tool allows you to modify the appearance of selected elements through a menu."))
      .add(new Apper.Menu.Paragraph("<img style='float:left' src='icons/grid.svg'/><b>Grid</b> (g)<br><br>The grid can be enabled/disabled and tweaked through this menu if you want to make your graph more orderly."))
      .add(new Apper.Menu.Paragraph("<img style='float:left' src='icons/capture.svg'/><b>Capture</b><br><br>This tool allows you to download a PNG image of a region of your graph. The background is transparent, so paste wherever you need!"))
      .add(new Apper.Menu.Paragraph("<img style='float:left' src='icons/data.svg'/><b>View Data</b><br><br>This menu contains the raw JSON data for the graph. If you want to save your graph, this would be the way to do it: copy the raw data and paste it somewhere else for safekeeping, then paste it back into this menu to load the graph again."))
      .add(new Apper.Menu.Paragraph("<img style='float:left' src='icons/load.svg'/><b>Load</b><br><br>This menu contains options for loading graphs. It's a major work in progress, so all it has now is a few examples."))
      .add(new Apper.Menu.Paragraph("<img style='float:left' src='icons/help.svg'/><b>Help</b> (h)<br><br>You are here. Congratulations!"));

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
    if (!this.toolbar) return;

    const element = this.tool === Vertedge.Tool.MOVE || this.tool === Vertedge.Tool.CAPTURE ? null : this.elementAt(this.cursorPos);
    this.color = this.tool === Vertedge.Tool.DRAW ? Vertedge.Color.GREEN
               : this.tool === Vertedge.Tool.ERASE ? Vertedge.Color.RED
               : Vertedge.Color.PURPLE;
    const captureResizeDirection = this.captureResizeDirection();

    if (this.tool !== Vertedge.Tool.DRAW) this.firstVertex = null;
    if (this.tool !== Vertedge.Tool.CAPTURE) this.captureArea = null;

    if (this.tool === Vertedge.Tool.STYLE && this.selection.length) {
      if (this.selection.some(element => element instanceof Vertedge.Vertex)) {
        this.widget.vertexShape.element.style.display = "";
        this.widget.vertexRadius.element.style.display = "";

        let shape = null;
        for (let element of this.selection) {
          if (element instanceof Vertedge.Vertex)
            if (shape === null) shape = element.shape;
            else if (element.shape !== shape) {
              shape = null;
              break;
            }
        }
        this.widget.vertexShape.value = shape;

        let radius = null;
        for (let element of this.selection) {
          if (element instanceof Vertedge.Vertex)
            if (radius === null) radius = element.r;
            else if (element.r !== radius) {
              radius = null;
              break;
            }
        }
        this.widget.vertexRadius.value = radius ?? 10;
      } else {
        this.widget.vertexShape.element.style.display = "none";
        this.widget.vertexRadius.element.style.display = "none";
      }

      let lineWidth = null;
      for (let element of this.selection) {
        if (lineWidth === null) lineWidth = element.lineWidth;
        else if (element.lineWidth !== lineWidth) {
          lineWidth = null;
          break;
        }
      }
      this.widget.lineWidth.value = lineWidth ?? 4;

      this.styleMenu.show();
    } else this.styleMenu.hide();

    if (this.tool === Vertedge.Tool.GRID) this.gridMenu.show();
    else this.gridMenu.hide();

    if (this.tool === Vertedge.Tool.CAPTURE) {
      if (this.captureArea === null) this.fitCaptureTo(this.selection.length ? this.selection : this.vertices.concat(this.edges), false);
      if (this.captureArea === null) {
        this.widget.captureInstructions.hide();
        this.widget.capturePreview.hide();
        this.widget.captureFitGraph.hide();
        this.widget.captureDownload.hide();
        this.widget.capturePrompt.show();
        this.widget.captureEmptyPreview.show();

        this.widget.captureDownload.url = "";
        this.widget.captureDownload.filename = "";
      } else {
        this.widget.capturePrompt.hide();
        this.widget.captureEmptyPreview.hide();
        this.widget.captureInstructions.show();
        this.widget.capturePreview.show();
        this.widget.captureFitGraph.show();
        this.widget.captureDownload.show();

        this.widget.capturePreview.label = `Preview (${this.captureArea.w} \u00d7 ${this.captureArea.h}):`
        this.widget.capturePreview.resize(this.captureArea.w, this.captureArea.h);
        this.widget.capturePreview.ctx.resetTransform();
        this.widget.capturePreview.ctx.clearRect(0, 0, this.widget.capturePreview.canvas.width, this.widget.capturePreview.canvas.height);
        this.widget.capturePreview.ctx.translate(-this.captureArea.x, -this.captureArea.y);
        this.widget.capturePreview.ctx.lineCap = "round";
        this.widget.capturePreview.ctx.lineJoin = "round";

        this.edges.forEach(edge => {
          edge.draw(this.widget.capturePreview.ctx, false, false, this.color);
        });
        this.vertices.forEach(vertex => {
          vertex.draw(this.widget.capturePreview.ctx, false, false, this.color);
        });

        this.widget.captureDownload.url = this.widget.capturePreview.canvas.toDataURL("image/png");
        this.widget.captureDownload.filename = `${this.title}.png`;
      }

      this.captureMenu.show();
    } else this.captureMenu.hide();

    if (this.tool === Vertedge.Tool.DATA) {
      if (!this.widget.dataEditor.editing) {
        this.widget.dataEditor.text = this.graphData;
        this.widget.dataEditor.valid = true;
      }

      this.dataMenu.show();
    } else this.dataMenu.hide();

    if (this.tool === Vertedge.Tool.LOAD) this.loadMenu.show();
    else this.loadMenu.hide();

    if (this.tool === Vertedge.Tool.HELP) this.helpModal.show();
    else this.helpModal.hide();

    // Set cursor appearance
    if (this.tool === Vertedge.Tool.MOVE) {
      this.element.style.cursor = this.dragging ? "grabbing" : "";
      this.canvas.style.cursor = this.dragging ? "" : "grab";
    } else if (this.tool === Vertedge.Tool.CAPTURE) {
      let cursor = "";
      switch (this.drag?.captureResizeDirection ?? captureResizeDirection) {
        case Vertedge.Direction.N: cursor = "n-resize"; break;
        case Vertedge.Direction.E: cursor = "e-resize"; break;
        case Vertedge.Direction.S: cursor = "s-resize"; break;
        case Vertedge.Direction.W: cursor = "w-resize"; break;
        case Vertedge.Direction.NW: cursor = "nw-resize"; break;
        case Vertedge.Direction.NE: cursor = "ne-resize"; break;
        case Vertedge.Direction.SE: cursor = "se-resize"; break;
        case Vertedge.Direction.SW: cursor = "sw-resize"; break;
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

    // Grid
    if (this.widget.enableGrid.checked) {
      let grid = this.grid;
      let topLeft = this.getWorldPos(new Apper.Vector2());
      let bottomRight = this.getWorldPos(new Apper.Vector2(this.canvas.width, this.canvas.height));

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

    // Original element position indicators
    if (this.dragging && this.drag.elements.length) {
      for (let element of this.drag.elements) {
        element.draw(this.ctx, false, false, this.color);
        if (element instanceof Vertedge.Edge && element.cp !== null) {
          this.ctx.strokeStyle = `#${this.color}77`;
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([]);
          this.ctx.beginPath();
          this.ctx.ellipse(element.cp.x, element.cp.y, 3, 3, 0, 0, 2 * Math.PI);
          this.ctx.stroke();
        }
      }
    }

    // Edges, then vertices (last index appears on top, vertices always in front of edges)
    this.edges.forEach(edge => {
      edge.draw(this.ctx, !this.dragging && element === edge, this.selection.includes(edge), this.color);
    });
    this.vertices.forEach(vertex => {
      vertex.draw(this.ctx, !this.dragging && element === vertex, this.selection.includes(vertex), this.color);
    });

    // Drawing indicators
    if (this.tool === Vertedge.Tool.DRAW && !this.cursorPos.equals(0, 0)) {
      let worldPos = this.snapToGrid(this.getWorldPos(this.cursorPos));
      if (this.firstVertex !== null) {
        this.ctx.strokeStyle = `#${this.color}aa`;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        if (this.ctrlKey) {
          // Creating loop
          let radius = 0.5 * Math.hypot(worldPos.x - this.firstVertex.x, worldPos.y - this.firstVertex.y);
          this.ctx.ellipse(0.5 * (worldPos.x + this.firstVertex.x), 0.5 * (worldPos.y + this.firstVertex.y), radius, radius, 0, 0, 2 * Math.PI);
        } else {
          // Creating edge
          this.ctx.moveTo(this.firstVertex.x, this.firstVertex.y);
          if (element instanceof Vertedge.Vertex) this.ctx.lineTo(element.x, element.y);
          else this.ctx.lineTo(worldPos.x, worldPos.y);
        }
        this.ctx.stroke();
      }
      // Cursor dot
      if ((element == null || element instanceof Vertedge.Edge) && !this.ctrlKey) {
        this.ctx.fillStyle = `#${this.color}aa`;
        this.ctx.beginPath();
        this.ctx.ellipse(worldPos.x, worldPos.y, 5, 5, 0, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    }

    // Selection box
    if (this.tool !== Vertedge.Tool.MOVE && this.tool !== Vertedge.Tool.DRAW && this.tool !== Vertedge.Tool.CAPTURE && this.dragging && !this.drag.elements.length && !this.cursorPos.equals(0, 0)) {
      let start = this.getWorldPos(new Apper.Vector2(this.drag.x, this.drag.y));
      let end = this.getWorldPos(this.cursorPos);
      this.ctx.strokeStyle = `#${this.color}77`;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      // Below differs from ctx.rect() because it locks the line dash at the start and end corners, which looks nicer
      this.ctx.beginPath();
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

    // Capture box
    if (this.tool === Vertedge.Tool.CAPTURE && this.captureArea !== null) {
      this.ctx.fillStyle = `#${Vertedge.Color.ORANGE}33`;
      this.ctx.strokeStyle = `#${Vertedge.Color.ORANGE}aa`;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([]);
      this.ctx.beginPath();
      this.ctx.rect(this.captureArea.x, this.captureArea.y, this.captureArea.w, this.captureArea.h);
      this.ctx.fill();
      // Resize handles
      this.ctx.rect(this.captureArea.x - 6, this.captureArea.y - 6, 12, 12);
      this.ctx.rect(this.captureArea.xw - 6, this.captureArea.y - 6, 12, 12);
      this.ctx.rect(this.captureArea.xw - 6, this.captureArea.yh - 6, 12, 12);
      this.ctx.rect(this.captureArea.x - 6, this.captureArea.yh - 6, 12, 12);
      let midX = Math.round(0.5 * (this.captureArea.x + this.captureArea.xw));
      let midY = Math.round(0.5 * (this.captureArea.y + this.captureArea.yh));
      if (this.captureArea.w > 2 * this.RESIZE_PROXIMITY) {
        this.ctx.rect(midX - 6, this.captureArea.y - 6, 12, 12);
        this.ctx.rect(midX - 6, this.captureArea.yh - 6, 12, 12);
      }
      if (this.captureArea.h > 2 * this.RESIZE_PROXIMITY) {
        this.ctx.rect(this.captureArea.xw - 6, midY - 6, 12, 12);
        this.ctx.rect(this.captureArea.x - 6, midY - 6, 12, 12);
      }
      this.ctx.stroke();
      // Indicator for hovering over a resize portion
      if (this.drag?.captureResizeDirection ?? captureResizeDirection != null) {
        this.ctx.fillStyle = this.drag?.captureResizeDirection != null ? `#${Vertedge.Color.ORANGE}aa` : `#${Vertedge.Color.ORANGE}77`;
        this.ctx.beginPath();
        switch (this.drag?.captureResizeDirection ?? captureResizeDirection) {
          case Vertedge.Direction.N: this.ctx.rect(midX - 6, this.captureArea.y - 6, 12, 12); break;
          case Vertedge.Direction.E: this.ctx.rect(this.captureArea.xw - 6, midY - 6, 12, 12); break;
          case Vertedge.Direction.S: this.ctx.rect(midX - 6, this.captureArea.yh - 6, 12, 12); break;
          case Vertedge.Direction.W: this.ctx.rect(this.captureArea.x - 6, midY - 6, 12, 12); break;
          case Vertedge.Direction.NW: this.ctx.rect(this.captureArea.x - 6, this.captureArea.y - 6, 12, 12); break;
          case Vertedge.Direction.NE: this.ctx.rect(this.captureArea.xw - 6, this.captureArea.y - 6, 12, 12); break;
          case Vertedge.Direction.SE: this.ctx.rect(this.captureArea.xw - 6, this.captureArea.yh - 6, 12, 12); break;
          case Vertedge.Direction.SW: this.ctx.rect(this.captureArea.x - 6, this.captureArea.yh - 6, 12, 12); break;
          default: break;
        }
        this.ctx.fill();
      }
    }
  }

  mouseDown(event) {
    if (event.button === 0) {
      const canSelect = this.tool !== Vertedge.Tool.MOVE && this.tool !== Vertedge.Tool.CAPTURE;
      let p = this.snapToGrid(event.worldPos);
      let element = canSelect ? this.elementAt(event.screenPos) : null;

      if (this.tool === Vertedge.Tool.DRAW) {
        if (element instanceof Vertedge.Vertex) {
          if (this.firstVertex !== null) {
            this.edges.push(new Vertedge.Edge(this.firstVertex, element));
          } else {
            this.firstVertex = element;
          }
        } else if (element instanceof Vertedge.Edge && !element.isLoop) {
          let placed = new Vertedge.Vertex(p.x, p.y);
          this.vertices.push(placed);
          let other = new Vertedge.Edge(placed, element.v2);
          if (element.cp !== null) {
            let p0 = new Apper.Vector2(element.v1);
            let p1 = new Apper.Vector2(element.v2);
            let cp = element.cp.copy();
            let tc = 0;
            let closest = Infinity;
            let lastTest = Infinity;
            for (let t = 0; t <= 1; t += this.CURVE_SAMPLE_INTERVAL) {
              let sample = Vertedge.curveQ(t, p0, cp, p1);
              let delta = Vertedge.curveQDelta(t, p0, cp, p1);
              // To find the minimum distance, the only part of the derivative of distance we need is the roots, so 'test' serves that purpose only
              let test = (sample.x - p.x) * delta.x + (sample.y - p.y) * delta.y;
              if (t === 0 || t === 1 || lastTest <= 0 && test >= 0) {
                let dist = Math.hypot(p.x - sample.x, p.y - sample.y);
                if (dist < closest) {
                  closest = dist;
                  tc = t;
                }
              }
              lastTest = test;
            }
            let closestPos = Vertedge.curveQ(tc, p0, cp, p1);
            placed.x = closestPos.x;
            placed.y = closestPos.y;
            element.cp.set(tc*cp.x + (1-tc)*p0.x, tc*cp.y + (1-tc)*p0.y);
            other.cp = new Apper.Vector2(tc*p1.x + (1-tc)*cp.x, tc*p1.y + (1-tc)*cp.y);
          }
          element.v2 = placed;
          this.edges.push(other);
          element = placed;
          if (this.firstVertex !== null) {
            this.edges.push(new Vertedge.Edge(this.firstVertex, placed));
            this.firstVertex = null;
          }
        } else {
          let placed = new Vertedge.Vertex(p.x, p.y);
          this.vertices.push(placed);
          element = placed;
          if (this.firstVertex !== null && this.firstVertex !== element) {
            this.edges.push(new Vertedge.Edge(this.firstVertex, placed));
            this.firstVertex = null;
          } else {
            this.firstVertex = element;
          }
        }
      } else if (this.tool === Vertedge.Tool.ERASE) {
        if (element !== null) {
          if (!this.selection.includes(element)) this.selection = [element];
          this.deleteSelection();
          element = null;
        }
      }

      if (element === null) {
        if (canSelect && !event.shiftKey) this.selection = [];
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
        let orig = item.copy();
        if (orig.fill !== undefined) orig.fill = "transparent";
        orig.stroke = `#${this.color}77`;
        orig.lineWidth = 2;
        orig.lineDash = [4, 4];
        return orig;
      });
      let indices = event.shiftKey ? [] : this.selection.map(item => item instanceof Vertedge.Vertex ? this.vertices.indexOf(item) : this.edges.indexOf(item));

      this.drag = {
        x: event.screenPos.x,
        y: event.screenPos.y,
        transform: this.transform,
        elements, indices,
        captureArea: this.captureArea,
        captureResizeDirection: this.tool === Vertedge.Tool.CAPTURE ? this.captureResizeDirection() : null
      };

      if (elements.length === 1 && elements[0] instanceof Vertedge.Edge && elements[0].cp === null) {
        this.drag.elements[0].cp = p.copy();
      }
    }

    return true;
  }

  mouseMove(event) {
    if (event.screenPos.equals(0, 0)) return false;
    if (!this.dragging) return true;
    if (!event.leftBtn) {
      this.drag = null;
      return true;
    }

    const canSelect = this.tool !== Vertedge.Tool.MOVE && this.tool !== Vertedge.Tool.CAPTURE;
    let revertX = Math.abs(event.screenPos.x - this.drag.x) <= this.REVERT_PROXIMITY * this.scale,
        revertY = Math.abs(event.screenPos.y - this.drag.y) <= this.REVERT_PROXIMITY * this.scale,
        revert = revertX && revertY,
        dx = (event.screenPos.x - this.drag.x) / this.scale,
        dy = (event.screenPos.y - this.drag.y) / this.scale;

    if (!canSelect && this.drag.captureResizeDirection === null) {
      this.transform = revert ? this.drag.transform.translate(0, 0) : this.drag.transform.translate(dx, dy);

    } else if (this.tool === Vertedge.Tool.CAPTURE) {
      let l = this.drag.captureArea.x, r = this.drag.captureArea.xw, t = this.drag.captureArea.y, b = this.drag.captureArea.yh;
      if (!revertY) {
        if (this.drag.captureResizeDirection & Vertedge.Direction.N) t += dy;
        if (this.drag.captureResizeDirection & Vertedge.Direction.S) b += dy;
      }
      if (!revertX) {
        if (this.drag.captureResizeDirection & Vertedge.Direction.E) r += dx;
        if (this.drag.captureResizeDirection & Vertedge.Direction.W) l += dx;
      }
      if (t > b) {
        this.drag.captureResizeDirection ^= Vertedge.Direction.N | Vertedge.Direction.S;
        this.drag.captureArea.y = this.drag.captureArea.yh;
        this.drag.captureArea.h = -this.drag.captureArea.h;
      }
      if (l > r) {
        this.drag.captureResizeDirection ^= Vertedge.Direction.E | Vertedge.Direction.W;
        this.drag.captureArea.x = this.drag.captureArea.xw;
        this.drag.captureArea.w = -this.drag.captureArea.w;
      }
      this.captureArea = new Apper.Rect(Math.min(l, r), Math.min(t, b), Math.abs(r - l), Math.abs(b - t));

    } else for (let i = 0; i < this.drag.elements.length; i++) {
      let element = this.drag.elements[i];
      let index = this.drag.indices[i];

      if (element instanceof Vertedge.Vertex) {
        let vertex = this.vertices[index];
        let p = revert ? new Apper.Vector2(element) : this.snapToGrid(new Apper.Vector2(element).add(dx, dy));
        if (this.tool !== Vertedge.Tool.DRAW || this.firstVertex === null) {
          vertex.x = p.x;
          vertex.y = p.y;
        }

      } else if (element instanceof Vertedge.Edge) {
        let edge = this.edges[index];
        if (this.drag.elements.length === 1) {
          if (!edge.cp) edge.cp = new Apper.Vector2();
          edge.cp.set(revert ? element.cp : this.snapToGrid(element.cp.add(dx, dy)));

          if (!edge.isLoop) {
            const v1 = edge.v1, v2 = edge.v2, cp = edge.cp;
            const angleDiff = Math.acos(((cp.x - v1.x) * (v2.x - cp.x) + (cp.y - v1.y) * (v2.y - cp.y)) / (Math.hypot(cp.x - v1.x, cp.y - v1.y) * Math.hypot(v2.x - cp.x, v2.y - cp.y)));
            if (angleDiff < this.REVERT_ANGLE_DIFF) edge.cp = null;
          }
        } else if (edge.cp !== null && element.cp !== null) {
          edge.cp.set(revert ? element.cp : this.snapToGrid(element.cp.add(dx, dy)));
        }
      }
    }

    return true;
  }

  mouseUp(event) {
    if (event.button === 0 && this.drag !== null) {
      let element = this.tool === Vertedge.Tool.MOVE ? null : this.elementAt(this.cursorPos);

      if (this.tool === Vertedge.Tool.DRAW) {
        if (this.firstVertex !== null && this.firstVertex !== element) {
          if (event.ctrlKey) {
            let loop = new Vertedge.Edge(this.firstVertex, this.firstVertex);
            loop.cp = this.snapToGrid(this.getWorldPos(this.cursorPos));
            this.edges.push(loop);
            this.selection = [loop];
          } else {
            if (element instanceof Vertedge.Vertex) {
              this.edges.push(new Vertedge.Edge(this.firstVertex, element));
              this.selection = [element];
            } else {
              let worldPos = this.snapToGrid(this.getWorldPos(this.cursorPos));
              let placed = new Vertedge.Vertex(worldPos.x, worldPos.y);
              this.vertices.push(placed);
              this.edges.push(new Vertedge.Edge(this.firstVertex, placed));
              this.selection = [placed];
            }
          }
        }
        this.firstVertex = null;

      } else if (this.tool === Vertedge.Tool.CAPTURE) {
        this.captureArea = this.captureArea.normalized();
        if (this.captureArea.w < 1) {
          this.captureArea.w = 1;
          if (this.drag.captureResizeDirection & Vertedge.Direction.W) this.captureArea.x -= 1;
        }
        if (this.captureArea.h < 1) {
          this.captureArea.h = 1;
          if (this.drag.captureResizeDirection & Vertedge.Direction.N) this.captureArea.y -= 1;
        }

      } else if (this.tool !== Vertedge.Tool.MOVE && !this.drag.elements.length) {
        if (!event.shiftKey) this.selection = [];
        let selectBox = new Apper.Rect(this.drag.x, this.drag.y, this.cursorPos.x - this.drag.x, this.cursorPos.y - this.drag.y).transform(this.transform.inverse()).normalized();
        if (selectBox.area) this.vertices.filter(vertex => {
          return selectBox.intersects(new Apper.Rect(vertex.x - vertex.r, vertex.y - vertex.r, 2 * vertex.r, 2 * vertex.r));  // FIXME: doesn't account for shape
        }).concat(this.edges.filter(edge => {
          if (selectBox.contains(edge.v1) || selectBox.contains(edge.v2)) return true;
          if (edge.cp === null) {
            return Vertedge.linesIntersect(edge.v1, edge.v2, selectBox.xy, selectBox.xwy)
                || Vertedge.linesIntersect(edge.v1, edge.v2, selectBox.xwy, selectBox.xwyh)
                || Vertedge.linesIntersect(edge.v1, edge.v2, selectBox.xwyh, selectBox.xyh)
                || Vertedge.linesIntersect(edge.v1, edge.v2, selectBox.xyh, selectBox.xy);
          } else if (edge.isLoop) {
            let center = edge.cp.add(edge.v1).mul(0.5),
                radius = 0.5 * Math.hypot(edge.cp.x - edge.v1.x, edge.cp.y - edge.v1.y);
            if (center.x + radius < selectBox.x || selectBox.xw < center.x - radius || center.y + radius < selectBox.y || selectBox.yh < center.y - radius)
              return false;
            if (selectBox.x <= center.x && center.x <= selectBox.xw && selectBox.y <= center.y && center.y <= selectBox.yh)
              return true;
            let distX = Math.abs(center.x - selectBox.cx) - 0.5 * selectBox.w,
                distY = Math.abs(center.y - selectBox.cy) - 0.5 * selectBox.h;
            return distX * distX + distY * distY <= radius * radius;
          } else {
            let l = Math.min(edge.v1.x, edge.cp.x, edge.v2.x),
                r = Math.max(edge.v1.x, edge.cp.x, edge.v2.x),
                t = Math.min(edge.v1.y, edge.cp.y, edge.v2.y),
                b = Math.max(edge.v1.y, edge.cp.y, edge.v2.y);
            if (!selectBox.intersects(new Apper.Rect(l, t, r - l, b - t))) return false;
            let v1 = new Apper.Vector2(edge.v1);
            let v2 = new Apper.Vector2(edge.v2);
            for (let time = 0; time <= 1; time += this.CURVE_SAMPLE_INTERVAL) {
              if (selectBox.contains(Vertedge.curveQ(time, v1, edge.cp, v2))) return true;
            }
            return false;
          }
        })).forEach(selected => {
          if (!this.selection.includes(selected)) this.selection.push(selected);
        });

        if (this.tool === Vertedge.Tool.ERASE) this.deleteSelection();
      }

      this.drag = null;
      return true;
    }
  }

  keyDown(event) {
    switch (event.key) {
      case "keyv": this.tool = Vertedge.Tool.SELECT; break;
      case "keym": this.tool = Vertedge.Tool.MOVE; break;
      case "keyd": this.tool = Vertedge.Tool.DRAW; break;
      case "keyx": this.tool = Vertedge.Tool.ERASE; break;
      case "keys": this.tool = Vertedge.Tool.STYLE; break;
      case "keyg": this.tool = Vertedge.Tool.GRID; break;
      case "keyh": this.tool = Vertedge.Tool.HELP; break;
      case "escape":
        this.firstVertex = null;
        break;
      case "backspace":
      case "delete":
        return this.deleteSelection();
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
    if (this.widget.enableGrid.checked)
      return new Apper.Vector2(Math.round(pos.x / this.grid.x) * this.grid.x, Math.round(pos.y / this.grid.y) * this.grid.y);
    else return pos;
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
    if (!this.selection.length) return false;

    this.selection.forEach(selected => {
      if (selected instanceof Vertedge.Vertex) {
        this.vertices.splice(this.vertices.indexOf(selected), 1);
        this.edges = this.edges.filter(edge => edge.v1 !== selected && edge.v2 !== selected);
      } else if (this.edges.includes(selected)) this.edges.splice(this.edges.indexOf(selected), 1);
    });
    this.selection = [];

    return true;
  }

  centerView() {
    let oldCenter = this.getWorldPos(new Apper.Vector2(this.canvas.width, this.canvas.height).mul(0.5));
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

  fitCaptureTo(elements, refresh = true) {
    if (elements.length) {
      elements = elements.slice();
      elements.slice().forEach(element => {
        if (element instanceof Vertedge.Edge) {
          if (!elements.includes(element.v1)) elements.push(element.v1);
          if (!elements.includes(element.v2)) elements.push(element.v2);
        }
      });
      let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
      elements.forEach(element => {
        if (element instanceof Vertedge.Vertex) {
          if (element.x - element.margin < l) l = element.x - element.margin;
          if (element.x + element.margin > r) r = element.x + element.margin;
          if (element.y - element.margin < t) t = element.y - element.margin;
          if (element.y + element.margin > b) b = element.y + element.margin;
        } else if (element instanceof Vertedge.Edge && element.cp !== null) {
          if (element.isLoop) {
            let center = element.cp.add(element.v1).mul(0.5),
                radius = 0.5 * Math.hypot(element.cp.x - element.v1.x, element.cp.y - element.v1.y);
            if (center.x - radius - element.margin < l) l = center.x - radius - element.margin;
            if (center.x + radius + element.margin > r) r = center.x + radius + element.margin;
            if (center.y - radius - element.margin < t) t = center.y - radius - element.margin;
            if (center.y + radius + element.margin > b) b = center.y + radius + element.margin;
          } else {
            if (element.cp.x < element.v1.x && element.cp.x < element.v2.x || element.cp.x > element.v1.x && element.cp.x > element.v2.x) {
              let vx = Vertedge.curveQVertX(element.v1, element.cp, element.v2);
              if (vx - element.margin < l) l = vx - element.margin;
              if (vx + element.margin > r) r = vx + element.margin;
            }
            if (element.cp.y < element.v1.y && element.cp.y < element.v2.y || element.cp.y > element.v1.y && element.cp.y > element.v2.y) {
              let vy = Vertedge.curveQVertY(element.v1, element.cp, element.v2);
              if (vy - element.margin < t) t = vy - element.margin;
              if (vy + element.margin > b) b = vy + element.margin;
            }
          }
        }
      });
      this.captureArea = new Apper.Rect(Math.round(l), Math.round(t), Math.round(r - l), Math.round(b - t));
    } else this.captureArea = null;
    
    if (refresh) this.update();
  }

  captureResizeDirection() {
    if (this.captureArea === null) return null;

    let pos = this.getWorldPos(this.cursorPos);
    let broadArea = new Apper.Rect(
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
      if (north) return west ? Vertedge.Direction.NW : east ? Vertedge.Direction.NE : Vertedge.Direction.N;
      if (south) return west ? Vertedge.Direction.SW : east ? Vertedge.Direction.SE : Vertedge.Direction.S;
      if (west) return Vertedge.Direction.W;
      if (east) return Vertedge.Direction.E;
    }

    return this.captureArea.contains(pos) ? Vertedge.Direction.C : null;
  }

  load(url) {
    this.title = "Loading...";

    let trueURL = url.startsWith("examples") ? this.HOST_URL + url : url;

    fetch(trueURL)
      .then(response => response.json(), error => {
        console.error(error);
        if (error instanceof TypeError) error = "The graph URL could not be reached.";
        this.showError(error);
        this.title = this.defaultTitle;
      }).then(data => {
        window.location.hash = url;
        this.loadFromData(data, true);
      }, error => {
        console.error(error);
        if (error instanceof SyntaxError) error = "The graph at this URL could not be read.";
        this.showError(error);
        this.title = this.defaultTitle;
      });
  }

  loadFromData(data, reset = false) {
    this.vertices = [];
    this.edges = [];

    data.vertices.forEach(raw => {
      let vertex = new Vertedge.Vertex(raw.x, raw.y);
      if (raw.r !== undefined) vertex.r = raw.r;
      if (raw.fill !== undefined) vertex.fill = raw.fill;
      if (raw.stroke !== undefined) vertex.stroke = raw.stroke;
      if (raw.lineWidth !== undefined) vertex.lineWidth = raw.lineWidth;
      if (raw.lineDash !== undefined) vertex.lineDash = raw.lineDash.slice();
      if (raw.shape !== undefined) vertex.shape = raw.shape;
      this.vertices.push(vertex);
    });

    data.edges.forEach(raw => {
      let edge = new Vertedge.Edge(this.vertices[raw.v1], this.vertices[raw.v2]);
      if (raw.cp !== undefined) edge.cp = new Apper.Vector2(raw.cp[0], raw.cp[1]);
      if (raw.stroke !== undefined) edge.stroke = raw.stroke;
      if (raw.lineWidth !== undefined) edge.lineWidth = raw.lineWidth;
      if (raw.lineDash !== undefined) edge.lineDash = raw.lineDash.slice();
      this.edges.push(edge);
    });

    if (data.title !== undefined) this.title = data.title;
    else this.title = this.defaultTitle;

    if (reset) this.centerView();
    else this.update();
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
    }; });

    let edges = this.edges.map(edge => { return {
      v1: this.vertices.indexOf(edge.v1), v2: this.vertices.indexOf(edge.v2),
      cp: edge.cp === null ? undefined : [edge.cp.x, edge.cp.y],
      stroke: edge.stroke === "#666" ? undefined : edge.stroke,
      lineWidth: edge.lineWidth === 4 ? undefined : edge.lineWidth,
      lineDash: !edge.lineDash.length ? undefined : edge.lineDash.slice(),
    }; });

    return JSON.stringify({title: this.title, vertices, edges});
  }

}


// Position at t (quadratic beziér): t²r + 2t(1-t)q + (1-t)²p
Vertedge.curveQ = (t, p, q, r) => r.mul(t*t).add(q.mul(2*t*(1-t))).add(p.mul((1-t)*(1-t)));
// Velocity at t (quadratic beziér): 2tr + (2(1-t)-2t)q - 2(1-t)p
Vertedge.curveQDelta = (t, p, q, r) => r.mul(2*t).add(q.mul(2*(1-t)-2*t)).sub(p.mul(2*(1-t)));
Vertedge.curveQVertX = (p, q, r) => p.x - 2*q.x + r.x === 0 ? null : (-q.x*q.x + 2*q.x*r.x - r.x*r.x) / (p.x - 2*q.x + r.x) + r.x;
Vertedge.curveQVertY = (p, q, r) => p.y - 2*q.y + r.y === 0 ? null : (-q.y*q.y + 2*q.y*r.y - r.y*r.y) / (p.y - 2*q.y + r.y) + r.y;

Vertedge.linesIntersect = (p1, q1, p2, q2) =>
  Vertedge.linesIntersect.orient(p1, q1, p2) != Vertedge.linesIntersect.orient(p1, q1, q2)
  && Vertedge.linesIntersect.orient(p2, q2, p1) != Vertedge.linesIntersect.orient(p2, q2, q1);
Vertedge.linesIntersect.orient = (p1, p2, p3) => Math.sign((p2.y-p1.y)*(p3.x-p2.x) - (p2.x-p1.x)*(p3.y-p2.y));


Vertedge.Tool = {
  SELECT:  new Apper.Tool("select",  "Select",    "icons/select.svg",  "keyv", "v"),
  MOVE:    new Apper.Tool("move",    "Move",      "icons/move.svg",    "keym", "m"),
  DRAW:    new Apper.Tool("draw",    "Draw",      "icons/draw.svg",    "keyd", "d"),
  ERASE:   new Apper.Tool("erase",   "Erase",     "icons/erase.svg",   "keyx", "x"),
  STYLE:   new Apper.Tool("style",   "Style",     "icons/style.svg",   "keys", "s"),
  GRID:    new Apper.Tool("grid",    "Grid",      "icons/grid.svg",    "keyg", "g"),
  CAPTURE: new Apper.Tool("capture", "Capture",   "icons/capture.svg"),
  DATA:    new Apper.Tool("data",    "View Data", "icons/data.svg"),
  LOAD:    new Apper.Tool("load",    "Load",      "icons/load.svg"),
  HELP:    new Apper.Tool("help",    "Help",      "icons/help.svg",    "keyh", "h"),
};

Vertedge.Direction = {
  C:  0x1111,
  N:  0x0001, E:  0x0010, S:  0x0100, W:  0x1000,
  NE: 0x1010, NW: 0x1001, SE: 0x0110, SW: 0x1100,
};

Vertedge.Shape = {
  CIRCLE:  0,
  SQUARE:  1,
  DIAMOND: 2,
};

Vertedge.Color = {
  PURPLE: "b762f0",
  GREEN:  "23a54c",
  RED:    "e84b33",
  ORANGE: "ff9421",
  BLUE: "39a0fa",
  BLUE_TINT: "43bdff",
};


Vertedge.Vertex = class {

  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 10;
    this.fill = "#666";
    this.stroke = "#ccc";
    this.lineWidth = 4;
    this.lineDash = [];
    this.shape = Vertedge.Shape.CIRCLE;
  }

  path(ctx) {
    ctx.beginPath();
    switch (this.shape) {
      case Vertedge.Shape.CIRCLE:
      default:
        ctx.ellipse(this.x, this.y, this.r, this.r, 0, 0, 2 * Math.PI);
        break;
      case Vertedge.Shape.SQUARE:
        ctx.rect(this.x - this.r, this.y - this.r, 2 * this.r, 2 * this.r);
        break;
      case Vertedge.Shape.DIAMOND:
        ctx.moveTo(this.x, this.y - 1.3 * this.r);
        ctx.lineTo(this.x - 1.3 * this.r, this.y);
        ctx.lineTo(this.x, this.y + 1.3 * this.r);
        ctx.lineTo(this.x + 1.3 * this.r, this.y);
        ctx.closePath();
        break;
    }
  }

  draw(ctx, hover, select, highlight) {
    if (hover || select) {
      ctx.strokeStyle = select ? `#${highlight}cc` : `#${highlight}99`;
      ctx.lineWidth = this.lineWidth + 4;
      ctx.setLineDash([]);
      this.path(ctx);
      ctx.stroke();
    }
    ctx.fillStyle = this.fill;
    ctx.strokeStyle = this.stroke;
    ctx.lineWidth = this.lineWidth;
    ctx.setLineDash(this.lineDash);
    this.path(ctx);
    ctx.fill();
    ctx.stroke();
  }

  contains(ctx, pos, select) {
    ctx.lineWidth = select ? this.lineWidth + 4 : Math.max(this.lineWidth + 4, 12);
    this.path(ctx);
    return ctx.isPointInPath(pos.x, pos.y) || ctx.isPointInStroke(pos.x, pos.y);
  }

  copy() {
    let copy = new Vertedge.Vertex(this.x, this.y);
    copy.r = this.r;
    copy.fill = this.fill;
    copy.stroke = this.stroke;
    copy.lineWidth = this.lineWidth;
    copy.lineDash = this.lineDash.slice();
    copy.shape = this.shape;
    return copy;
  }

  get margin() {
    return (this.shape === Vertedge.Shape.DIAMOND ? 1.3 : 1) * this.r + 0.5 * this.lineWidth;
  }

};


Vertedge.Edge = class {

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
    if (this.cp === null) {
      ctx.moveTo(this.v1.x, this.v1.y);
      ctx.lineTo(this.v2.x, this.v2.y);
    } else if (!this.isLoop) {
      ctx.moveTo(this.v1.x, this.v1.y);
      ctx.quadraticCurveTo(this.cp.x, this.cp.y, this.v2.x, this.v2.y);
    } else {
      let radius = 0.5 * Math.hypot(this.v1.x - this.cp.x, this.v1.y - this.cp.y);
      ctx.ellipse(0.5 * (this.v1.x + this.cp.x), 0.5 * (this.v1.y + this.cp.y), radius, radius, 0, 0, 2 * Math.PI);
    }
  }

  draw(ctx, hover, select, highlight) {
    if (hover || select) {
      ctx.strokeStyle = select ? `#${highlight}cc` : `#${highlight}99`;
      ctx.lineWidth = this.lineWidth + 4;
      ctx.setLineDash([]);
      this.path(ctx);
      ctx.stroke();
    }
    ctx.strokeStyle = this.stroke;
    ctx.lineWidth = this.lineWidth;
    ctx.setLineDash(this.lineDash);
    this.path(ctx);
    ctx.stroke();
    if (select && this.cp !== null) {
      if (!this.isLoop) {
        ctx.strokeStyle = `#${highlight}77`;
        ctx.lineWidth = 2;
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.moveTo(this.v1.x, this.v1.y);
        ctx.lineTo(this.cp.x, this.cp.y);
        ctx.moveTo(this.v2.x, this.v2.y);
        ctx.lineTo(this.cp.x, this.cp.y);
        ctx.stroke();
      }
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
    if (this.cp !== null) {
      ctx.beginPath();
      ctx.ellipse(this.cp.x, this.cp.y, 10, 10, 0, 0, 2 * Math.PI);
      if (ctx.isPointInPath(pos.x, pos.y)) return true;
    }
    ctx.lineWidth = select ? this.lineWidth + 4 : Math.max(this.lineWidth + 4, 12);
    this.path(ctx);
    return ctx.isPointInStroke(pos.x, pos.y);
  }

  copy() {
    let copy;
    if (this.isLoop) {
      let vertex = this.v1.copy();
      copy = new Vertedge.Edge(vertex, vertex);
    } else copy = new Vertedge.Edge(this.v1.copy(), this.v2.copy());
    copy.cp = this.cp == null ? null : this.cp.copy();
    copy.stroke = this.stroke;
    copy.lineWidth = this.lineWidth;
    copy.lineDash = this.lineDash.slice();
    return copy;
  }

  get margin() {
    return 0.5 * this.lineWidth;
  }

  get isLoop() {
    return this.v1 === this.v2;
  }

};


window.addEventListener("load", event => {
  const vertedge = new Vertedge();
  document.body.appendChild(vertedge.element);
  vertedge.start();
});
