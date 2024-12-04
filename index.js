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
  #transition = {
    neutral: {
      entry: null
    }
  };
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
    if (!this.id)
      this.id = target;
    this.target = target;
    this.valid = valid;
    this.tag = tag;
    this.effect = effect;
    this.title = title;
    if (transition && typeof transition === "string")
      this.#transition.neutral.entry = transition;
    else if (transition && typeof transition == "object")
      this.#transition = { ...this.#transition, ...transition };
  }
  transition(tag = null, context = null) {
    if (tag === null && context === null)
      return this.#transition.neutral.entry;
    if (this.#transition[tag])
      return this.#transition[tag][context] || null;
    return null;
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
      switch (type(choice)) {
        case "Choice":
          this.#choices[choice.target] = choice;
          return this.#choices;
        case "String":
          this.#choices[choice] = new Choice({ target: choice });
          return this.#choices;
        case "Object":
          const newChoice = new Choice(choice);
          this.#choices[newChoice.id] = newChoice;
          return this.#choices;
        default:
          throw Error("choice is not supported type");
      }
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
    add: (observer) => {
      this.observers.add.push(observer);
    },
    load: (observer) => {
      this.observers.load.push(observer);
    }
  };
  notify = {
    add: (data) => {
      this.observers.add.forEach((observer) => observer(data));
    },
    load: (data = null) => {
      this.observers.load.forEach((observer) => observer(data));
    }
  };
  reset(start) {
    this.book = [[]];
    this.book[0].push(start);
    this.page = 0;
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
    title = "A Story"
  }) {
    super();
    this.scenes = {};
    this.load.scenes(scenes);
    this.start = start;
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
  interpret(effect) {
    if (type(effect) !== "Array")
      return null;
    for (const str of effect) {
      const command = str.split(" ");
      const op = command[0];
      switch (op) {
        case "add":
          const add_prop = command[1];
          if (add_prop === "tag") {
            for (const tag2 of command.slice(2))
              if (!this[add_prop].includes(tag2))
                this[add_prop].push(tag2);
          } else if (add_prop === "page") {
            this.book.page += command[2] ?? 1;
          }
          break;
        case "del":
          const del_prop = command[1];
          this[del_prop] = this[del_prop].filter((index) => !(index in command.slice(2)));
          break;
        case "reset":
          this.reset();
          break;
        case "stay":
          this.book.page--;
          break;
      }
    }
    return this;
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
      return this.node;
    }
    const new_node = this.scenes[node_choice.target];
    if (type(new_node) == "Node") {
      this.book.page++;
      this.interpret(node_choice.effect);
      this.interpret(new_node.effect);
      this.book.addParagraph([
        ["transition", node_choice.transition()],
        ["body", new_node.body]
      ]);
      this.node = new_node;
    }
    if (this.node.title)
      this.title = this.node.title;
    this.notify(this);
    this.save();
    return this.node;
  }
  load = {
    scenes: (scenes) => {
      const scene_type = type(scenes);
      if (scene_type === "Object") {
        for (const scene in scenes) {
          if (scenes[scene].id)
            this.scenes[scene] = new Node({
              id: scenes[scene].id,
              ...scenes[scene]
            });
          else
            this.scenes[scene] = new Node({ ...scene });
        }
      } else if (scene_type === "Array") {
        for (const scene of scenes) {
          if (!scene.id)
            throw Error("scene doesn't contain id");
          if (type(scene.id) !== "String")
            throw Error("id isn't string.");
          this.scenes[scene.id] = new Node({
            id: scenes[scene].id,
            ...scenes[scene]
          });
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
      node: this.node.id
    }));
  }
  reset() {
    this.tag = [];
    this.node = this.scenes[this.start];
    this.title = this.node.title ?? "A story";
    this.book.reset([["body", this.node.body]]);
    this.save();
    this.notify(this);
    this.book.notify.load(this.book);
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
    this.header = tag("div", {
      id: "header",
      children: [this.title, this.reset]
    });
    if (engine.title && engine.title)
      this.title.innerText = engine.node.title;
    else
      this.title.innerText = "A Story";
    this.tags = tag("aside", { id: "tags" });
    this.tag_header = tag("h3", { id: "tag_header", textContent: "tags" });
    this.tag_container = tag("div", {
      id: "tag_container",
      children: [this.tag_header, this.tags]
    });
    this.body = tag("article", { id: "body" });
    this.main = tag("main", { children: [this.body, this.tag_container] });
    this.base = tag("div", {
      children: [this.header, this.main, this.optionBase]
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
      preview.textContent = choice.transition();
      const label_container = document.createElement("div");
      const preview_container = document.createElement("div");
      label_container.appendChild(label);
      label_container.className = "labelContainer";
      preview_container.appendChild(preview);
      preview_container.className = "previewContainer";
      div.appendChild(label_container);
      div.appendChild(preview_container);
      this.optionBase.appendChild(div);
      div.dataset.option = index;
      index++;
    }
    this.tags.innerHTML = "";
    for (const player_tag of this.engine.tag) {
      this.tags.appendChild(tag("p", { textContent: player_tag }));
    }
    this.title.innerText = engine.title;
    window.scrollTo(0, this.body.scrollHeight);
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
