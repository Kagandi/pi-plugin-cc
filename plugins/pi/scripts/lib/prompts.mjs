import fs from "node:fs";
import path from "node:path";

const TEMPLATE_REGEX = /\{\{(\w+)\}\}/g;

export function loadPromptTemplate(rootDir, name) {
  const templatePath = path.join(rootDir, "prompts", `${name}.md`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Prompt template not found: ${name}`);
  }
  return fs.readFileSync(templatePath, "utf8");
}

export function interpolateTemplate(template, variables) {
  return template.replace(TEMPLATE_REGEX, (_, key) => {
    const value = variables[key];
    if (value === undefined || value === null) {
      throw new Error(`Missing template variable: ${key}`);
    }
    return String(value);
  });
}
