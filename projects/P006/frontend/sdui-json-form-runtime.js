const ASSET_BASE = "/projects/P006/assets";
const SCREEN_REGISTRY_ASSET = "screens/screen-registry.json";
const RUNTIME_ID = "p006-sdui-json-form-v1";

let mounting = false;
let mountedMain = null;
let screenRegistryPromise = null;

function element(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "className") node.className = String(value);
    else if (key === "text") node.textContent = String(value);
    else if (key.startsWith("data-")) node.setAttribute(key, String(value));
    else if (key === "checked") node.checked = Boolean(value);
    else if (key === "disabled") node.disabled = Boolean(value);
    else node.setAttribute(key, String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child instanceof Node) node.append(child);
    else if (child !== undefined && child !== null) node.append(document.createTextNode(String(child)));
  }
  return node;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function getPath(value, path) {
  if (!path) return value;
  return String(path).split(".").reduce((current, key) => current == null ? undefined : current[key], value);
}

function setPath(value, path, next) {
  const parts = String(path).split(".");
  let target = value;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) target[part] = next;
    else {
      const followingIsIndex = /^\d+$/.test(parts[index + 1]);
      if (target[part] == null) target[part] = followingIsIndex ? [] : {};
      target = target[part];
    }
  });
}

function templateValue(value, context) {
  if (Array.isArray(value)) return value.map((item) => templateValue(item, context));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, templateValue(item, context)]));
  }
  if (typeof value !== "string") return value;
  if (value === "$form") return clone(context.form);
  const exact = value.match(/^\$(steps|load)(?:\.(.+))?$/);
  if (exact) return clone(getPath(context[exact[1]], exact[2] || ""));
  return value.replace(/\$\{(form|steps|load)\.([^}]+)}/g, (_match, root, path) => {
    const resolved = getPath(context[root], path);
    return resolved == null ? "-" : String(resolved);
  });
}

async function fetchJson(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    cache: "no-store",
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.status || `HTTP ${response.status}`);
  return body;
}

async function fetchAsset(path) {
  const separator = path.includes("?") ? "&" : "?";
  return fetchJson(`${ASSET_BASE}/${path}${separator}_sdui=${Date.now()}`);
}

function applyTheme(theme) {
  for (const [key, value] of Object.entries(theme.tokens || {})) {
    if (/^--sdui-[a-z0-9-]+$/.test(key) && typeof value === "string") {
      document.documentElement.style.setProperty(key, value);
    }
  }
}

function getScreenRegistry() {
  if (!screenRegistryPromise) screenRegistryPromise = fetchAsset(SCREEN_REGISTRY_ASSET);
  return screenRegistryPromise;
}

function injectNavigation(screenRegistry) {
  const nav = document.querySelector(".side");
  if (!nav) return;
  const entries = [...(screenRegistry.screens || [])]
    .filter((entry) => entry.navigation?.visible !== false)
    .sort((a, b) => (a.navigation?.order || 0) - (b.navigation?.order || 0));
  for (const entry of entries) {
    let link = nav.querySelector(`[data-sdui-nav="${CSS.escape(entry.screenId)}"]`);
    if (!link) {
      link = element("a", {
        href: entry.route,
        "data-sdui-nav": entry.screenId,
        text: entry.navigation?.label || entry.screenId
      });
      nav.append(link);
    }
    link.classList.toggle("active", location.pathname === entry.route);
  }
}

function validateContract(definition, registry) {
  const errors = [];
  if (definition.schemaVersion !== "1.0") errors.push("schemaVersion must be 1.0");
  if (!definition.screenId || !definition.menuCode || !definition.pageId) errors.push("screen identity is incomplete");
  if (!Array.isArray(definition.nodes) || !definition.nodes.length) errors.push("nodes must not be empty");
  const componentIndex = new Map((registry.components || []).map((item) => [item.componentId, item]));
  for (const node of definition.nodes || []) {
    const component = componentIndex.get(node.componentId);
    if (!component) errors.push(`unregistered component: ${node.componentId}`);
    else if (component.componentType !== node.componentType) errors.push(`component type mismatch: ${node.componentId}`);
  }
  return errors;
}

