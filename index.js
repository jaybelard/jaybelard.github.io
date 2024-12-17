// src/models/Model.js
class Model {
  constructor(observers = []) {
    this.observers = observers;
  }
  subscribe(observer) {
    this.observers.push(observer);
  }
  unsubscribe(func) {
    this.observers = this.observers.filter((observer) => observer !== func(observer));
  }
  notify(data) {
    this.observers.forEach((observer) => {
      observer(data);
    });
  }
}

// src/models/Choice.js
class Choice {
  constructor({
    id = null,
    target = null,
    transition = null,
    valid = true,
    tag = [],
    effect = {},
    title = null
  }) {
    this.id = id;
    if (!id && !target)
      throw Error("Choice needs an id, or a unique target");
    if (!this.id)
      this.id = target;
    this.target = target;
    this.valid = valid;
    this.tag = tag;
    this.effect = effect;
    this.title = title;
    this.transition = transition;
  }
}

// src/util.js
function type(obj) {
  if (obj === null)
    return "Null";
  let obj_type = typeof obj;
  if (obj_type === "object")
    return obj.constructor.name;
  return {
    undefined: "Undefined",
    string: "String",
    boolean: "Boolean",
    number: "Number",
    bigint: "BigInt",
    symbol: "Symbol",
    function: "Function",
    object: "Object"
  }[obj_type] ?? null;
}
function tag(element = "div", { id = null, className = null, children = [], textContent = null }) {
  const el = document.createElement(element);
  if (id)
    el.id = id;
  if (className)
    el.className = className;
  if (textContent)
    el.textContent = textContent;
  for (const child of children) {
    el.appendChild(child);
  }
  return el;
}

