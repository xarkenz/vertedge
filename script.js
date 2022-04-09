window.addEventListener("load", event => {
  for (let element of document.querySelectorAll(".vertedge-viewer")) {
    new VertedgeViewer(element);
  }
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
    this.shape = "circle";
  }

  path(ctx) {
    this.shape = this.shape.toLowerCase(); // normalize
    ctx.beginPath();
    if (this.shape === "square") {
      ctx.rect(this.x - this.r, this.y - this.r, 2 * this.r, 2 * this.r);
    } else if (this.shape === "diamond") {
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

  contains(ctx, x, y, select) {
    // Recreate shape of vertex
    ctx.lineWidth = select ? this.lineWidth + 4 : Math.max(this.lineWidth + 4, 12);
    this.path(ctx);
    // Check collision
    return ctx.isPointInPath(x, y) || ctx.isPointInStroke(x, y);
  }

  copy() {
    let copy = new Vertex(this.x, this.y);
    copy.r = this.r;
    copy.fill = this.fill;
    copy.stroke = this.stroke;
    copy.lineWidth = this.lineWidth;
    copy.lineDash = this.lineDash.slice();
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

  contains(ctx, x, y, select) {
    // Check control point first
    if (this.cp !== null) {
      ctx.beginPath();
      ctx.ellipse(this.cp.x, this.cp.y, 10, 10, 0, 0, 2 * Math.PI);
      if (ctx.isPointInPath(x, y)) return true;
    }
    // Recreate shape of edge
    ctx.lineWidth = select ? this.lineWidth + 4 : Math.max(this.lineWidth + 4, 12);
    ctx.beginPath();
    ctx.moveTo(this.v1.x, this.v1.y);
    if (this.cp === null) ctx.lineTo(this.v2.x, this.v2.y);
    else ctx.quadraticCurveTo(this.cp.x, this.cp.y, this.v2.x, this.v2.y);
    // Check collision
    return ctx.isPointInStroke(x, y);
  }

  copy() {
    let copy = new Edge(this.v1, this.v2);
    copy.cp = DOMPoint.fromPoint(this.cp);
    copy.stroke = this.stroke;
    copy.lineWidth = this.lineWidth;
    copy.lineDash = this.lineDash.slice();
    return copy;
  }

}


class VertedgeViewer {

  constructor(element) {
    this.element = element;

    this.canvas = document.createElement("canvas");
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.element.appendChild(this.canvas);

    this.title = document.createElement("div");
    this.title.className = "vertedge-title";
    this.title.textContent = "Loading...";
    this.element.appendChild(this.title);

    this.controls = document.createElement("div");
    this.controls.className = "vertedge-controls";
    this.element.appendChild(this.controls);

    this.ctrlOpener = document.createElement("img");
    this.ctrlOpener.className = "vertedge-controls-opener";
    this.ctrlOpener.src = "icons/controls-opener.svg";
    this.element.appendChild(this.ctrlOpener);
    this.ctrlOpener.addEventListener("mousedown", this.toggleControls.bind(this), {capture: false, passive: true});
    this.ctrlOpener.addEventListener("touchstart", this.toggleControls.bind(this), {capture: false, passive: true});

    this.ctrlButtons = [];
    this.addCtrlButton("default", "Select", "v");
    this.addCtrlButton("pencil", "Draw", "d");
    this.addCtrlButton("eraser", "Erase", "x");
    this.addCtrlButton("style", "Style", "s");
    this.addCtrlButton("grid", "Grid", "g");
    let spacer = document.createElement("div");
    spacer.className = "vertedge-controls-spacer";
    this.controls.appendChild(spacer);
    this.addCtrlButton("help", "Help", "h");

    this.styleMenu = document.createElement("div");
    this.styleMenu.className = "vertedge-menu";
    this.styleMenu.textContent = "Element Style";
    this.styleMenu.appendChild(this.makeSeparator());
    this.styleMenu.appendChild(this.makeHSpread("choose-vertex-shape", "Shape", ["circle", "square", "diamond"]));
    this.element.appendChild(this.styleMenu);

    this.gridMenu = document.createElement("div");
    this.gridMenu.className = "vertedge-menu";
    this.gridMenu.textContent = "Grid Settings";
    this.gridMenu.appendChild(this.makeSeparator());
    this.gridMenu.appendChild(this.makeCheckbox("toggle-snap-grid", "Snap to Grid"));
    this.element.appendChild(this.gridMenu);

    this.ctx = this.canvas.getContext("2d");

    window.addEventListener("resize", this.resizeEvent.bind(this), {capture: false, passive: true});
    this.canvas.addEventListener("mousedown", this.mousePressEvent.bind(this), {capture: false, passive: false});
    document.addEventListener("mousemove", this.mouseMoveEvent.bind(this), {capture: false, passive: true});
    document.addEventListener("mouseup", this.mouseReleaseEvent.bind(this), {capture: false, passive: true});
    this.canvas.addEventListener("touchstart", this.mousePressEvent.bind(this), {capture: false, passive: false});
    document.addEventListener("touchmove", this.mouseMoveEvent.bind(this), {capture: false, passive: true});
    document.addEventListener("touchend", this.mouseReleaseEvent.bind(this), {capture: false, passive: true});
    this.canvas.addEventListener("wheel", this.wheelEvent.bind(this), {capture: true, passive: false});
    document.addEventListener("keydown", this.keyEvent.bind(this), {capture: true, passive: false});

    this.transform = this.ctx.getTransform();
    this.selection = [];
    this.mode = 0;
    this.grid = [50, 50];

    this.dragging = false;
    this.drag = null;
    this.mousePos = new DOMPoint(0, 0);
    this.waitingForVertex = null;

    this.vertices = [];
    this.edges = [];

    this.resizeEvent();

    this.load("graphs/complete-5.json");
  }

  addCtrlButton(name, display, shortcut) {
    let button = document.createElement("div");
    button.className = "vertedge-controls-button";
    const id = this.ctrlButtons.push(button) - 1;
    if (name === "help") button.classList.add("vertedge-controls-help");
    let icon = document.createElement("img");
    icon.src = `icons/${name}.svg`;
    button.appendChild(icon);
    let tooltip = document.createElement("div");
    tooltip.className = "vertedge-controls-tooltip";
    tooltip.textContent = display;
    let hint = document.createElement("span");
    hint.textContent = shortcut;
    tooltip.appendChild(hint);
    button.addEventListener("mousedown", event => {this.mode = this.mode === id ? 0 : id}, {capture: false, passive: true});
    button.appendChild(tooltip);
    this.controls.appendChild(button);
  }

  makeSeparator() {
    let sep = document.createElement("span");
    sep.className = "vertedge-menu-separator";
    return sep;
  }

  makeCheckbox(id, label) {
    let container = document.createElement("label");
    container.className = "vertedge-checkbox";
    container.textContent = label;
    container.addEventListener("click", this.update.bind(this), {capture: false, passive: true});
    let input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    let box = document.createElement("span");
    let check = document.createElement("img");
    check.src = "icons/checkbox-check.svg";
    box.appendChild(check);
    container.appendChild(input);
    container.appendChild(box);
    return container;
  }

  makeHSpread(id, label, names) {
    let spread = document.createElement("div");
    spread.className = "vertedge-hspread";
    spread.id = id;
    spread.textContent = label + ":";
    for (let name of names) {
      let container = document.createElement("label");
      let input = document.createElement("input");
      input.type = "radio";
      input.name = id;
      input.value = name;
      input.addEventListener("change", event => {this.radioEvent(id, name)}, {capture: false, passive: true});
      container.appendChild(input);
      let button = document.createElement("span");
      let icon = document.createElement("img");
      icon.src = `icons/${name}.svg`;
      button.appendChild(icon);
      container.appendChild(button);
      spread.appendChild(container);
    }
    return spread;
  }

  update() {
    // Update control button borders
    for (let i = 0; i < this.ctrlButtons.length; i++) {
      this.ctrlButtons[i].style.borderColor = this.mode === i ? "#ccc" : "";
    }

    // Cancel edge creation if exited pencil mode
    if (this.mode !== 1) this.waitingForVertex = null;

    // Open style menu if using style tool and an element is selected
    if (this.mode === 3 && this.selection.length > 0) {
      this.styleMenu.style = "transform: translateX(-300px); opacity: 1;";

      let selectedVertices = this.selection.filter(element => element instanceof Vertex);
      let shape = null;
      for (let vertex of selectedVertices) {
        if (shape === null) shape = vertex.shape;
        else if (vertex.shape !== shape) { shape = null; break; }
      }
      if (shape === null) {
        let group = document.querySelectorAll(`input[name="choose-vertex-shape"]`);
        for (let input of group) {
          input.checked = false;
        }
      } else {
        let input = document.querySelector(`input[name="choose-vertex-shape"][value="${shape}"]`);
        if (input !== null) input.checked = true;
        else {
          let group = document.querySelectorAll(`input[name="choose-vertex-shape"]`);
          for (let input of group) {
            input.checked = false;
          }
        }
      }
    } else {
      this.styleMenu.style = "";
    }

    // Open grid menu if grid mode is active
    this.gridMenu.style = this.mode === 4 ? "transform: translateX(-300px); opacity: 1;" : "";

    // Clear screen and update transform
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.resetTransform();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.setTransform(this.transform);

    // Draw grid if enabled
    if (document.querySelector("#toggle-snap-grid").checked) {
      let topLeft = this.transform.inverse().transformPoint(new DOMPoint(0, 0));
      let bottomRight = this.transform.inverse().transformPoint(new DOMPoint(this.canvas.width, this.canvas.height));

      this.ctx.strokeStyle = "#fff1";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([]);

      for (let x = Math.floor(topLeft.x / this.grid[0]) * this.grid[0]; x <= Math.ceil(bottomRight.x / this.grid[0]) * this.grid[0]; x += this.grid[0]) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, topLeft.y);
        this.ctx.lineTo(x, bottomRight.y);
        this.ctx.stroke();
      }

      for (let y = Math.floor(topLeft.y / this.grid[1]) * this.grid[1]; y <= Math.ceil(bottomRight.y / this.grid[1]) * this.grid[1]; y += this.grid[1]) {
        this.ctx.beginPath();
        this.ctx.moveTo(topLeft.x, y);
        this.ctx.lineTo(bottomRight.x, y);
        this.ctx.stroke();
      }
    }

    if (this.dragging && this.drag !== null && this.drag.element !== null) {
      this.drag.element.draw(this.ctx, false);
      if (this.drag.element instanceof Edge && this.drag.element.cp !== null) {
        this.ctx.strokeStyle = "#b762f077";
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([]);
        this.ctx.beginPath();
        this.ctx.ellipse(this.drag.element.cp.x, this.drag.element.cp.y, 3, 3, 0, 0, 2 * Math.PI);
        this.ctx.stroke();
      }
    }

    // Draw edges, then vertices (later index -> higher z)
    const highlight = this.mode === 1 ? "72e02d" : (this.mode === 2 ? "e84b33" : "b762f0");
    for (let i = 0; i < this.edges.length; i++) {
      this.edges[i].draw(this.ctx, this.selection.includes(this.edges[i]), highlight);
    }
    for (let i = 0; i < this.vertices.length; i++) {
      this.vertices[i].draw(this.ctx, this.selection.includes(this.vertices[i]), highlight);
    }

    // If in pencil or eraser mode, draw a dot under the cursor
    if ((this.mode === 1 || this.mode === 2) && !this.dragging && !(this.mousePos.x === 0 && this.mousePos.y === 0)) {
      // TODO: highlight element if hovered over in these modes
      const worldPos = this.mode === 1 ? this.snapToGrid(this.mousePos.x, this.mousePos.y, true) : this.transform.inverse().transformPoint(this.mousePos);
      if (this.mode === 1 && this.waitingForVertex !== null) {
        let element = this.elementAt(this.mousePos.x, this.mousePos.y);
        this.ctx.strokeStyle = "#72e02daa";
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.waitingForVertex.x, this.waitingForVertex.y);
        if (element instanceof Vertex) {
          this.ctx.lineTo(element.x, element.y);
          this.ctx.stroke();
          return;
        } else {
          this.ctx.lineTo(worldPos.x, worldPos.y);
          this.ctx.stroke();
        }
      }
      this.ctx.fillStyle = this.mode === 1 ? "#72e02daa" : "#e84b33aa";
      this.ctx.beginPath();
      this.ctx.ellipse(worldPos.x, worldPos.y, 5, 5, 0, 0, 2 * Math.PI);
      this.ctx.fill();
    }
  }

  resizeEvent() {
    const move = new DOMPoint(0.5 * (this.element.clientWidth * window.devicePixelRatio - this.canvas.width), 0.5 * (this.element.clientHeight * window.devicePixelRatio - this.canvas.height));
    this.canvas.width = this.element.clientWidth * window.devicePixelRatio;
    this.canvas.height = this.element.clientHeight * window.devicePixelRatio;
    this.transform.translateSelf(move.x, move.y);
    let center = this.transform.inverse().transformPoint(new DOMPoint(0.5 * this.canvas.width, 0.5 * this.canvas.height));
    this.transform.scaleSelf(window.devicePixelRatio / this.transform.a, window.devicePixelRatio / this.transform.d, 1, center.x, center.y);
    this.update();
  }

  mousePressEvent(event) {
    event.preventDefault();
    event.stopPropagation();

    const isTouch = event.touches !== undefined;

    let x = (isTouch ? event.touches[0].pageX - this.element.offsetLeft : event.pageX - this.element.offsetLeft) * window.devicePixelRatio;
    let y = (isTouch ? event.touches[0].pageY - this.element.offsetTop : event.pageY - this.element.offsetTop) * window.devicePixelRatio;

    this.mousePos.x = x;
    this.mousePos.y = y;

    if (event.button == 0 || isTouch) {
      this.dragging = true;
      let p = this.snapToGrid(x, y, true);
      let element = this.elementAt(x, y);

      if (this.mode === 1) {
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
            this.waitingForVertex = null;
          } else {
            this.waitingForVertex = element;
          }
          this.update();
          return;
        }
      } else if (this.mode === 2) {
        if (element !== null) {
          if (!this.selection.includes(element)) this.selection = [element];
          for (let i = 0; i < this.selection.length; i++) {
            if (this.selection[i] instanceof Vertex) {
              this.vertices.splice(this.vertices.indexOf(this.selection[i]), 1);
              for (let j = 0; j < this.edges.length; j++) {
                if (this.edges[j].v1 === this.selection[i] || this.edges[j].v2 === this.selection[i]) this.edges.splice(j--, 1);
              }
            } else this.edges.splice(this.edges.indexOf(this.selection[i]), 1);
          }
          element = null;
        }
      }

      let origElem = null;
      if (element !== null) {
        origElem = element.copy();
        if (element instanceof Vertex) origElem.fill = "transparent";
        origElem.stroke = "#b762f077";
        origElem.lineWidth = 2;
        origElem.lineDash = [4, 4];
      }

      const index = element === null ? -1 : (element instanceof Vertex ? this.vertices.indexOf(element) : this.edges.indexOf(element));
      this.drag = {x: x, y: y, transform: this.transform, element: origElem, elemIdx: index};

      if (element === null) {
        if (!event.shiftKey) this.selection = [];
      } else if (event.shiftKey) {
        if (this.selection.includes(element)) {
          delete this.selection[this.selection.indexOf(element)];
        } else {
          this.selection.push(element);
        }
      } else if (!this.selection.includes(element)) {
        this.selection = [element];
      }
      if (element !== null && element.cp === null) {
        this.drag.element.cp = new DOMPoint(p.x, p.y);
      }

      this.update();
    }
  }

  mouseMoveEvent(event) {
    const isTouch = event.touches !== undefined;

    let x = (isTouch ? event.touches[0].pageX - this.element.offsetLeft : event.pageX - this.element.offsetLeft) * window.devicePixelRatio;
    let y = (isTouch ? event.touches[0].pageY - this.element.offsetTop : event.pageY - this.element.offsetTop) * window.devicePixelRatio;

    if (event.target === this.canvas) {
      this.mousePos.x = x;
      this.mousePos.y = y;
    } else {
      this.mousePos.x = 0;
      this.mousePos.y = 0;
    }

    if (!this.dragging && (this.mode === 1 || this.mode === 2)) {
      this.update();
      return;
    }

    if (this.drag === null || !isTouch && event.buttons !== 1 || event.offsetX === 0 && event.offsetY === 0) return;

    let revert = Math.abs(x - this.drag.x) <= 8 * window.devicePixelRatio && Math.abs(y - this.drag.y) <= 8 * window.devicePixelRatio;
    let dx = (x - this.drag.x) / window.devicePixelRatio;
    let dy = (y - this.drag.y) / window.devicePixelRatio;

    if (this.drag.element === null) {
      this.transform = revert ? this.drag.transform.translate(0, 0) : this.drag.transform.translate(dx, dy);
    } else if (this.drag.element instanceof Vertex) {
      let p = revert ? new DOMPoint(this.drag.element.x, this.drag.element.y) : this.snapToGrid(this.drag.element.x + dx, this.drag.element.y + dy, false);
      this.vertices[this.drag.elemIdx].x = p.x;
      this.vertices[this.drag.elemIdx].y = p.y;
    } else if (this.drag.element instanceof Edge) {
      if (this.edges[this.drag.elemIdx].cp === null) this.edges[this.drag.elemIdx].cp = new DOMPoint(0, 0);
      let p = revert ? this.drag.element.cp : this.snapToGrid(this.drag.element.cp.x + dx, this.drag.element.cp.y + dy, false);
      this.edges[this.drag.elemIdx].cp.x = p.x;
      this.edges[this.drag.elemIdx].cp.y = p.y;

      const v1 = this.edges[this.drag.elemIdx].v1;
      const v2 = this.edges[this.drag.elemIdx].v2;
      const cp = this.edges[this.drag.elemIdx].cp;
      const angleDiff = Math.acos(((cp.x - v1.x) * (v2.x - cp.x) + (cp.y - v1.y) * (v2.y - cp.y)) / (Math.hypot(cp.x - v1.x, cp.y - v1.y) * Math.hypot(v2.x - cp.x, v2.y - cp.y)));
      if (angleDiff < 0.3) this.edges[this.drag.elemIdx].cp = null;
    }

    this.update();
  }

  mouseReleaseEvent(event) {
    const isTouch = event.touches !== undefined;

    if (isTouch || event.button === 0) {
      this.dragging = false;
      this.drag = null;

      this.update();
    }
  }

  wheelEvent(event) {
    event.preventDefault();
    event.stopPropagation();

    if (this.dragging) return;
    //this.zoom(-event.deltaY / 100, [event.offsetX, event.offsetY]);
  }

  keyEvent(event) {
    // TODO: esc doesn't call this event for some reason?
    let key = event.code.toLowerCase();

    if (key === "keyv") this.mode = 0;
    else if (key === "keyd") this.mode = 1;
    else if (key === "keyx") this.mode = 2;
    else if (key === "keys") this.mode = 3;
    else if (key === "keyg") this.mode = 4;
    else if (key === "keyh") this.mode = 5;
    else if (key === "escape") this.waitingForVertex = null;
    else return;

    event.preventDefault();
    event.stopPropagation();

    this.update();
  }

  radioEvent(name, value) {
    if (name === "choose-vertex-shape") {
      for (let element of this.selection) {
        if (element instanceof Vertex) element.shape = value;
      }
    }

    this.update();
  }

  snapToGrid(x, y, screen) {
    let pos = new DOMPoint(x, y);
    if (screen) pos = this.transform.inverse().transformPoint(pos);
    if (document.querySelector("#toggle-snap-grid").checked) {
      pos = new DOMPoint(Math.round(pos.x / this.grid[0]) * this.grid[0], Math.round(pos.y / this.grid[1]) * this.grid[1]);
    }

    return pos;
  }

  elementAt(x, y) {
    for (let i = this.vertices.length - 1; i >= 0; i--) {
      if (this.vertices[i].contains(this.ctx, x, y, this.selection.includes(this.vertices[i]))) {
        return this.vertices[i];
      }
    }

    for (let i = this.edges.length - 1; i >= 0; i--) {
      if (this.edges[i].contains(this.ctx, x, y, this.selection.includes(this.edges[i]))) {
        return this.edges[i];
      }
    }

    return null;
  }

  load(url) {
    fetch(url).then(response => response.json()).then(data => {
      this.vertices = [];
      this.edges = [];
      for (let i = 0; i < data.vertices.length; i++) {
        let raw = data.vertices[i];
        let vertex = new Vertex(raw.x, raw.y);
        if (raw.r !== undefined) vertex.r = raw.r;
        if (raw.fill !== undefined) vertex.fill = raw.fill;
        if (raw.stroke !== undefined) vertex.stroke = raw.stroke;
        if (raw.lineWidth !== undefined) vertex.lineWidth = raw.lineWidth;
        if (raw.lineDash !== undefined) vertex.lineDash = raw.lineDash.slice();
        if (raw.shape !== undefined) vertex.shape = raw.shape.toLowerCase();
        this.vertices.push(vertex);
      }
      for (let i = 0; i < data.edges.length; i++) {
        let raw = data.edges[i];
        let edge = new Edge(this.vertices[raw.v1], this.vertices[raw.v2]);
        if (raw.cp !== undefined) edge.cp = new DOMPoint(raw.cp[0], raw.cp[1]);
        if (raw.stroke !== undefined) edge.stroke = raw.stroke;
        if (raw.lineWidth !== undefined) edge.lineWidth = raw.lineWidth;
        if (raw.lineDash !== undefined) edge.lineDash = raw.lineDash.slice();
        this.edges.push(edge);
      }
      if (data.title !== undefined) this.title.textContent = data.title;
      this.update();
    }).catch(console.error);
  }

  toggleControls(event) {
    if (this.controls.style.transform == "") {
      this.controls.style.transform = "translateX(-48px)";
      this.ctrlOpener.style.transform = "rotate(0deg)";
    } else {
      this.controls.style.transform = "";
      this.ctrlOpener.style.transform = "";
    }
  }

}