function rolesFrom(payload) {
  return Array.isArray(payload?.actor?.roles) ? payload.actor.roles.map(String) : [];
}

function permissionsFrom(payload) {
  return Array.isArray(payload?.actor?.permissions) ? payload.actor.permissions.map(String) : [];
}

async function resolveAuthority(authority) {
  const payload = await fetchJson(authority.source);
  const roles = rolesFrom(payload);
  const permissions = permissionsFrom(payload);
  const allowedRoles = Array.isArray(authority.roleAny) ? authority.roleAny : [];
  const requiredPermissions = Array.isArray(authority.permissions) ? authority.permissions : [];
  const roleAllowed = allowedRoles.length === 0 || allowedRoles.some((role) => roles.includes(role));
  const permissionsAllowed = requiredPermissions.every((permission) => permissions.includes(permission));
  return { roles, permissions, allowed: roleAllowed && permissionsAllowed };
}

function panelHeader(props) {
  const copy = element("div");
  copy.append(element("h2", { text: props.title || "" }));
  if (props.description) copy.append(element("p", { text: props.description }));
  return element("header", { className: "sdui-panel-header" }, copy);
}

function renderHero(node, definition) {
  const props = node.props || {};
  const hero = element("section", { className: "sdui-hero", "data-component-id": node.componentId });
  hero.append(element("p", { className: "sdui-eyebrow", text: props.eyebrow }));
  hero.append(element("h1", { text: props.title || definition.title }));
  hero.append(element("p", { text: props.description || definition.description }));
  const badges = element("div", { className: "sdui-badges", "aria-label": "화면 상태" });
  for (const badge of props.badges || []) badges.append(element("span", { className: "sdui-badge", text: badge }));
  hero.append(badges);
  return hero;
}

function renderMetrics(node, state) {
  const grid = element("section", {
    className: "sdui-metric-grid",
    "aria-label": node.props?.title || "핵심 지표",
    "data-component-id": node.componentId
  });
  for (const item of node.props?.items || []) {
    const value = getPath(state.data, item.path);
    const card = element("article", { className: "sdui-metric" });
    card.append(element("small", { text: item.label }));
    card.append(element("strong", { text: `${value ?? "-"}${value == null ? "" : (item.unit || "")}` }));
    grid.append(card);
  }
  return grid;
}

