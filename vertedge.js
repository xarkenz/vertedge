window.addEventListener("load", event => {
  populateAppers(VertedgeApplication, "vertedge-application");
});


class Vertex {

  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 10;
    this.fill = "#666";
    this.stroke = "#ccc";
    this.lineWidth = 4;
    this.lineDash = [];
    this.shape = 0;
  }

  path(ctx) {
    ctx.beginPath();
    if (this.shape === 1) {
      ctx.rect(this.x - this.r, this.y - this.r, 2 * this.r, 2 * this.r);
    } else if (this.shape === 2) {
      ctx.moveTo(this.x, this.y - this.r);
      ctx.lineTo(this.x - this.r, this.y);
      ctx.lineTo(this.x, this.y + this.r);
      ctx.lineTo(this.x + this.r, this.y);
      ctx.closePath();
    } else {
      ctx.ellipse(this.x, this.y, this.r, this.r, 0, 0, 2 * Math.PI);
    }
  }

  draw(ctx, select, highlight) {
    // Add highlight if selected
    if (select) {
      ctx.strokeStyle = `#${highlight}cc`;
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

  draw(ctx, select, highlight) {
    // Add highlight if selected
    if (select) {
      ctx.strokeStyle = `#${highlight}cc`;
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
      ctx.lineTo(this.v2.x, this.v2.y);
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
    let copy = new Edge(this.v1, this.v2);
    copy.cp = this.cp === null ? null : this.cp.copy();
    copy.stroke = this.stroke;
    copy.lineWidth = this.lineWidth;
    copy.lineDash = this.lineDash.slice();
    return copy;
  }

}


class VertedgeApplication extends ApperApplication {

  get dragging() { return this.drag !== null; }

  constructor(element) {
    super(element);

    this.enableToolbar()
      .addTool("select", "Select", "icons/select.svg", "keyv", "v", true)
      .addTool("move", "Move", "icons/move.svg", "keym", "m")
      .addTool("draw", "Draw", "icons/draw.svg", "keyd", "d")
      .addTool("erase", "Erase", "icons/erase.svg", "keyx", "x")
      .addTool("style", "Style", "icons/style.svg", "keys", "s")
      .addTool("grid", "Grid", "icons/grid.svg", "keyg", "g")
      .addSpacer()
      .addTool("data", "View Data", "icons/data.svg")
      .addTool("load", "Load", "icons/load.svg")
      .addTool("help", "Help", "icons/help.svg", "keyh", "h");

    let icons = ["icons/shape-circle.svg", "icons/shape-square.svg", "icons/shape-diamond.svg"];
    this.addMenu(0, "Element Style")
      .addSeparator()
      .add(this.vertexShape = new ApperHSpread("vertedge-vertex-shape", "Shape:", icons)
        .onChange(value => {
          this.selection.forEach(element => {
            if (element instanceof Vertex) element.shape = value;
          });
          this.update();
        }));

    this.addMenu(1, "Grid Settings")
      .addSeparator()
      .add(this.enableGrid = new ApperCheckbox("vertedge-enable-grid", "Enable grid")
        .onChange(value => this.update()));

    this.addMenu(2, "Raw Graph Data")
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

    this.addMenu(3, "Load a Graph")
      .addSeparator()
      .add(new ApperButtonList("Example Graphs:", this.exampleURLs, this.exampleTitles)
        .onChange(url => {
          this.toolbar.tool = 0;
          this.update();
          this.load(url);
        }));

    this.defaultTitle = "Untitled Graph";

    this.selection = [];
    this.grid = [50, 50];

    this.drag = null;
    this.waitingForVertex = null;
    this.color = "";

    this.vertices = [];
    this.edges = [];

    this.update();

    if (window.location.hash) this.load(window.location.hash.slice(1));
  }

  render() {
    if (this.toolbar === null) return;

    const element = this.elementAt(this.cursorPos);
    this.color = this.toolbar.tool === 2 ? "23a54c" : this.toolbar.tool === 3 ? "e84b33" : "b762f0";

    // Cancel edge creation if exited draw mode
    if (this.toolbar.tool !== 2) this.waitingForVertex = null;

    // Update style menu
    if (this.toolbar.tool === 4 && this.selection.length > 0) {
      let shape = null;
      for (let element of this.selection) {
        if (element instanceof Vertex)
          if (shape === null) shape = element.shape;
          else if (element.shape !== shape) {
            shape = null;
            break;
          }
      }
      this.vertexShape.value = shape;

      this.menu(0).show();
    } else this.menu(0).hide();

    // Update grid menu
    if (this.toolbar.tool === 5) this.menu(1).show();
    else this.menu(1).hide();

    // Update data menu
    if (this.toolbar.tool === 6) {
      if (!this.dataEditor.editing) this.dataEditor.text = this.graphData;

      this.menu(2).show();
    } else this.menu(2).hide();

    // Update load menu
    if (this.toolbar.tool === 7) this.menu(3).show();
    else this.menu(3).hide();

    // Update cursor
    if (this.toolbar.tool === 1) {
      this.element.style.cursor = this.dragging ? "grabbing" : "";
      this.canvas.style.cursor = this.dragging ? "" : "grab";
    } else {
      this.element.style.cursor = "";
      this.canvas.style.cursor = "";
    }

    // Set initial style values
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    // Draw grid if enabled
    if (this.enableGrid.checked) {
      let topLeft = this.getWorldPos(new ApperPoint());
      let bottomRight = this.getWorldPos(new ApperPoint(this.canvas.width, this.canvas.height));

      this.ctx.strokeStyle = "#fff1";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([]);
      this.ctx.beginPath();

      for (let x = Math.floor(topLeft.x / this.grid[0]) * this.grid[0]; x <= Math.ceil(bottomRight.x / this.grid[0]) * this.grid[0]; x += this.grid[0]) {
        this.ctx.moveTo(x, topLeft.y);
        this.ctx.lineTo(x, bottomRight.y);
      }

      for (let y = Math.floor(topLeft.y / this.grid[1]) * this.grid[1]; y <= Math.ceil(bottomRight.y / this.grid[1]) * this.grid[1]; y += this.grid[1]) {
        this.ctx.moveTo(topLeft.x, y);
        this.ctx.lineTo(bottomRight.x, y);
      }

      this.ctx.stroke();
    }

    if (this.dragging && this.drag.elements.length !== 0) {
      for (let element of this.drag.elements) {
        element.draw(this.ctx, false, this.color);
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
      edge.draw(this.ctx, this.selection.includes(edge) || (this.toolbar.tool === 2 || this.toolbar.tool === 3) && element === edge, this.color);
    });
    this.vertices.forEach(vertex => {
      vertex.draw(this.ctx, this.selection.includes(vertex) || (this.toolbar.tool === 2 || this.toolbar.tool === 3) && element === vertex, this.color);
    });

    // If in draw or erase mode, add extra indicators
    if ((this.toolbar.tool === 2 || this.toolbar.tool === 3) && !this.cursorPos.equals(0, 0)) {
      const worldPos = this.toolbar.tool === 2 ? this.snapToGrid(this.getWorldPos(this.cursorPos)) : this.getWorldPos(this.cursorPos);
      if (this.toolbar.tool === 2 && this.waitingForVertex !== null) {
        this.ctx.strokeStyle = `#${this.color}aa`;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.waitingForVertex.x, this.waitingForVertex.y);
        if (element instanceof Vertex) {
          this.ctx.lineTo(element.x, element.y);
          this.ctx.stroke();
        } else {
          this.ctx.lineTo(worldPos.x, worldPos.y);
          this.ctx.stroke();
        }
      }
      if (element === null || this.toolbar.tool === 2 && element instanceof Edge) {
        this.ctx.fillStyle = `#${this.color}aa`;
        this.ctx.beginPath();
        this.ctx.ellipse(worldPos.x, worldPos.y, 5, 5, 0, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    }

    // Draw selection box
    if (this.toolbar.tool !== 1 && this.toolbar.tool !== 2 && this.dragging && !this.drag.elements.length && !this.cursorPos.equals(0, 0)) {
      let start = this.getWorldPos(new ApperPoint(this.drag.x, this.drag.y));
      let size = this.getWorldPos(this.cursorPos).sub(start);
      this.ctx.strokeStyle = `#${this.color}77`;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.beginPath();
      this.ctx.rect(start.x, start.y, size.x, size.y);
      this.ctx.stroke();
    }
  }

  mouseDown(event) {
    if (event.leftBtn) {
      let p = this.snapToGrid(event.worldPos);
      let element = this.toolbar.tool === 1 ? null : this.elementAt(event.screenPos);

      if (this.toolbar.tool === 2) {
        if (element === null) {
          let placed = new Vertex(p.x, p.y);
          this.vertices.push(placed);
          element = placed;
          if (this.waitingForVertex !== null) {
            this.edges.push(new Edge(this.waitingForVertex, placed));
            this.waitingForVertex = null;
          }
        } else if (element instanceof Vertex) {
          if (this.waitingForVertex !== null) {
            this.edges.push(new Edge(this.waitingForVertex, element));
          } else {
            this.waitingForVertex = element;
          }
        } else if (element instanceof Edge) {
          let placed = new Vertex(p.x, p.y);
          this.vertices.push(placed);
          let other = new Edge(placed, element.v2);
          element.v2 = placed;
          element.cp = null; // TODO: approximate curve?
          this.edges.push(other);
          element = placed;
          if (this.waitingForVertex !== null) {
            this.edges.push(new Edge(this.waitingForVertex, placed));
            this.waitingForVertex = null;
          }
        }
      } else if (this.toolbar.tool === 3) {
        if (element !== null) {
          if (!this.selection.includes(element)) this.selection = [element];
          this.deleteSelection();
          element = null;
        }
      }

      if (element === null) {
        if (this.toolbar.tool !== 1 && !event.shiftKey) this.selection = [];
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
        elements, indices
      };

      if (elements.length === 1 && elements[0] instanceof Edge && elements[0].cp === null) {
        this.drag.elements[0].cp = p.copy();
      }
    }

    return true;
  }

  mouseMove(event) {
    if (!this.dragging && (this.toolbar.tool === 2 || this.toolbar.tool === 3)) return true;

    if (!this.dragging || !event.leftBtn || event.screenPos.equals(0, 0)) return false;

    let revert = Math.abs(event.screenPos.x - this.drag.x) <= 8 * this.pixelRatio && Math.abs(event.screenPos.y - this.drag.y) <= 8 * this.pixelRatio;
    let dx = (event.screenPos.x - this.drag.x) / this.pixelRatio;
    let dy = (event.screenPos.y - this.drag.y) / this.pixelRatio;

    if (this.toolbar.tool === 1) {
      this.transform = revert ? this.drag.transform.translate(0, 0) : this.drag.transform.translate(dx, dy);

    } else if (!this.drag.elements.length) {
      // TODO: update selection w/ selectbox

    } else for (let i = 0; i < this.drag.elements.length; i++) {
      let element = this.drag.elements[i];
      let index = this.drag.indices[i];

      if (element instanceof Vertex) {
        let vertex = this.vertices[index];
        let p = revert ? new ApperPoint(element) : this.snapToGrid(new ApperPoint(element).add(dx, dy));
        if (this.toolbar.tool === 2 && this.waitingForVertex !== null) {
          if (vertex !== this.waitingForVertex) {
            if (!revert) console.log("change curvature");
  	      }
        } else {
          vertex.x = p.x;
          vertex.y = p.y;
        }

      } else if (this.drag.elements.length === 1 && element instanceof Edge) {
        let edge = this.edges[index];
        if (edge.cp === null) edge.cp = new ApperPoint();
        let p = revert ? element.cp : this.snapToGrid(element.cp.add(dx, dy));
        edge.cp.set(p);

        const v1 = edge.v1;
        const v2 = edge.v2;
        const cp = edge.cp;
        const angleDiff = Math.acos(((cp.x - v1.x) * (v2.x - cp.x) + (cp.y - v1.y) * (v2.y - cp.y)) / (Math.hypot(cp.x - v1.x, cp.y - v1.y) * Math.hypot(v2.x - cp.x, v2.y - cp.y)));
        if (angleDiff < 0.3) edge.cp = null;
      }
    }

    return true;
  }

  mouseUp(event) {
    if (event.leftBtn && this.drag !== null) {
      let element = this.toolbar.tool === 1 ? null : this.elementAt(this.cursorPos);
      if (this.toolbar.tool === 2) {
        if (this.waitingForVertex !== null && this.waitingForVertex !== element) {
          if (element instanceof Vertex) {
            this.edges.push(new Edge(this.waitingForVertex, element));
            this.selection = [element];
          } else {
            let worldPos = this.snapToGrid(this.getWorldPos(this.cursorPos));
            let placed = new Vertex(worldPos.x, worldPos.y);
            this.vertices.push(placed);
            this.edges.push(new Edge(this.waitingForVertex, placed));
            this.selection = [placed];
          }
          this.waitingForVertex = null;
        }
      } else if (this.toolbar.tool !== 1 && !this.drag.elements.length) {
        if (!event.shiftKey) this.selection = [];
        let selectBox = new ApperRect(this.drag.x, this.drag.y, this.cursorPos.x - this.drag.x, this.cursorPos.y - this.drag.y).transform(this.transform.inverse());
        let select = [];
        select = select.concat(this.vertices.filter(vertex => {
          return selectBox.intersects(new ApperRect(vertex.x - vertex.r, vertex.y - vertex.r, 2 * vertex.r, 2 * vertex.r));
        }));
        this.selection = this.selection.concat(select);
      }
      this.drag = null;
      return true;
    }
  }

  keyDown(event) {
    switch (event.key) {
      case "keyv": this.toolbar.tool = 0; break;
      case "keym": this.toolbar.tool = 1; break;
      case "keyd": this.toolbar.tool = 2; break;
      case "keyx": this.toolbar.tool = 3; break;
      case "keys": this.toolbar.tool = 4; break;
      case "keyg": this.toolbar.tool = 5; break;
      case "keyh": this.toolbar.tool = 8; break;
      case "escape": this.waitingForVertex = null; break;
      case "backspace": case "delete":
        if (!this.selection.length) return false;
        this.deleteSelection(); break;
      case "period": case "numpaddecimal": this.centerView(); break;
      default: return false;
    }

    return true;
  }

  snapToGrid(pos) {
    if (this.enableGrid.checked)
      return new ApperPoint(Math.round(pos.x / this.grid[0]) * this.grid[0], Math.round(pos.y / this.grid[1]) * this.grid[1]);
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
        this.selection = this.selection.filter(element => this.vertices.includes(element) || this.edges.includes(element));
      } else this.edges.splice(this.edges.indexOf(selected), 1);
    });
  }

  centerView() {
    let oldCenter = this.getWorldPos(new ApperPoint(this.canvas.width, this.canvas.height).mul(0.5));
    this.transform = this.transform.translate(oldCenter.x, oldCenter.y);

    if (this.vertices.length) {
      let l = Infinity, r = -Infinity, b = Infinity, t = -Infinity;
      for (let vertex of this.vertices) {
        if (vertex.x < l) l = vertex.x;
        if (vertex.x > r) r = vertex.x;
        if (vertex.y < b) b = vertex.y;
        if (vertex.y > t) t = vertex.y;
      }
      this.transform = this.transform.translate(-0.5 * (l + r), -0.5 * (b + t));
    }

    this.update();
  }

  load(url) {
    this.title = "Loading...";

    fetch(url)
      .then(response => response.json(), error => {
        console.error(error);
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