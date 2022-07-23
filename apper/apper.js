const populateAppers = (type, className, dest) => {
  for (let element of document.querySelectorAll("." + className)) {
    let app = new type(element);
    if (dest !== undefined) dest.push(app);
  }
}

const toggleStyleClass = (element, className) => {
  if (element.classList.contains(className))
    element.classList.remove(className);
  else
    element.classList.add(className);
}

const measureText = (text, src) => {
  const canvas = measureText.canvas ?? (measureText.canvas = document.createElement("canvas"));
  const ctx = canvas.getContext("2d");
  if (src instanceof Element) {
    const style = window.getComputedStyle(src, null);
    ctx.font = `${
      style.getPropertyValue("font-weight") || "normal"} ${
      style.getPropertyValue("font-size") || "14px"} ${
      style.getPropertyValue("font-family") || "Nunito"}`;
  } else ctx.font = src;
  return ctx.measureText(text).width;
}


class ApperPoint {

  constructor(x = 0, y = null) {
    this.set(x, y);
  }

  copy() {
    return new ApperPoint(this.x, this.y);
  }

  set(x, y = null) {
    if (x.x !== undefined) {
      this.x = x.x;
      this.y = x.y;
      return this;
    }
    if (y === null) y = x;
    this.x = x;
    this.y = y;
    return this;
  }

  get mag() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  equals(x, y = null) {
    if (x.x !== undefined)
      return this.x === x.x && this.y === x.y;
    if (y === null) y = x;
    return this.x === x && this.y === y;
  }

  add(x, y = null) {
    if (x.x !== undefined)
      return new ApperPoint(this.x + x.x, this.y + x.y);
    if (y === null) y = x;
    return new ApperPoint(this.x + x, this.y + y);
  }

  sub(x, y = null) {
    if (x.x !== undefined)
      return new ApperPoint(this.x - x.x, this.y - x.y);
    if (y === null) y = x;
    return new ApperPoint(this.x - x, this.y - y);
  }

  mul(x, y = null) {
    if (x.x !== undefined)
      return new ApperPoint(this.x * x.x, this.y * x.y);
    if (y === null) y = x;
    return new ApperPoint(this.x * x, this.y * y);
  }

  div(x, y = null) {
    if (x.x !== undefined)
      return new ApperPoint(this.x / x.x, this.y / x.y);
    if (y === null) y = x;
    return new ApperPoint(this.x / x, this.y / y);
  }

  dot(x, y = null) {
    if (x.x !== undefined)
      return this.x * x.x + this.y * x.y;
    return this.x * x + this.y * y;
  }

  transform(matrix) {
    let p = matrix.transformPoint(new DOMPoint(this.x, this.y));
    return new ApperPoint(p.x, p.y);
  }
  
}


class ApperRect {

  #pos;
  #size;

