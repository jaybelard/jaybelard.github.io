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
    if (target === null)
      throw Error(`target is missing`);
    if (typeof target !== "string")
      throw Error(`target is not type string`);
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

// src/models/Engine.js
class Engine extends Model {
  constructor({ scenes = {}, start = null }) {
    super();
    this.scenes = {};
    this.load.scenes(scenes);
    this.node = this.scenes[start];
    this.tag = [];
    this.book = [];
    if (this.node)
      this.book = [[[["body", this.node.body]]]];
    this.page = 0;
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
          if (type(this[add_prop]) === "Array") {
            command.slice(2).forEach((tag) => {
              if (!this[add_prop].includes(tag))
                this[add_prop].push(tag);
            });
          } else if (type(this[add_prop]) === "Number") {
            this[add_prop] += command[2] ?? 1;
          }
          break;
        case "del":
          const del_prop = command[1];
          this[del_prop] = this[del_prop].filter((index) => !(index in command[op].slice(2)));
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
        for (const tag of node_choices[key].tag) {
          if (this.tag.includes(tag))
            choices[key] = node_choices[key];
        }
      } else
        choices[key] = node_choices[key];
    }
    return choices;
  }
  choose(choice) {
    const node_choice = this.node.choices(choice);
    const new_node = this.scenes[node_choice.target];
    if (type(new_node) == "Node") {
      this.interpret(node_choice.effect);
      this.interpret(new_node.effect);
      if (!this.book[this.page])
        this.book[this.page] = [];
      this.book[this.page].push([
        ["transition", node_choice.transition()],
        ["body", new_node.body]
      ]);
      this.node = new_node;
    }
    this.notify(this);
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
}

// src/views/EngineView.js
class EngineView {
  options = [];
  constructor(root = null, engine = null) {
    this.root = root;
    if (!root)
      console.err("No root element specified to attach main view");
    this.base = document.createElement("div");
    this.root.appendChild(this.base);
    this.engine = engine;
    this.body = document.createElement("div");
    this.optionBase = document.createElement("div");
    this.optionBase.id = "optionBase";
    this.title = document.createElement("h2");
    if (engine.node && engine.node.title)
      this.title.innerText = engine.node.title;
    else
      this.title.innerText = "A Story";
    this.base.appendChild(this.title);
    this.base.appendChild(this.body);
    this.base.appendChild(this.optionBase);
    this.body.id = "body";
    document.addEventListener("keydown", (event) => {
      let opt = document.querySelector(`[data-option='${event.key}']`);
      if (opt)
        opt.click();
    });
    this.render.bind(this);
    if (this.engine) {
      this.engine.subscribe(this.render.bind(this));
      this.render(this.engine);
    }
  }
  render(engine) {
    if (engine.book && engine.book[engine.page]) {
      this.body.innerHTML = "";
      for (const paragraph of engine.book[engine.page]) {
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
            paraHTML.innerHTML += sentence[1].split("\n").map((element, index2) => {
              if (index2)
                return `<p>${element}</p>`;
              else
                return `<p>${transition_next}${element}`;
            }).join("");
          }
        }
        this.body.innerHTML += paraHTML.innerHTML;
      }
      window.scrollTo(0, this.body.scrollHeight);
    }
    const choices = engine.choices();
    let index = 1;
    this.optionBase.innerHTML = "";
    for (const key in choices) {
      const choice = choices[key];
      const div = document.createElement("div");
      div.className = "option";
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
      div.addEventListener("click", () => engine.choose(choice.id));
      index++;
    }
    if (engine.node.title)
      this.title.innerText = engine.node.title;
  }
}

// src/index.js
var engine = null;
var view = null;
fetch("./scenes.json").then((response) => response.text()).then((body) => {
  const data = JSON.parse(body);
  engine = new Engine({ scenes: data, start: "start" });
  view = new EngineView(document.querySelector("body"), engine);
});