function fieldId(path) {
  return `sdui-field-${path.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function coerce(raw, schema, input) {
  if (schema.type === "boolean") return Boolean(input.checked);
  if (schema.type === "number" || schema.type === "integer") {
    if (raw === "") return null;
    const number = Number(raw);
    return Number.isFinite(number) ? number : null;
  }
  return raw;
}

function renderPrimitiveField(path, schema, ui, model, required) {
  const wrapper = element("div", { className: "sdui-field", "data-field-path": path });
  const id = fieldId(path);
  const label = element("label", { for: id, text: schema.title || path.split(".").at(-1) });
  if (required) label.append(element("span", { className: "sdui-required", text: "*", "aria-hidden": "true" }));
  wrapper.append(label);
  let input;
  if (Array.isArray(schema.enum)) {
    input = element("select", { id, name: path });
    schema.enum.forEach((value, index) => input.append(element("option", { value, text: schema.enumNames?.[index] || value })));
  } else if (ui.widget === "textarea") {
    input = element("textarea", { id, name: path, rows: ui.rows || 4 });
  } else {
    const type = schema.type === "number" || schema.type === "integer" ? "number" : (ui.widget || "text");
    input = element("input", {
      id,
      name: path,
      type,
      min: schema.minimum,
      max: schema.maximum,
      step: schema.multipleOf || (schema.type === "integer" ? 1 : ui.step),
      minlength: schema.minLength,
      maxlength: schema.maxLength,
      placeholder: ui.placeholder,
      required
    });
  }
  const current = getPath(model, path);
  if (schema.type === "boolean") input.checked = Boolean(current);
  else input.value = current ?? "";
  input.addEventListener("input", () => setPath(model, path, coerce(input.value, schema, input)));
  input.addEventListener("change", () => setPath(model, path, coerce(input.value, schema, input)));
  wrapper.append(input);
  if (ui.help || schema.description) wrapper.append(element("small", { className: "sdui-help", id: `${id}-help`, text: ui.help || schema.description }));
  wrapper.append(element("small", { className: "sdui-error", id: `${id}-error`, "aria-live": "polite" }));
  return wrapper;
}

function renderArrayTable(path, schema, ui, model) {
  const section = element("div", { className: "sdui-field", "data-field-path": path });
  section.append(element("span", { className: "sdui-field-label", text: schema.title || path }));
  if (ui.help || schema.description) section.append(element("small", { className: "sdui-help", text: ui.help || schema.description }));
  const tableWrap = element("div", { className: "sdui-table-wrap" });
  const table = element("table", { className: "sdui-table" });
  const head = element("thead");
  const headRow = element("tr");
  headRow.append(element("th", { scope: "col", text: "순서" }));
  const columns = ui.columns || Object.keys(schema.items?.properties || {});
  for (const key of columns) headRow.append(element("th", { scope: "col", text: schema.items.properties[key]?.title || key }));
  head.append(headRow);
  table.append(head);
  const body = element("tbody");
  const rows = getPath(model, path) || [];
  rows.forEach((row, index) => {
    const tr = element("tr", { "data-row-code": row.code || String(index) });
    tr.append(element("td", { text: index + 1 }));
    for (const key of columns) {
      const property = schema.items.properties[key] || {};
      const td = element("td");
      const itemPath = `${path}.${index}.${key}`;
      if (property.readOnly || ui.readOnly?.includes(key)) {
        td.append(element("span", { className: "sdui-readonly", text: row[key] ?? "-" }));
      } else {
        const input = element("input", {
          id: fieldId(itemPath),
          name: itemPath,
          type: property.type === "number" || property.type === "integer" ? "number" : "text",
          min: property.minimum,
          max: property.maximum,
          step: property.multipleOf || (property.type === "integer" ? 1 : ui.step?.[key]),
          value: row[key] ?? "",
          "aria-label": `${property.title || key} ${index + 1}`
        });
        input.addEventListener("input", () => setPath(model, itemPath, coerce(input.value, property, input)));
        td.append(input, element("small", { className: "sdui-error", id: `${fieldId(itemPath)}-error`, "aria-live": "polite" }));
      }
      tr.append(td);
    }
    body.append(tr);
  });
  table.append(body);
  tableWrap.append(table);
  section.append(tableWrap);
  section.append(element("small", { className: "sdui-error", id: `${fieldId(path)}-error`, "aria-live": "polite" }));
  return section;
}

function validateValue(schema, value, path, errors) {
  if (!schema) return;
  const label = schema.title || path || "값";
  if (schema.type === "object") {
    for (const required of schema.required || []) {
      const current = value?.[required];
      if (current === undefined || current === null || current === "") {
        errors.push({ path: path ? `${path}.${required}` : required, message: `${schema.properties?.[required]?.title || required} 항목은 필수입니다.` });
      }
    }
    for (const [key, property] of Object.entries(schema.properties || {})) {
      validateValue(property, value?.[key], path ? `${path}.${key}` : key, errors);
    }
    return;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      errors.push({ path, message: `${label} 배열 형식이 필요합니다.` });
      return;
    }
    if (schema.minItems != null && value.length < schema.minItems) errors.push({ path, message: `${label}은(는) ${schema.minItems}개 이상이어야 합니다.` });
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push({ path, message: `${label}은(는) ${schema.maxItems}개 이하여야 합니다.` });
    value.forEach((item, index) => validateValue(schema.items, item, `${path}.${index}`, errors));
    return;
  }
  if (value === undefined || value === null || value === "") return;
  if ((schema.type === "number" || schema.type === "integer") && typeof value !== "number") errors.push({ path, message: `${label}은(는) 숫자여야 합니다.` });
  if (schema.type === "integer" && !Number.isInteger(value)) errors.push({ path, message: `${label}은(는) 정수여야 합니다.` });
  if (typeof value === "number" && schema.minimum != null && value < schema.minimum) errors.push({ path, message: `${label}은(는) ${schema.minimum} 이상이어야 합니다.` });
  if (typeof value === "number" && schema.maximum != null && value > schema.maximum) errors.push({ path, message: `${label}은(는) ${schema.maximum} 이하여야 합니다.` });
  if (typeof value === "string" && schema.minLength != null && value.length < schema.minLength) errors.push({ path, message: `${label}은(는) ${schema.minLength}자 이상이어야 합니다.` });
  if (typeof value === "string" && schema.maxLength != null && value.length > schema.maxLength) errors.push({ path, message: `${label}은(는) ${schema.maxLength}자 이하여야 합니다.` });
  if (typeof value === "number" && schema.multipleOf != null) {
    const quotient = value / schema.multipleOf;
    if (Math.abs(quotient - Math.round(quotient)) > 1e-9) errors.push({ path, message: `${label}은(는) ${schema.multipleOf} 단위로 입력해야 합니다.` });
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) errors.push({ path, message: `${label}의 선택값이 올바르지 않습니다.` });
  if (schema.pattern && typeof value === "string" && !(new RegExp(schema.pattern)).test(value)) errors.push({ path, message: `${label}의 형식이 올바르지 않습니다.` });
}

function clearErrors(form) {
  form.querySelectorAll("[aria-invalid=true]").forEach((node) => node.removeAttribute("aria-invalid"));
  form.querySelectorAll(".sdui-error").forEach((node) => { node.textContent = ""; });
  form.querySelector(".sdui-error-summary")?.remove();
}

function showErrors(form, errors) {
  clearErrors(form);
  if (!errors.length) return true;
  const summary = element("section", { className: "sdui-error-summary", role: "alert", tabindex: "-1" });
  summary.append(element("h3", { text: `입력값 ${errors.length}개를 확인해 주세요.` }));
  const list = element("ul");
  errors.forEach((error) => {
    const id = fieldId(error.path);
    const input = form.querySelector(`#${CSS.escape(id)}`);
    input?.setAttribute("aria-invalid", "true");
    input?.setAttribute("aria-describedby", `${id}-error`);
    const errorNode = form.querySelector(`#${CSS.escape(id)}-error`) || form.querySelector(`[data-field-path="${CSS.escape(error.path)}"] .sdui-error`);
    if (errorNode) errorNode.textContent = error.message;
    const link = element("a", { href: `#${id}`, text: error.message });
    link.addEventListener("click", (event) => { event.preventDefault(); input?.focus(); });
    list.append(element("li", {}, link));
  });
  summary.append(list);
  form.prepend(summary);
  summary.focus();
  return false;
}