// src/models/Node.js
class Node {
  #choices = {};
  constructor({
    id = null,
    title = null,
    body = null,
    choices = [],
    effect = null
  }) {
    this.id = id;
    this.title = title;
    this.body = body;
    this.effect = effect;
    for (const choice of choices)
      this.add.choice(choice);
  }
  choices(key = null) {
    switch (type(key)) {
      case "String":
        return this.#choices[key];
      case "Array":
        return Object.fromEntries(Object.entries(this.#choices).filter((i) => (i in key)));
      case "Null":
        return this.#choices;
      default:
        throw Error("key type not supported");
    }
  }
  add = {
    choice: (choice) => {
      const newChoice = new Choice(choice);
      this.#choices[newChoice.id] = newChoice;
      return this.#choices;
    }
  };
}

// src/models/Book.js
class Book extends Model {
  constructor({ book = [], page = 0 }) {
    super({});
    this.observers.add = [];
    this.observers.load = [];
    this.book = book;
    this.page = page;
  }
  addParagraph(paragraph) {
    if (!this.book[this.page])
      this.book[this.page] = [];
    this.book[this.page].push(paragraph);
    this.notify.add(paragraph);
  }
  subscribe = {
    add: (observer) => this.observers.add.push(observer),
    load: (observer) => this.observers.load.push(observer)
  };
  notify = {
    add: (data = null) => this.observers.add.forEach((observer) => observer(data)),
    load: (data = null) => this.observers.load.forEach((observer) => observer(data))
  };
  reset(start) {
    this.book = [[]];
    this.book[0].push(start);
    this.page = 0;
  }
}

// src/models/CommandProcessor.js
class AddTag {
  constructor(tags = []) {
    this.tags = tags;
  }
  do(engine) {
    for (const tag2 of this.tags) {
      if (!engine["tag"].includes(tag2))
        engine["tag"].push(tag2);
    }
    return this;
  }
  undo(engine) {
    engine["tag"] = engine["tag"].filter((index) => !this.tags.includes(index));
  }
}

class DeleteTag {
  constructor(tags = []) {
    this.tags = tags;
  }
  do(engine) {
    engine["tag"] = engine["tag"].filter((index) => !this.tags.includes(index));
    return this;
  }
  undo(engine) {
    for (const tag2 of this.tags) {
      if (engine["tag"].includes(tag2))
        engine["tag"].push(tag2);
    }
  }
}

class AddPage {
  constructor(amount) {
    this.amount = amount;
  }
  do(engine) {
    engine.book.page += this.amount;
    return this;
  }
  undo(engine) {
    engine.book.book.pop();
    engine.book.page -= this.amount;
  }
}

class CommandProcessor {
  constructor({ engine = null, history = [] }) {
    this.engine = engine;
    this.history = history;
  }
  interpret(statement) {
    if (type(statement) !== "Array")
      return null;
    const bundle = [];
    for (const line of statement) {
      const tokens = line.split(" ");
      const command = tokens[0];
      const target = tokens[1] ?? null;
      switch (command) {
        case "add":
          if (target === "tag")
            bundle.push(new AddTag(tokens.splice(2)).do(this.engine));
          if (target === "page")
            bundle.push(new AddPage(tokens[2] ?? 1).do(this.engine));
          break;
        case "del":
          if (target === "tag")
            bundle.push(new DeleteTag(tokens.splice(2)).do(this.engine));
          break;
        case "reset":
          this.engine.reset();
          break;
        case "stay":
          this.engine.book.page--;
          break;
      }
    }
    this.history.push(bundle);
    if (this.history.length > 15) {
      this.history.shift();
    }
    return this;
  }
  undo() {
    const commands = this.history.pop();
    for (const command of commands) {
      command.undo(this.engine);
    }
  }
  reset() {
    this.history = [];
  }
}

// src/models/Engine.js
class Engine extends Model {
  constructor({
    scenes = {},
    node = null,
    tag: tag2 = [],
    book = [],
    page = 0,
    start = "start",
    title = "A Story",
    history = [],
    commandHistory = []
  }) {
    super();
    this.scenes = {};
    this.load.scenes(scenes);
    this.start = start;
    this.history = history;
    this.processor = new CommandProcessor({
      engine: this,
      history: commandHistory
    });
    this.node = this.scenes[node] ?? this.scenes[start];
    if (this.node && this.node.title)
      this.title = this.node.title;
    else
      this.title = title;
    this.tag = tag2;
    this.book = new Book({ book, page });
    if (!this.book.book[this.book.page])
      this.book.addParagraph([["body", this.node.body]]);
  }
  choicesTag(tags) {
    switch (type(tags)) {
      case "String":
        const choices = {};
        for (const choice of this.choices) {
          if (tags in choice.tags)
            choices.push(choice.id);
        }
        return choices ?? null;
    }
  }
  interpret(statement) {
    this.processor.interpret(statement);
  }
  undo() {
    this.processor.undo();
    this.node = this.history.pop();
    this.notify(this);
    this.book.notify.load(this.book);
    this.save();
  }
  choices() {
    let choices = {};
    let node_choices = this.node.choices();
    for (const key in node_choices) {
      if (node_choices[key].tag.length) {
        for (const tag2 of node_choices[key].tag) {
          if (this.tag.includes(tag2))
            choices[key] = node_choices[key];
        }
      } else
        choices[key] = node_choices[key];
    }
    return choices;
  }
  choose(choice) {
    const node_choice = this.node.choices(choice);
    if (type(node_choice.target) === "Null") {
      this.interpret(node_choice.effect);
      this.history.push(this.node);
      return this.node;
    }
    const new_node = this.scenes[node_choice.target];
    if (type(new_node) == "Node") {
      const bundle = [];
      if (type(node_choice.effect) === "Array")
        bundle.push(...node_choice.effect);
      if (type(new_node.effect) === "Array")
        bundle.push(...new_node.effect);
      this.interpret([...bundle, "add page"]);
      this.book.addParagraph([
        ["transition", node_choice.transition],
        ["body", new_node.body]
      ]);
      this.history.push(this.node);
      this.node = new_node;
    }
    if (this.history.length > 4) {
      this.history.shift();
    }
    if (this.node.title)
      this.title = this.node.title;
    this.notify(this);
    this.save();
    return this.node;
  }
  load = {
    scenes: (scenes) => {
      if (type(scenes) === "Object") {
        for (const scene in scenes) {
          if (scenes[scene].id)
            this.scenes[scene] = new Node({
              id: scenes[scene].id,
              ...scenes[scene]
            });
          else
            this.scenes[scene] = new Node({ ...scene });
        }
      }
    }
  };
  async save() {
    localStorage.setItem("persist", JSON.stringify({
      book: this.book.book,
      page: this.book.page,
      tag: this.tag,
      title: this.title,
      node: this.node.id,
      history: this.history,
      commandHistory: this.processor.history
    }));
  }
  reset() {
    this.tag = [];
    this.node = this.scenes[this.start];
    this.title = this.node.title ?? "A story";
    this.history = [];
    this.book.reset([["body", this.node.body]]);
    this.save();
    this.notify(this);
    this.book.notify.load(this.book);
    this.processor.reset();
  }
}

// src/views/BookView.js
class BookView {
  constructor({ root = null, book = null, page = 0 }) {
    this.root = root;
    this.book = book;
    this.page = page;
    this.book.subscribe.add(this.addParagraph.bind(this));
    this.book.subscribe.load(this.render.bind(this));
    this.render();
  }
  render() {
    this.root.innerHTML = "";
    for (const paragraph of this.book.book[this.book.page]) {
      this.addParagraph(paragraph);
    }
  }
  addParagraph(paragraph) {
    if (this.page !== this.book.page) {
      this.root.innerHTML = "";
      this.page = this.book.page;
    }
    let paraHTML = document.createElement("div");
    let transition_next = "";
    for (const sentence of paragraph) {
      if (sentence[0] == "transition") {
        if (sentence[1].endsWith("\n")) {
          paraHTML.innerHTML += `<p class="transition">${sentence[1]}</p>`;
        } else {
          transition_next = `<span class="transition">${sentence[1]}</span> `;
        }
      } else if (sentence[0] == "body") {
        paraHTML.innerHTML += sentence[1].split("\n").map((element, index) => {
          if (index)
            return `<p>${element}</p>`;
          else
            return `<p>${transition_next}${element}</p>`;
        }).join("");
      }
    }
    [...paraHTML.children].forEach((child) => this.root.appendChild(child));
  }
}

// src/views/EngineView.js
class EngineView {
  options = [];
  constructor(root = null, engine = null) {
    this.root = root;
    if (!root)
      console.err("No root element specified to attach main view");
    this.engine = engine;
    this.body = document.createElement("main");
    this.optionBase = document.createElement("div");
    this.optionBase.id = "optionBase";
    this.title = document.createElement("h2");
    this.reset = tag("button", {
      id: "reset",
      textContent: "Reset",
      className: "label"
    });
    this.reset.onclick = (event) => {
      this.engine.reset();
    };
    this.back = tag("button", {
      id: "back",
      textContent: "Back",
      className: "label"
    });
    this.back.onclick = (event) => {
      this.engine.undo();
    };
    this.buttons = tag("div", {
      id: "button_container",
      children: [this.back, this.reset]
    });
    this.header = tag("div", {
      id: "header",
      children: [this.title, this.buttons]
    });
    if (engine.title && engine.title)
      this.title.innerText = engine.node.title;
    else
      this.title.innerText = "A Story";
    this.tags = tag("aside", { id: "tags" });
    this.tag_header = tag("h3", { id: "tag_header", textContent: "tags:" });
    this.tag_container = tag("div", {
      id: "tag_container",
      children: [this.tags]
    });
    this.body = tag("article", { id: "body" });
    this.main = tag("main", { children: [this.body] });
    this.base = tag("div", {
      children: [this.header, this.tag_container, this.main, this.optionBase]
    });
    this.root.appendChild(this.base);
    document.addEventListener("keydown", (event) => {
      let opt = document.querySelector(`[data-option='${event.key}']`);
      if (opt)
        opt.click();
    });
    this.render.bind(this);
    if (this.engine) {
      this.book = new BookView({ root: this.body, book: this.engine.book });
      this.engine.subscribe(this.render.bind(this));
      this.render(this.engine);
    }
  }
  render(engine) {
    const choices = engine.choices();
    let index = 1;
    this.optionBase.innerHTML = "";
    for (const key in choices) {
      const choice = choices[key];
      const div = document.createElement("div");
      div.className = "option";
      div.tabIndex = 0;
      div.addEventListener("click", () => engine.choose(choice.id));
      div.role = "button";
      const label = document.createElement("p");
      label.className = "label";
      label.innerHTML = `<span>${index}</span> <span>${choice.title}</span>`;
      const preview = document.createElement("p");
      preview.className = "preview";
      preview.textContent = choice.transition;
      const label_container = document.createElement("div");
      const preview_container = document.createElement("div");
      label_container.appendChild(label);
      label_container.className = "labelContainer";
      preview_container.appendChild(preview);
      preview_container.className = "previewContainer";
      div.appendChild(label_container);
      div.appendChild(preview_container);
      this.optionBase.appendChild(div);
      for (const choice_tag of choice.tag) {
        div.appendChild(tag("span", { className: "optionTag", textContent: choice_tag }));
      }
      div.dataset.option = index;
      index++;
    }
    this.tags.innerHTML = "";
    for (const player_tag of this.engine.tag) {
      this.tags.appendChild(tag("span", { className: "tag", textContent: player_tag }));
    }
    if (engine.history.length == 0)
      this.back.style.display = "none";
    else
      this.back.style.display = "revert";
    this.title.innerText = engine.title;
    window.scrollTo(0, 0);
  }
}

// src/index.js
var engine = null;
var view = null;
fetch("./scenes.json").then((response) => response.text()).then((body) => {
  const data = JSON.parse(body);
  const save = JSON.parse(localStorage.getItem("persist"));
  if (save) {
    engine = new Engine({
      scenes: data,
      ...save
    });
  } else {
    engine = new Engine({
      scenes: data,
      node: "start"
    });
  }
  view = new EngineView(document.querySelector("body"), engine);
});