  get x() { return this.#pos.x; }
  set x(x) { return this.#pos.x = x; }
  get y() { return this.#pos.y; }
  set y(y) { return this.#pos.y = y; }
  get w() { return this.#size.x; }
  set w(w) { return this.#size.x = w; }
  get h() { return this.#size.y; }
  set h(h) { return this.#size.y = h; }

  get X() { return this.#pos.x + this.#size.x; }
  get Y() { return this.#pos.y + this.#size.y; }

  get xy() { return new ApperPoint(this.x, this.y); }
  get Xy() { return new ApperPoint(this.x + this.w, this.y); }
  get xY() { return new ApperPoint(this.x, this.y + this.h); }
  get XY() { return new ApperPoint(this.x + this.w, this.y + this.h); }

  get normalized() {
    return new ApperRect(this.w < 0 ? this.x + this.w : this.x, this.h < 0 ? this.y + this.h : this.y, Math.abs(this.w), Math.abs(this.h))
  }

  constructor(x, y, w, h) {
    this.#pos = new ApperPoint(x, y);
    this.#size = new ApperPoint(w, h);
  }

  copy() {
    return new ApperRect(this.#pos.x, this.#pos.y, this.#size.x, this.#size.y);
  }

  contains(point) {
    let r = this.normalized;
    return r.x <= point.x && point.x <= r.x + r.w && r.y <= point.y && point.y <= r.y + r.h;
  }

  intersects(rect) {
    let r = this.normalized;
    return !(r.x + r.w <= rect.x || r.x >= rect.x + rect.w || r.y + r.h <= rect.y || r.y >= rect.y + rect.h)
  }

  transform(matrix) {
    let tl = this.#pos.transform(matrix);
    let br = this.#pos.add(this.#size).transform(matrix);
    return new ApperRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  }
  
}


class ApperToolbar {

  #app;
  #element;
  #toggler;
  #tools;
  #tool;
  #defaultTool;

  get app() { return this.#app; }
  get tools() { return this.#tools; }
  get tool() { return this.#tool; }
  set tool(toolID) { this.#tool = toolID; this.#update(); return toolID; }
  get defaultTool() { return this.#defaultTool; }
  set defaultTool(toolID) { return this.#defaultTool = toolID; }

  constructor(app, shown = true) {
    this.#app = app;
    
    this.#element = document.createElement("div");
    this.#element.className = "apper-toolbar";
    this.#app.element.appendChild(this.#element);
    if (shown) this.#app.element.classList.add("apper-toolbar-shown");

    this.#toggler = document.createElement("img");
    this.#toggler.className = "apper-toolbar-toggler";
    this.#toggler.src = "icons/toolbar-toggler.svg";
    this.#toggler.addEventListener("mousedown", event => toggleStyleClass(app.element, "apper-toolbar-shown"), {capture: false, passive: true});
    this.#toggler.addEventListener("touchstart", event => toggleStyleClass(app.element, "apper-toolbar-shown"), {capture: false, passive: true});
    this.#app.element.appendChild(this.#toggler);

    this.#tools = [];
    this.#defaultTool = 0;
    this.#tool = 0;
  }

  #update() {
    this.#tools.forEach(tool => tool.element.classList.remove("apper-button-selected"));
    this.#tools[this.#tool].element.classList.add("apper-button-selected");
    this.#app.update();
  }

  addTool(name, displayName, iconSrc, key = "", shortcut = "", isDefault = false) {
    let toolID = this.#tools.length;
    this.#tools.push({name, displayName, iconSrc, key, shortcut, isDefault});
    if (isDefault) this.#defaultTool = toolID;
    
    let button = document.createElement("div");
    button.className = "apper-toolbutton";
    if (this.#tool === toolID) button.classList.add("apper-button-selected");
    button.addEventListener("mousedown", event => {
      this.#tool = this.#tool === toolID ? this.#defaultTool : toolID;
      this.#update();
    }, {capture: false, passive: true});
    this.#element.appendChild(button);
    this.#tools[toolID].element = button;
    
    let icon = document.createElement("img");
    icon.src = iconSrc;
    button.appendChild(icon);
    
    let tooltip = document.createElement("div");
    tooltip.className = "apper-toolbutton-tip";
    tooltip.textContent = displayName;
    button.appendChild(tooltip);

    if (shortcut) {
      let hint = document.createElement("span");
      hint.textContent = shortcut;
      tooltip.appendChild(hint);
    }

    return this;
  }

  addSpacer() {
    let spacer = document.createElement("div");
    spacer.className = "apper-toolbar-spacer";
    this.#element.appendChild(spacer);

    return this;
  }
  
}


class ApperParagraph {

  #element;

  get element() { return this.#element; }
  get text() { return this.#element.textContent; }
  set text(content) { return this.#element.textContent = content; }

  constructor(content = "") {
    this.#element = document.createElement("p");
    this.#element.className = "apper-paragraph";
    this.#element.textContent = content;
  }

  show() {
    this.#element.style.display = "";

    return this;
  }

  hide() {
    this.#element.style.display = "none";

    return this;
  }

}


class ApperButton {

  #element;
  #name;
  
  get element() { return this.#element; }
  get name() { return this.#name; }
  get label() { return this.#element.textContent; }
  set label(text) { return this.#element.textContent = text; }

  get url() { return this.#element.href; }
  set url(content) { return this.#element.href = content; }
  get filename() { return this.#element.download; }
  set filename(content) { return this.#element.download = content; }

  constructor(label, url = null, filename = null) {
    this.#element = document.createElement("a");
    this.#element.className = "apper-button";
    if (url != null) this.#element.href = url;
    if (filename != null) this.#element.download = filename;
    this.#element.textContent = label;
    this.#element.addEventListener("click", event => {
      if (this.click !== undefined) this.click();
    }, {capture: false, passive: true});
  }

  onClick(callback) {
    this.click = callback;

    return this;
  }

  show() {
    this.#element.style.display = "";

    return this;
  }

  hide() {
    this.#element.style.display = "none";

    return this;
  }

}


class ApperCheckbox {

  #element;
  #name;
  #label;
  #input;

  get element() { return this.#element; }
  get name() { return this.#name; }
  get label() { return this.#label.textContent; }
  set label(text) { return this.#label.textContent = text; }
  get checked() { return this.#input.checked; }
  set checked(value) { return this.#input.checked = value; }

  constructor(name, label, init = false) {
    this.#element = document.createElement("label");
    this.#element.className = "apper-checkbox";
    this.#element.addEventListener("change", event => {
      if (this.change !== undefined) this.change(this.checked);
    }, {capture: false, passive: true});

    this.#label = document.createElement("span");
    this.#label.textContent = label;
    this.#element.appendChild(this.#label);
    
    this.#input = document.createElement("input");
    this.#input.type = "checkbox";
    this.#input.name = name;
    this.#input.checked = init;
    this.#element.appendChild(this.#input);
    
    let box = document.createElement("div");
    let check = document.createElement("img");
    check.src = "icons/checkbox-check.svg";
    box.appendChild(check);
    this.#element.appendChild(box);
  }

  onChange(callback) {
    this.change = callback;
    
    return this;
  }
  
}


class ApperHSpread {

  #element;
  #name;
  #label;
  #value;

  get element() { return this.#element; }
  get name() { return this.#name; }
  get label() { return this.#label.textContent; }
  set label(text) { return this.#label.textContent = text; }
  get value() { return this.#value; }
  
  set value(value) {
    document.querySelectorAll(`.apper-hspread input[name="${this.#name}"]`).forEach(input => {
      input.checked = input.value == value;
    });
    return this.#value = value;
  }

  constructor(name, label, icons, init = null) {
    this.#name = name;
    this.#value = init;
    
    this.#element = document.createElement("div");
    this.#element.className = "apper-hspread";

    this.#label = document.createElement("span");
    this.#label.textContent = label;
    this.#element.appendChild(this.#label);
    
    icons.forEach((iconSrc, value) => {
      let container = document.createElement("label");
      this.#element.appendChild(container);
      
      let input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = value;
      if (value === this.#value) input.checked = true;
      input.addEventListener("change", event => {
        this.#value = value;
        if (this.change !== undefined) this.change(value);
      }, {capture: false, passive: true});
      container.appendChild(input);
      
      let button = document.createElement("span");
      container.appendChild(button);
      
      let icon = document.createElement("img");
      icon.src = iconSrc;
      button.appendChild(icon);
    });
  }

  onChange(callback) {
    this.change = callback;
    
    return this;
  }
  
}


class ApperTextEditor {

  #element;
  #name;

  get element() { return this.#element; }
  get name() { return this.#name; }
  get text() { return this.#element.value; }
  set text(value) { this.#element.value = value; this.#update(); return value; }
  get valid() { return !this.#element.classList.contains("apper-invalid"); }
  set valid(value) { return value ? this.#element.classList.remove("apper-invalid") : this.#element.classList.add("apper-invalid"); }
  get editing() { return document.activeElement === this.#element; }

  constructor(name, placeholder = "", init = "") {
    this.#name = name;
    
    this.#element = document.createElement("textarea");
    this.#element.className = "apper-text-editor";
    this.#element.name = name;
    this.#element.placeholder = placeholder;
    this.#element.value = init;
    this.#element.spellcheck = false;
    this.#element.autocomplete = "off";
    this.#element.addEventListener("input", event => {
      if (this.change !== undefined) this.change(this.text);
      this.#update();
    }, {capture: false, passive: true});

    this.#update();
  }

  #update() {
    // Solution from DreamTeK on StackOverflow:
    // https://stackoverflow.com/questions/454202/creating-a-textarea-with-auto-resize
    this.#element.style.height = "auto";
    this.#element.style.height = this.#element.scrollHeight + "px";
  }

  onChange(callback) {
    this.change = callback;
    
    return this;
  }
  
}


class ApperButtonList {

  #element;
  #label;
  #buttons;

  get element() { return this.#element; }
  get label() { return this.#label.textContent; }
  set label(text) { return this.#label.textContent = text; }

  constructor(label, values, names) {
    this.#element = document.createElement("div");
    this.#element.className = "apper-button-list";

    this.#label = document.createElement("span");
    this.#label.textContent = label;
    this.#element.appendChild(this.#label);

    let list = document.createElement("div");
    this.#buttons = [];
    values.forEach((value, i) => {
      let button = document.createElement("button");
      button.value = value;
      button.textContent = names[i];
      button.addEventListener("click", event => {
        if (this.change !== undefined) this.change(value);
      }, {capture: false, passive: true});
      list.appendChild(button);
      this.#buttons.push(button);
    });
    this.#element.appendChild(list);
  }

  onChange(callback) {
    this.change = callback;
    
    return this;
  }
  
}


class ApperNumberInput {

  #element;
  #name;
  #label;
  #input;

  get element() { return this.#element; }
  get name() { return this.#name; }
  get label() { return this.#label.textContent; }
  set label(text) { return this.#label.textContent = text; }
  get value() { return +this.#input.value; }
  set value(value) { return this.#input.value = value; }

  constructor(name, label, icon = null, init = 0) {
    this.#element = document.createElement("label");
    this.#element.className = "apper-number-input";
    this.#element.addEventListener("change", event => {
      if (this.change !== undefined) this.change(this.value);
    }, {capture: false, passive: true});

    if (icon) {
      let iconElement = document.createElement("img");
      iconElement.src = icon;
      this.#element.appendChild(iconElement);
    }

    this.#label = document.createElement("span");
    this.#label.textContent = label;
    this.#element.appendChild(this.#label);
    
    this.#input = document.createElement("input");
    this.#input.type = "number";
    this.#input.name = name;
    this.#input.value = init;
    this.#element.appendChild(this.#input);
  }

  onChange(callback) {
    this.change = callback;
    
    return this;
  }
  
}


class ApperCanvasImage {

  #element;
  #label;
  #canvas;
  #ctx;

  get element() { return this.#element; }
  get label() { return this.#label.textContent; }
  set label(text) { return this.#label.textContent = text; }
  get canvas() { return this.#canvas; }
  get ctx() { return this.#ctx; }

  constructor(label) {
    this.#element = document.createElement("div");
    this.#element.className = "apper-canvas-image";

    this.#label = document.createElement("span");
    this.#label.textContent = label;
    this.#element.appendChild(this.#label);

    this.#canvas = document.createElement("canvas");
    this.#element.appendChild(this.#canvas);

    this.#ctx = this.#canvas.getContext("2d");
  }

  resize(w, h) {
    this.#canvas.width = w;
    this.#canvas.height = h;
  }

  show() {
    this.#element.style.display = "";

    return this;
  }

  hide() {
    this.#element.style.display = "none";

    return this;
  }

}


class ApperMenu {

  #app;
  #frame;
  #element;
  #title;

  get title() { return this.#title.textContent; }
  set title(text) { return this.#title.textContent = text; }
  
  constructor(app, title = "") {
    this.#app = app;

    this.#frame = document.createElement("div");
    this.#frame.className = "apper-menu";
    this.#app.element.appendChild(this.#frame);
    
    this.#element = document.createElement("div");
    this.#frame.appendChild(this.#element);
    
    this.#title = document.createElement("span");
    this.#title.className = "apper-menu-title";
    this.#title.textContent = title;
    this.#element.appendChild(this.#title);
  }

  show() {
    this.#frame.classList.add("apper-shown");
    
    return this;
  }

  hide() {
    this.#frame.classList.remove("apper-shown");
    
    return this;
  }

  add(object) {
    this.#element.appendChild(object.element);
    
    return this;
  }

  addSeparator() {
    let separator = document.createElement("span");
    separator.className = "apper-menu-separator";
    this.#element.appendChild(separator);
    
    return this;
  }

  addText(text) {
    let container = document.createElement("span");
    container.textContent = text;
    this.#element.appendChild(container);

    return this;
  }
  
}


class ApperApplication {

  #element;
  #canvas;
  #title;
  #defaultTitle;
  #toolbar;
  #ctx;
  #transform;
  #cursorPos;
  #menus;
  #message;
  #messageTimer;

  get element() { return this.#element; }
  get canvas() { return this.#canvas; }
  get title() { return this.#title.value; }
  set title(text) { this.#title.value = text; this.#updateTitleWidth(); return this.#title.value; }
  get defaultTitle() { return this.#defaultTitle; }
  set defaultTitle(text) { if (!this.title) this.title = text; this.#updateTitleWidth(); return this.#defaultTitle = text; }
  get toolbar() { return this.#toolbar; }
  get ctx() { return this.#ctx; }
  get transform() { return this.#transform; }
  set transform(matrix) { return this.#transform = matrix; }
  get cursorPos() { return this.#cursorPos.copy(); }
  get pixelRatio() { return window.devicePixelRatio; }

  constructor(element) {
    this.#element = element;
    this.#element.classList.add("apper-application");
    
    this.#canvas = document.createElement("canvas");
    this.#canvas.width = 0;
    this.#canvas.height = 0;
    this.#element.appendChild(this.#canvas);

    this.#title = document.createElement("input");
    this.#title.className = "apper-title";
    this.#title.type = "text";
    this.#defaultTitle = "";
    this.#title.value = "";
    this.#title.spellcheck = false;
    this.#title.autocomplete = "off";
    this.#title.addEventListener("input", event => {
      this.#updateTitleWidth();
    }, {capture: false, passive: true});
    this.#title.addEventListener("blur", event => {
      if (!this.title) this.title = this.defaultTitle;
      this.#updateTitleWidth();
    }, {capture: false, passive: true});
    this.#title.addEventListener("keypress", event => {
      if (event.code.toLowerCase() === "enter") this.#title.blur();
    }, {capture: false, passive: true});
    this.#element.appendChild(this.#title);
    this.#updateTitleWidth();

    this.#message = document.createElement("div");
    this.#message.className = "apper-message";
    this.#element.appendChild(this.#message);

    this.#messageTimer = null;
    this.#toolbar = null;
    this.#menus = [];

    this.#ctx = this.#canvas.getContext("2d");

    window.addEventListener("resize", this.#rawWindowResize.bind(this), {capture: false, passive: true});
    this.#canvas.addEventListener("mousedown", this.#rawMouseDown.bind(this), {capture: false, passive: false});
    document.addEventListener("mousemove", this.#rawMouseMove.bind(this), {capture: false, passive: true});
    document.addEventListener("mouseup", this.#rawMouseUp.bind(this), {capture: false, passive: true});
    this.#canvas.addEventListener("touchstart", this.#rawMouseDown.bind(this), {capture: false, passive: false});
    document.addEventListener("touchmove", this.#rawMouseMove.bind(this), {capture: false, passive: true});
    document.addEventListener("touchend", this.#rawMouseUp.bind(this), {capture: false, passive: true});
    this.#canvas.addEventListener("wheel", this.#rawScrollWheel.bind(this), {capture: true, passive: false});
    document.addEventListener("keydown", this.#rawKeyDown.bind(this), {capture: true, passive: false});

    this.#transform = this.ctx.getTransform();
    this.#cursorPos = new ApperPoint();

    this.#rawWindowResize();
  }

  #updateTitleWidth() {
    this.#title.style.width = `${measureText(this.title, this.#title) + 12}px`;  // For some reason, setting this.#title.style.width doesn't work
  }

  enableToolbar() {
    this.#toolbar = new ApperToolbar(this);
    return this.#toolbar;
  }

  addMenu(menuID, title) {
    return this.#menus[menuID] = new ApperMenu(this, title);
  }

  menu(menuID) {
    return this.#menus[menuID];
  }

  showMessage(text, error = false) {
    this.#message.textContent = text;
    if (error) this.#message.classList.add("apper-error");
    else this.#message.classList.remove("apper-error");
    this.#message.classList.add("apper-shown");
    if (this.#messageTimer !== null) window.clearTimeout(this.#messageTimer);
    this.#messageTimer = window.setTimeout(() => {
      this.#message.classList.remove("apper-shown");
      this.#messageTimer = null;
    }, 10000);
  }

  getScreenPos(worldPos) {
    return worldPos.transform(this.#transform);
  }

  getWorldPos(screenPos) {
    return screenPos.transform(this.#transform.inverse());
  }

  update() {
    this.#ctx.resetTransform();
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    this.#ctx.setTransform(this.#transform);

    if (this.render !== undefined) this.render();
  }

  #rawWindowResize() {
    const move = new ApperPoint(0.5 * (this.#element.clientWidth * this.pixelRatio - this.#canvas.width), 0.5 * (this.#element.clientHeight * this.pixelRatio - this.#canvas.height));
    
    this.#canvas.width = this.#element.clientWidth * this.pixelRatio;
    this.#canvas.height = this.#element.clientHeight * this.pixelRatio;
    
    this.#transform.translateSelf(move.x, move.y);
    const center = this.getWorldPos(new ApperPoint(0.5 * this.#canvas.width, 0.5 * this.#canvas.height));
    this.#transform.scaleSelf(this.pixelRatio / this.#transform.a, this.pixelRatio / this.#transform.d, 1, center.x, center.y);

    const info = {
      width: this.#element.clientWidth,
      height: this.#element.clientHeight
    };

    if (this.windowResize !== undefined) this.windowResize(info);
    
    this.update();
  }

  #rawMouseDown(event) {
    const isTouch = event.touches !== undefined;
    const screenPos = new ApperPoint(
      (isTouch ? event.touches[0].pageX - this.element.offsetLeft : event.pageX - this.element.offsetLeft) * this.pixelRatio,
      (isTouch ? event.touches[0].pageY - this.element.offsetTop : event.pageY - this.element.offsetTop) * this.pixelRatio);

    const info = {
      isTouch,
      screenPos,
      worldPos: this.getWorldPos(screenPos),
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      leftBtn: isTouch ? true : new Boolean(event.buttons & 1),
      rightBtn: isTouch ? false : new Boolean(event.buttons & 2),
      middleBtn: isTouch ? false : new Boolean(event.buttons & 4),
      button: isTouch ? 0 : event.button
    };

    this.#title.blur();
    this.#cursorPos.set(screenPos);

    if (this.mouseDown === undefined || !this.mouseDown(info)) return;

    event.preventDefault();
    event.stopPropagation();

    this.update();
  }

  #rawMouseMove(event) {
    const isTouch = event.touches !== undefined;
    const screenPos = new ApperPoint(
      (isTouch ? event.touches[0].pageX - this.element.offsetLeft : event.pageX - this.element.offsetLeft) * this.pixelRatio,
      (isTouch ? event.touches[0].pageY - this.element.offsetTop : event.pageY - this.element.offsetTop) * this.pixelRatio);

    const info = {
      isTouch,
      onCanvas: event.target === this.#canvas,
      screenPos,
      worldPos: this.getWorldPos(screenPos),
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      leftBtn: isTouch ? true : new Boolean(event.buttons & 1),
      rightBtn: isTouch ? false : new Boolean(event.buttons & 2),
      middleBtn: isTouch ? false : new Boolean(event.buttons & 4)
    };
    
    this.#cursorPos.set(info.onCanvas ? screenPos : 0);

    if (this.mouseMove === undefined || !this.mouseMove(info)) return;

    this.update();
  }

  #rawMouseUp(event) {
    const isTouch = event.touches !== undefined;

    const info = {
      isTouch,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      leftBtn: isTouch ? true : new Boolean(event.buttons & 1),
      rightBtn: isTouch ? false : new Boolean(event.buttons & 2),
      middleBtn: isTouch ? false : new Boolean(event.buttons & 4),
      button: isTouch ? 0 : event.button
    };

    if (this.mouseUp === undefined || !this.mouseUp(info)) return;

    this.update();
  }

  #rawScrollWheel(event) {
    const info = {
      dx: event.deltaX,
      dy: event.deltaY
    };
    
    if (this.scrollWheel === undefined || !this.scrollWheel(info)) return;
    
    event.preventDefault();
    event.stopPropagation();

    this.update();
  }

  #rawKeyDown(event) {
    if (event.target !== document.body) return;
    
    const info = {
      key: event.code.toLowerCase()
    };
    
    if (this.keyDown === undefined || !this.keyDown(info)) return;

    event.preventDefault();
    event.stopPropagation();
    
    this.update();
  }
  
}