async function executeWorkflow(workflow, model, status, buttons) {
  const context = { form: clone(model), load: {}, steps: {} };
  buttons.forEach((button) => { button.disabled = true; });
  status.hidden = false;
  status.dataset.tone = "working";
  status.textContent = workflow.workingMessage || "저장·동기화 중입니다.";
  try {
    for (const step of workflow.steps || []) {
      const body = step.body === undefined ? undefined : templateValue(step.body, context);
      context.steps[step.id] = await fetchJson(step.endpoint, {
        method: step.method || "GET",
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    }
    status.dataset.tone = "success";
    status.textContent = templateValue(workflow.successMessage || "저장했습니다.", context);
    return context;
  } catch (error) {
    status.dataset.tone = "error";
    status.textContent = `${workflow.failureMessage || "저장에 실패했습니다."} · ${error.message}`;
    throw error;
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

function renderJsonForm(node, definition, state, refreshMetrics) {
  const props = node.props || {};
  const form = element("form", {
    className: "sdui-panel sdui-json-form",
    novalidate: true,
    "data-component-id": node.componentId,
    "data-database-readback": "complete"
  });
  form.append(panelHeader(props));
  const body = element("div", { className: "sdui-panel-body" });
  const status = element("div", { className: "sdui-status", role: "status", "aria-live": "polite", hidden: true });
  body.append(status);
  const layout = props.uiSchema?.layout?.sections || [{ title: props.title, fields: Object.keys(props.schema?.properties || {}) }];
  for (const sectionDef of layout) {
    const section = element("section", { className: "sdui-form-section" });
    section.append(element("h3", { text: sectionDef.title }));
    if (sectionDef.description) section.append(element("p", { text: sectionDef.description }));
    const primitiveGrid = element("div", { className: "sdui-field-grid" });
    let primitiveCount = 0;
    for (const field of sectionDef.fields || []) {
      const schema = props.schema.properties[field];
      if (!schema) continue;
      const path = field;
      const ui = props.uiSchema?.fields?.[field] || {};
      if (schema.type === "array") section.append(renderArrayTable(path, schema, ui, state.model));
      else {
        primitiveGrid.append(renderPrimitiveField(path, schema, ui, state.model, (props.schema.required || []).includes(field)));
        primitiveCount += 1;
      }
    }
    if (primitiveCount) section.append(primitiveGrid);
    body.append(section);
  }
  const actions = element("div", { className: "sdui-actions" });
  const reload = element("button", { type: "button", className: "sdui-button sdui-button-secondary", text: props.reloadLabel || "DB 값 다시 불러오기", "data-action": "reload" });
  const validate = element("button", { type: "button", className: "sdui-button sdui-button-secondary", text: props.validateLabel || "입력값 검증", "data-action": "validate" });
  const submit = element("button", { type: "submit", className: "sdui-button sdui-button-primary", text: props.submitLabel || "저장", "data-action": "submit" });
  actions.append(reload, validate, submit);
  body.append(actions);
  form.append(body);
  const validateForm = () => {
    const errors = [];
    validateValue(props.schema, state.model, "", errors);
    return showErrors(form, errors);
  };
  validate.addEventListener("click", () => {
    const valid = validateForm();
    status.hidden = false;
    status.dataset.tone = valid ? "success" : "error";
    const editableCount = form.querySelectorAll("input, textarea, select").length;
    const rowCount = form.querySelectorAll("tbody tr").length;
    status.textContent = valid
      ? (props.validationSuccessMessage || `입력값 ${editableCount}개${rowCount ? `와 반복 행 ${rowCount}개` : ""} 검증을 통과했습니다.`)
      : (props.validationFailureMessage || "오류를 수정한 뒤 다시 검증해 주세요.");
  });
  reload.addEventListener("click", () => location.reload());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateForm()) return;
    try {
      const result = await executeWorkflow(definition.workflow.submit, state.model, status, [reload, validate, submit]);
      const workflowSteps = definition.workflow.submit.steps || [];
      const resultStepId = definition.workflow.submit.stateResultStep || workflowSteps.at(-1)?.id;
      const saved = result.steps[resultStepId] || state.model;
      state.data = clone(saved);
      state.model = clone(saved);
      form.dataset.saved = "true";
      form.dataset.databaseReadback = "pending-reload";
      refreshMetrics();
    } catch {
      form.dataset.saved = "false";
    }
  });
  return form;
}

function renderProcess(node) {
  const wrapper = element("section", { className: "sdui-panel", "data-component-id": node.componentId });
  wrapper.append(panelHeader(node.props || {}));
  const process = element("div", { className: "sdui-panel-body sdui-process" });
  for (const step of node.props?.steps || []) {
    const card = element("article");
    card.append(element("h3", { text: step.title }));
    card.append(element("p", { text: step.description }));
    process.append(card);
  }
  wrapper.append(process);
  return wrapper;
}

function renderCards(node) {
  const wrapper = element("section", { className: "sdui-panel", "data-component-id": node.componentId });
  wrapper.append(panelHeader(node.props || {}));
  const grid = element("div", { className: "sdui-panel-body sdui-card-grid" });
  for (const item of node.props?.items || []) {
    const card = element("article", { className: "sdui-support-card", "data-card-id": item.id });
    card.append(element("h3", { text: item.title }));
    card.append(element("p", { text: item.description }));
    grid.append(card);
  }
  wrapper.append(grid);
  return wrapper;
}

function renderDenied(main, definition, authority) {
  const root = element("section", { className: "sdui-root", "data-sdui-runtime": RUNTIME_ID, "data-sdui-authority": "denied" });
  root.append(renderHero(definition.nodes.find((node) => node.componentType === "hero") || { props: {} }, definition));
  const message = element("section", { className: "sdui-authority", "data-tone": "denied", role: "alert" });
  message.append(element("h2", { text: "이 화면을 편집할 권한이 없습니다." }));
  message.append(element("p", { text: `현재 역할: ${authority.roles.join(", ") || "없음"} / 보유 권한: ${authority.permissions.join(", ") || "없음"} / 허용 역할: ${definition.authority.roleAny.join(", ")} / 필수 권한: ${(definition.authority.permissions || []).join(", ") || "없음"}` }));
  root.append(message);
  main.replaceChildren(root);
  document.documentElement.dataset.sduiRuntime = "denied";
}

function renderDefinition(main, definition, registry, authority, initialData) {
  const state = { data: clone(initialData), model: clone(initialData) };
  const root = element("div", {
    className: "sdui-root",
    "data-sdui-runtime": RUNTIME_ID,
    "data-sdui-ready": "true",
    "data-sdui-authority": "allowed",
    "data-screen-id": definition.screenId,
    "data-page-id": definition.pageId,
    "data-menu-code": definition.menuCode,
    "data-design-version": definition.designVersion
  });
  let metricMount = null;
  const refreshMetrics = () => {
    if (!metricMount) return;
    const metricNode = definition.nodes.find((node) => node.componentType === "metric-grid");
    metricMount.replaceWith(renderMetrics(metricNode, state));
    metricMount = root.querySelector(`[data-component-id="${metricNode.componentId}"]`);
  };
  for (const node of [...definition.nodes].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))) {
    let rendered;
    if (node.componentType === "hero") rendered = renderHero(node, definition);
    else if (node.componentType === "metric-grid") rendered = renderMetrics(node, state);
    else if (node.componentType === "json-form") rendered = renderJsonForm(node, definition, state, refreshMetrics);
    else if (node.componentType === "process-steps") rendered = renderProcess(node);
    else if (node.componentType === "card-grid") rendered = renderCards(node);
    else rendered = element("section", { className: "sdui-diagnostic", text: `지원하지 않는 컴포넌트: ${node.componentType}` });
    root.append(rendered);
    if (node.componentType === "metric-grid") metricMount = rendered;
  }
  main.replaceChildren(root);
  document.title = `${definition.title} | Woosu Digital Twin`;
  document.documentElement.dataset.sduiRuntime = "ready";
  document.documentElement.dataset.sduiScreen = definition.screenId;
  document.documentElement.dataset.sduiAuthority = authority.roles.join(",");
  document.documentElement.dataset.sduiPermissions = authority.permissions.join(",");
}

async function mount() {
  if (mounting) return;
  const screenRegistry = await getScreenRegistry();
  injectNavigation(screenRegistry);
  const screenEntry = (screenRegistry.screens || []).find((entry) => entry.route === location.pathname);
  if (!screenEntry) return;
  if (document.querySelector(".login")) return;
  const main = document.querySelector("main.main");
  if (!main || main === mountedMain || main.dataset.sduiMounting === "true") return;
  mounting = true;
  main.dataset.sduiMounting = "true";
  main.replaceChildren(element("section", { className: "sdui-diagnostic", text: "SDUI JSON Form 설계와 DB 데이터를 불러오는 중입니다." }));
  try {
    const definition = await fetchAsset(screenEntry.screenRef);
    if (definition.route !== screenEntry.route || definition.screenId !== screenEntry.screenId) {
      throw new Error(`screen registry mismatch: ${screenEntry.screenId}`);
    }
    const [registry, theme, authority] = await Promise.all([
      fetchAsset(definition.componentRegistryRef),
      fetchAsset(definition.themeRef),
      resolveAuthority(definition.authority)
    ]);
    applyTheme(theme);
    const contractErrors = validateContract(definition, registry);
    if (contractErrors.length) throw new Error(contractErrors.join(" / "));
    if (!authority.allowed) renderDenied(main, definition, authority);
    else {
      const initialData = await fetchJson(definition.workflow.load.endpoint);
      renderDefinition(main, definition, registry, authority, initialData);
    }
    mountedMain = main;
  } catch (error) {
    main.replaceChildren(element("section", { className: "sdui-diagnostic", role: "alert", text: `SDUI 화면 로드 실패 · ${error.message}` }));
    document.documentElement.dataset.sduiRuntime = "error";
    document.documentElement.dataset.sduiError = error.message;
  } finally {
    mounting = false;
    delete main.dataset.sduiMounting;
  }
}

new MutationObserver(() => { void mount(); }).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("popstate", () => { mountedMain = null; void mount(); });
void mount();
